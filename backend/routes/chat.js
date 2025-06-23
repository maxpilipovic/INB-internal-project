import express from 'express';
import openai from '../config/openai.js';
import { fetchFreshServiceArticles } from '../services/freshService.js';
import { logChat } from '../services/firestore.js';
import { submitFreshServiceTicket } from '../services/freshServiceTicket.js';
import { listFreshServiceTicketsByEmail } from '../services/freshServiceListAllTickets.js';
import { getFreshServiceTicketById } from '../services/freshServiceListSpecificTicket.js';
import { getTicketConversations } from '../services/freshServiceListTicketConversations.js';
import { db, bucket } from '../config/firebase.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

router.post('/chat', async (req, res) => {
  //Grabs stuff from frontend
  //const { message: userMessage } = req.body;
  const { message: userMessage, uid } = req.body;



  //Check if user is asking for ticket activity
  const activityMatch = userMessage.match(/(?:conversations?|updates?|history|activity).*ticket\s*#?(\d{3,})/i);

  if (activityMatch) {
    const ticketId = activityMatch[1];

    try {
      const conversations = await getTicketConversations(ticketId);
      console.log(conversations);

      if (!conversations.length) {
        const reply = `There are no conversations on ticket #${ticketId} yet.`;
        await logChat(uid, userMessage, reply);
        return res.json({ reply });
      }

      const formatted = conversations.slice(-5).map(conv => {
        const from = conv.user_id ? `Agent/User ${conv.user_id}` : 'System';
        const body = conv.body_text?.slice(0, 120)?.replace(/\n/g, ' ') || '(No text)';
        return `- ${from}: "${body}..."`;

      }).join('\n');

      const reply = `📜 Recent conversations on ticket #${ticketId}:\n\n${formatted}`;
      await logChat(uid, userMessage, reply);
      return res.json({ reply });

    } catch (err) {
      const reply = `Sorry, I couldn't fetch conversations for ticket #${ticketId}.`;
      await logChat(uid, userMessage, reply);
      return res.json({ reply });
    }
  }

  //Check if user is asking for a specific ticket
  const ticketIdMatch = userMessage.match(/(?:ticket\s*#?|#)(\d{3,})/i);

  if (ticketIdMatch) {
    const ticketId = ticketIdMatch[1];

    try {
      const ticket = await getFreshServiceTicketById(ticketId);
      console.log('Fetched ticket:', ticket);

      const statusMap = {
        2: 'Open',
        3: 'Pending',
        4: 'Resolved',
        5: 'Closed',
        6: 'Waiting on customer',
        7: 'Waiting on third party',
      };

      const reply = `📝 Ticket #${ticket.id} - *${ticket.subject}* is currently **${statusMap[ticket.status] || 'Unknown'}**.`;

      await logChat(uid, userMessage, reply);
      return res.json({ reply });

    } catch (error) {
      console.error('Error checking specific ticket:', error);
      const reply = `Sorry, I couldn't retrieve info for ticket #${ticketId}.`;
      await logChat(uid, userMessage, reply);
      return res.json({ reply });
      }
  }


  //Check if user is asking for LIST tickets?
  if (/list.*tickets|show.*tickets|my.*tickets|view.*tickets|status.*ticket|update.*ticket|how.*ticket.*doing|check.*ticket/i.test(userMessage)) {
    try {

      //Get from db
      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) throw new Error('User not found in db');

      const userData = userDoc.data();
      const tickets = await listFreshServiceTicketsByEmail(userData.email);

      if (!tickets.length) {
        return res.json({ reply: 'You have no open tickets at the moment!' });
      }
      
      //Hashy for replies
      const statusMap = {
        2: 'Open',
        3: 'Pending',
        4: 'Resolved',
        5: 'Closed',
        6: 'Waiting on customer',
        7: 'Waiting on third party',
      };

      const formatted = tickets.slice(0, 5).map((t) => `#${t.id} - ${t.subject} [${statusMap[t.status] || 'Unknown'}]`).join('\n');

      const reply = `Here are your open tickets:\n\n${formatted}\n\nYou can ask me to create a new ticket if you need help with something else.`;
      await logChat(uid, userMessage, reply);
      return res.json({ reply})
    } catch (error) {
      console.error('Error fetching tickets:', error);
      return res.json({ reply: 'Sorry, I could not fetch your tickets at this time.' });
    }
  }

  //1.Try to search knowledge base
  const kbArticles = await fetchFreshServiceArticles(userMessage);
  const kbText = kbArticles.map(article => `- ${article.title}: ${article.content}`).join('\n');

  //2.Ask GPT to try answering using KB content
  const gptMessages = [
    {
        role: 'system',
        content: `You are an internal INB IT Help Desk assistant. Use the following FreshService knowledge base to help the user:\n\n${kbText || 'No articles found.'}\n\nIf the knowledge base is insufficient, you should offer to create a help desk ticket. If the user directly requests to create a ticket, you should also proceed with submitting one. Be confident in your response.`,
    },
    {
        role: 'user',
        content: userMessage,
    },
  ];

  //SENDS TO OPENAI API
  //This is where the magic happens
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: gptMessages,
    });

    const botReply = completion.choices?.[0]?.message?.content?.trim();

    //3.Log the response
    await logChat(uid, userMessage, botReply);

    //4.Check if user wants to create a ticket
    //This regex checks if the user message or bot reply indicates a desire to create a ticket
    const wantsTicket = /submit.*ticket|create.*ticket|help desk ticket|i need.*help/i.test(userMessage) || 
                    /should I create.*ticket|would you like.*ticket|I couldn’t find a good answer/i.test(botReply);

                    
    //4.Check if bot is offering to create a ticket (based on trigger phrase)
    if (wantsTicket) {
      return res.json({ 
        reply: botReply, 
        awaitingTicketConfirmation: true, //FLAG SENT TO FRONTEND TO SHOW CONFIRMATION BUTTONS
        ticketContext: userMessage, 
    });
    }

    //5.Otherwise, return normal KB response
    return res.json({ reply: botReply || 'GPT is currently unavailable.' });

  } catch (err) {
    console.error('OPENAI Error', err);
    const botReply = 'GPT is currently unavailable.';
    await logChat(userMessage, botReply);
    return res.json({ reply: botReply });
  }
});

router.post('/chat/confirm-ticket', upload.array('attachments', 5), async (req, res) => {
  const userConfirmation = req.body.message;
  const uid = req.body.uid;

  let chatHistory = []
  try {
    chatHistory = JSON.parse(req.body.chatHistory || '[]');
  } catch (err) {
    console.error('Failed to parse chatHistory:', err);
    chatHistory = [{ role: 'user', content: 'Unable to parse chat history. User requested support.' }];
  }

  //Uploads files to firebase storage
  const attachmentUrls = [];

  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const fileName = `attachments/${uuidv4()}-${file.originalname}`;
      const fileRef = bucket.file(fileName);
      await fileRef.save(file.buffer, {
        metadata: { contentType: file.mimetype },
        resumable: false,
      });

      // Make public or generate signed URL
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
      { role: 'user', content: userConfirmation },
    ],
  });

  const intent = intentResponse.choices?.[0]?.message?.content?.toLowerCase();

  if (intent.includes('yes') || intent.includes('sure') || intent.includes('please') || intent.includes('yeah')) {
    try {
      await submitFreshServiceTicket(chatHistory, uid, attachmentUrls);
      const botReply = '✅ Your help desk ticket has been submitted successfully.';
      await logChat(uid, userConfirmation, botReply);
      return res.json({ reply: botReply });
    } catch (error) {
      console.error('Error submitting ticket:', error);
      const botReply = 'Sorry, there was an issue submitting your ticket.';
      await logChat(uid, userConfirmation, botReply);
      return res.json({ reply: botReply });
    }
  }

  const botReply = 'Okay, no ticket has been created. Let me know if you need anything else.';
  await logChat(uid, userConfirmation, botReply);
  return res.json({ reply: botReply });
});

export default router;