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
import { submitFreshServiceTicketFromPreview } from '../services/freshServiceTicket.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.post('/chat', async (req, res) => {
  const { message: userMessage, uid, chatId } = req.body;
  const sanitizeMessage = sanitizeInput(userMessage);

  //CHECKING TICKET STUFF FIRST
  //USER ASKS "LETS SEE TICKET"
  if (/show.*ticket|preview.*ticket|what.*ticket.*say|let.*see.*ticket/i.test(sanitizeMessage)) {
    try {
      const previewRef = db.collection('users').doc(uid).collection('ticketPreviews').doc(chatId);
      const previewDoc = await previewRef.get();

      if (!previewDoc.exists) {
        const reply = `⚠️ I couldn’t find a ticket preview to show. Please generate one first.`;
        const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
        return res.json({ reply, chatId: newChatId || chatId });
      }

      const { subject, description, priority } = previewDoc.data().ticketPreview;

      const priorityMap = {
        1: 'Low',
        2: 'Medium',
        3: 'High',
        4: 'Urgent',
        'Low': 'Low',
        'Medium': 'Medium',
        'High': 'High',
        'Urgent': 'Urgent',
      };

      const priorityLabel = priorityMap[priority] || 'Not set';
      const reply = `🎟️ Ticket Preview\n\n**Subject:** ${subject}\n**Description:** ${description}\n**Priority:** ${priorityLabel}`;

      const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
      return res.json({ reply, chatId: newChatId || chatId });

    } catch (error) {
      console.error('Error fetching ticket preview:', error);
      const reply = `⚠️ Something went wrong while fetching the ticket preview.`;
      const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
      return res.json({ reply, chatId: newChatId || chatId });
    }
  }

  //Checking for priority change
  let detectedPriority = null;

  try {
    const priorityIntentResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
        role: 'system',
        content: `You are a helpful assistant. Based on the user's message, determine if they are trying to set or change the priority of a help desk ticket. If so, respond ONLY with one of these exact values: "Low", "Medium", "High", "Urgent". If the message is not related to priority, respond with "None".`,
      },
      { role: 'user', content: sanitizeMessage },
    ],
  });

  const responseText = priorityIntentResponse.choices?.[0]?.message?.content?.trim();
  if (['Low', 'Medium', 'High', 'Urgent'].includes(responseText)) {
    detectedPriority = responseText;
  }

  } catch (err) {
    console.error('Error detecting priority via GPT:', err);
  }

  if (detectedPriority) {
    try {
      const previewRef = db.collection('users').doc(uid).collection('ticketPreviews').doc(chatId);
      const previewDoc = await previewRef.get();

      if (!previewDoc.exists) {
        const reply = '⚠️ I couldn’t find a ticket preview to update. Please preview the ticket first.';
        const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
        return res.json({ reply, chatId: newChatId || chatId });
      }

      await previewRef.update({ 'ticketPreview.priority': detectedPriority });

      const reply = `✅ Got it. I’ve updated your ticket priority to **${detectedPriority}**.`;
      const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
      return res.json({ reply, chatId: newChatId || chatId });

    } catch (err) {
      console.error('Error updating Firestore ticket priority:', err);
      const reply = '❌ There was an issue updating the ticket priority.';
      const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
      return res.json({ reply, chatId: newChatId || chatId });
    }
  }

  //Ticket activity
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
      content:  `You are an internal IT Help Desk assistant for INB.
                Use the following FreshService knowledge base to help the user:\n\n${kbText || 'No articles found.'}
                If the user seems to want help beyond knowledge base, gently ask if they’d like to open a help desk ticket.`,
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

    const intentCheck = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Based on the user message below, does the user want to create a help desk ticket? Answer only "yes" or "no".',
        },
        { role: 'user', content: sanitizeMessage },
      ],
    });

    const intentResponse = intentCheck.choices?.[0]?.message?.content?.trim().toLowerCase();
    const wantsPreview = ['yes', 'yes.'].includes(intentResponse);

    return res.json({
      reply: botReply || 'GPT is currently unavailable.',
      awaitingTicketPreview: wantsPreview,
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

  //Load stored ticket preview
  let ticketPreview;
  try {
    const chatDoc = await db.collection('users').doc(uid).collection('ticketPreviews').doc(chatId).get();
    ticketPreview = chatDoc.data()?.ticketPreview;

    if (!ticketPreview) {
      throw new Error('No ticket preview found. Please generate a preview first.');
    }
  } catch (error) {
    console.error('Error fetching ticket preview:', error);
    return res.status(400).json({ reply: '❌ No preview found. Please preview the ticket first.' });
  }

  //Check user intent with GPT
  let intent;
  try {
    const intentResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'The user was previously shown a ticket preview. Based on their reply below, determine if they want to submit the ticket. Answer only "yes" or "no".',
        },
        { role: 'user', content: userMessage },
      ],
    });
    intent = intentResponse.choices?.[0]?.message?.content?.toLowerCase();
  } catch (error) {
    console.error('Error determining intent:', error);
  }

  //Handle attachments
  const attachmentUrls = [];
  if (req.files?.length) {
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
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
      attachmentUrls.push({
        label: `File${i + 1}`,
        url: url
      });
    }
  }

  //Decision logic
  let botReply;
  if (intent && /yes|sure|please|yeah|submit|go ahead/i.test(intent)) {
    try {
      //Use stored ticket preview to submit the actual ticket
      await submitFreshServiceTicketFromPreview(ticketPreview, uid, attachmentUrls);
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
  const { chatHistory, uid, chatId } = req.body;
  const safeChatId = chatId || uuidv4();


  //Check if a preview already exists
  const previewRef = db.collection('users').doc(uid).collection('ticketPreviews').doc(safeChatId);
  const previewDoc = await previewRef.get();

  if (previewDoc.exists) {
    //Return existing preview as-is, don't regenerate
    return res.json({ ticket: previewDoc.data().ticketPreview, chatId: safeChatId });
  }

  try {
    const ticketDetails = await generateTicketDetailsFromHistory(chatHistory);

    //Save preview to Firestore
    await previewRef.set({ ticketPreview: ticketDetails });
    return res.json({ ticket: ticketDetails, chatId: safeChatId });

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
