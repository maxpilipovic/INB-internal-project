import express from 'express';
import openai from '../config/openai.js';
import { fetchFreshServiceArticles } from '../services/freshService.js';
import { logChat } from '../services/firestore.js';
import { generateTicketDetailsFromHistory, submitFreshServiceTicket } from '../services/freshServiceTicket.js';
import { listFreshServiceTicketsByEmail } from '../services/freshServiceListAllTickets.js';
import { getFreshServiceTicketById } from '../services/freshServiceListSpecificTicket.js';
import { getTicketConversations } from '../services/freshServiceListTicketConversations.js';
import { db, bucket } from '../config/firebase.js';
import { sanitizeInput } from '../utils/sanitizeInput.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.post('/chat', async (req, res) => {
  const { message: userMessage, uid, chatId } = req.body;
  const sanitizeMessage = sanitizeInput(userMessage);

  // Ticket activity
  const activityMatch = sanitizeMessage.match(/(?:conversations?|updates?|history|activity).*ticket\s*#?(\d{3,})/i);
  if (activityMatch) {
    const ticketId = activityMatch[1];
    try {
      const conversations = await getTicketConversations(ticketId);
      const reply = conversations.length
        ? `📜 Recent conversations on ticket #${ticketId}:\n\n` + conversations.slice(-5).map(conv => {
            const from = conv.user_id ? `Agent/User ${conv.user_id}` : 'System';
            const body = conv.body_text?.slice(0, 120)?.replace(/\n/g, ' ') || '(No text)';
            return `- ${from}: "${body}..."`;
          }).join('\n')
        : `There are no conversations on ticket #${ticketId} yet.`;

      const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
      return res.json({ reply, chatId: newChatId || chatId });
    } catch {
      const reply = `Sorry, I couldn't fetch conversations for ticket #${ticketId}.`;
      const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
      return res.json({ reply, chatId: newChatId || chatId });
    }
  }

  // Ticket status
  const ticketIdMatch = sanitizeMessage.match(/(?:ticket\s*#?|#)(\d{3,})/i);
  if (ticketIdMatch) {
    const ticketId = ticketIdMatch[1];
    try {
      const ticket = await getFreshServiceTicketById(ticketId);
      const statusMap = {
        2: 'Open', 3: 'Pending', 4: 'Resolved', 5: 'Closed',
        6: 'Waiting on customer', 7: 'Waiting on third party',
      };
      const reply = `📝 Ticket #${ticket.id} - *${ticket.subject}* is currently **${statusMap[ticket.status] || 'Unknown'}**.`;
      const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
      return res.json({ reply, chatId: newChatId || chatId });
    } catch {
      const reply = `Sorry, I couldn't retrieve info for ticket #${ticketId}.`;
      const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
      return res.json({ reply, chatId: newChatId || chatId });
    }
  }

  // List tickets
  if (/list.*tickets|show.*tickets|my.*tickets|view.*tickets|status.*ticket|update.*ticket|how.*ticket.*doing|check.*ticket/i.test(sanitizeMessage)) {
    try {
      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) throw new Error('User not found in db');

      const userData = userDoc.data();
      const tickets = await listFreshServiceTicketsByEmail(userData.sanitizedEmail);

      const statusMap = {
        2: 'Open', 3: 'Pending', 4: 'Resolved', 5: 'Closed',
        6: 'Waiting on customer', 7: 'Waiting on third party',
      };

      const reply = tickets.length
        ? `Here are your open tickets:\n\n` +
          tickets.slice(0, 5).map(t => `#${t.id} - ${t.subject} [${statusMap[t.status] || 'Unknown'}]`).join('\n') +
          `\n\nYou can ask me to create a new ticket if you need help with something else.`
        : 'You have no open tickets at the moment!';

      const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
      return res.json({ reply, chatId: newChatId || chatId });
    } catch (error) {
      console.error('Error fetching tickets:', error);
      return res.json({ reply: 'Sorry, I could not fetch your tickets at this time.' });
    }
  }

  // GPT + KB fallback
  const kbArticles = await fetchFreshServiceArticles(sanitizeMessage);
  const kbText = kbArticles.map(article => `- ${article.title}: ${article.content}`).join('\n');

  const gptMessages = [
    {
      role: 'system',
      content: `You are an internal INB IT Help Desk assistant. Use the following FreshService knowledge base to help the user:\n\n${kbText || 'No articles found.'}\n\nIf the knowledge base is insufficient, offer to create a help desk ticket. If the user directly requests to create a ticket, proceed with submitting one.`,
    },
    {
      role: 'user',
      content: sanitizeMessage,
    },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: gptMessages,
    });

    const botReply = completion.choices?.[0]?.message?.content?.trim();
    const newChatId = await logChat(uid, sanitizeMessage, botReply, chatId);

    const wantsTicket =
      /submit.*ticket|create.*ticket|help desk ticket|i need.*help/i.test(sanitizeMessage) ||
      /should I create.*ticket|would you like.*ticket|I couldn’t find a good answer/i.test(botReply);

    return res.json({
      reply: botReply || 'GPT is currently unavailable.',
      awaitingTicketConfirmation: wantsTicket,
      chatId: newChatId || chatId,
    });
  } catch (err) {
    console.error('OPENAI Error', err);
    const botReply = 'GPT is currently unavailable.';
    const newChatId = await logChat(uid, sanitizeMessage, botReply, chatId);
    return res.json({ reply: botReply, chatId: newChatId || chatId });
  }
});

router.post('/chat/confirm-ticket', upload.array('attachments', 5), async (req, res) => {
  const userMessage = sanitizeInput(req.body.message);
  const uid = req.body.uid;
  const chatId = req.body.chatId;

  let chatHistory = [];
  try {
    chatHistory = JSON.parse(req.body.chatHistory || '[]');
  } catch (err) {
    console.error('Failed to parse chatHistory:', err);
    chatHistory = [{ role: 'user', content: 'Unable to parse chat history. User requested support.' }];
  }

  const attachmentUrls = [];
  if (req.files?.length) {
    for (const file of req.files) {
      const fileName = `attachments/${uuidv4()}-${file.originalname}`;
      const fileRef = bucket.file(fileName);
      await fileRef.save(file.buffer, {
        metadata: { contentType: file.mimetype },
        resumable: false,
      });
      const [url] = await fileRef.getSignedUrl({
        action: 'read',
        expires: '03-01-2030',
      });
      attachmentUrls.push(url);
    }
  }

  const intentResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'The user was just asked if they want to submit a ticket. Determine if their response is a yes.',
      },
      { role: 'user', content: userMessage },
    ],
  });

  const intent = intentResponse.choices?.[0]?.message?.content?.toLowerCase();
  let botReply;

  if (intent.includes('yes') || intent.includes('sure') || intent.includes('please') || intent.includes('yeah')) {
    try {
      await submitFreshServiceTicket(chatHistory, uid, attachmentUrls);
      botReply = '✅ Your help desk ticket has been submitted successfully.';
    } catch (error) {
      console.error('Error submitting ticket:', error);
      botReply = 'Sorry, there was an issue submitting your ticket.';
    }
  } else {
    botReply = 'Okay, no ticket has been created. Let me know if you need anything else.';
  }

  const newChatId = await logChat(uid, userMessage, botReply, chatId);
  return res.json({ reply: botReply, chatId: newChatId || chatId });
});

router.post('/chat/preview-ticket', async (req, res) => {
  const { chatHistory, uid } = req.body;
  try {
    const ticketDetails = await generateTicketDetailsFromHistory(chatHistory);
    return res.json({ ticket: ticketDetails });
  } catch (error) {
    console.error('Error generating ticket preview:', error);
    return res.status(500).json({ error: 'Failed to generate ticket preview.' });
  }
});

router.get('/get-chat/:chatId', async (req, res) => {
  const { chatId } = req.params;
  const { uid } = req.query;

  try {
    const chatDoc = await db.collection('users').doc(uid).collection('chats').doc(chatId).get();
    if (!chatDoc.exists) return res.status(404).json({ error: 'Chat not found' });
    return res.json(chatDoc.data());
  } catch (error) {
    console.error('Error fetching chat:', error);
    return res.status(500).json({ error: 'Failed to fetch chat data' });
  }
});

export default router;
