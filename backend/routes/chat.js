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
import { cleanGptOutput } from '../utils/cleanGptOutput.js';
import { getAgentAssigned } from '../services/getAgentAssigned.js';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// Intent detection function using OpenAI
async function detectIntent(message) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an intent classification assistant for a help desk system. 
          
          Analyze the user's message and determine their intent. You must respond with ONLY a valid JSON object, no markdown formatting, no code blocks, just pure JSON:
          
          {
            "intent": "intent_name",
            "confidence": 0.95,
            "extracted_data": {}
          }
          
          Available intents:
          - "update_description": User wants to modify/rewrite/change/improve the ticket description
          - "update_subject": User wants to modify/rewrite/change/improve the ticket subject  
          - "show_ticket": User wants to see/preview/view the current ticket
          - "update_priority": User wants to change ticket priority (extract priority level)
          - "ticket_activity": User wants to see conversations/updates/history for a specific ticket (extract ticket ID)
          - "ticket_status": User wants to check status of a specific ticket (extract ticket ID)
          - "tick_agent": User wants to see who is assigned to a specific ticket (extract ticket ID)
          - "list_tickets": User wants to see their tickets/check ticket status generally
          - "create_ticket": User wants to create a new help desk ticket
          - "general_help": User needs general IT help/support
          - "other": None of the above intents apply
          
          For priority updates, extract priority as: "Low", "Medium", "High", or "Urgent"
          For ticket queries, extract ticket ID (3+ digit number) if mentioned

          Examples of "tick_agent" intent:
          - "Who is assigned to ticket 82344"
          - "What agent is assigned to ticket 82344"
          - "Who is working on ticket 82344"
          - "Which agent has ticket 82344"
          - "Who's handling ticket 82344"
          - "What's the assignee for ticket 82344"
          
          IMPORTANT: Return only the JSON object, no explanation, no markdown, no code blocks.`
        },
        { role: 'user', content: message }
      ],
      temperature: 0.1
    });

    let result = response.choices?.[0]?.message?.content?.trim();
    
    // Clean up the response in case it contains markdown code blocks
    if (result.includes('```json')) {
      result = result.replace(/```json\s*/, '').replace(/```\s*$/, '');
    } else if (result.includes('```')) {
      result = result.replace(/```\s*/, '').replace(/```\s*$/, '');
    }
    
    // Remove any leading/trailing whitespace
    result = result.trim();
    
    return JSON.parse(result);
  } catch (error) {
    console.error('Error detecting intent:', error);
    console.error('Raw response:', response?.choices?.[0]?.message?.content);
    return { intent: 'other', confidence: 0.5, extracted_data: {} };
  }
}

router.post('/chat', async (req, res) => {
  const { message: userMessage, uid, chatId } = req.body;
  const sanitizeMessage = sanitizeInput(userMessage);

  // Detect user intent using OpenAI
  const intentResult = await detectIntent(sanitizeMessage);
  const { intent, extracted_data } = intentResult;

  console.log('Detected intent:', intent, 'Data:', extracted_data);

  // Handle ticket description updates
  if (intent === 'update_description') {
    const previewRef = db.collection('users').doc(uid).collection('ticketPreviews').doc(chatId);
    const previewDoc = await previewRef.get();
    const preview = previewDoc.data()?.ticketPreview;

    if (!preview) {
      const reply = `⚠️ No ticket preview found to update. Please generate one first.`;
      const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
      return res.json({ reply, chatId: newChatId || chatId });
    }

    const chatDoc = await db.collection('users').doc(uid).collection('chats').doc(chatId).get();
    const chatData = chatDoc.data();
    const chatHistoryFormatted = chatData?.messages?.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    })) || [];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: `You are an IT assistant rewriting a helpdesk ticket description.` },
        ...chatHistoryFormatted,
        { role: 'user', content: `Please rewrite ONLY the ticket description clearly and professionally. Respond with just the revised description text — no extra commentary, no greetings, no labels, no markdown formatting.` }
      ]
    });

    let newValue = completion.choices?.[0]?.message?.content?.trim() || '';
    console.log(newValue);
    newValue = cleanGptOutput(newValue);
    console.log(newValue);

    await previewRef.update({ [`ticketPreview.description`]: newValue });
    const reply = `✅ I've updated the ticket description to:\n\n${newValue}`;
    const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
    return res.json({ reply, chatId: newChatId || chatId });
  }

  // Handle ticket subject updates
  if (intent === 'update_subject') {
    const previewRef = db.collection('users').doc(uid).collection('ticketPreviews').doc(chatId);
    const previewDoc = await previewRef.get();
    const preview = previewDoc.data()?.ticketPreview;

    if (!preview) {
      const reply = `⚠️ No ticket preview found to update. Please generate one first.`;
      const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
      return res.json({ reply, chatId: newChatId || chatId });
    }

    const chatDoc = await db.collection('users').doc(uid).collection('chats').doc(chatId).get();
    const chatData = chatDoc.data();
    const chatHistoryFormatted = chatData?.messages?.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    })) || [];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: `You are an IT assistant rewriting a helpdesk ticket subject.` },
        ...chatHistoryFormatted,
        { role: 'user', content: `Please rewrite the subject of this ticket to be clearer and more professional.` }
      ]
    });

    let newValue = completion.choices?.[0]?.message?.content?.trim() || '';
    newValue = cleanGptOutput(newValue);

    await previewRef.update({ [`ticketPreview.subject`]: newValue });
    const reply = `✅ I've updated the ticket subject to:\n\n${newValue}`;
    const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
    return res.json({ reply, chatId: newChatId || chatId });
  }

  // Handle show ticket requests
  if (intent === 'show_ticket') {
    try {
      const previewRef = db.collection('users').doc(uid).collection('ticketPreviews').doc(chatId);
      const previewDoc = await previewRef.get();

      if (!previewDoc.exists) {
        const reply = `⚠️ I couldn't find a ticket preview to show. Please generate one first.`;
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

  // Handle priority updates
  if (intent === 'update_priority' && extracted_data.priority) {
    const detectedPriority = extracted_data.priority;
    
    try {
      const previewRef = db.collection('users').doc(uid).collection('ticketPreviews').doc(chatId);
      const previewDoc = await previewRef.get();

      if (!previewDoc.exists) {
        const reply = '⚠️ I couldn\'t find a ticket preview to update. Please preview the ticket first.';
        const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
        return res.json({ reply, chatId: newChatId || chatId });
      }

      await previewRef.update({ 'ticketPreview.priority': detectedPriority });

      const reply = `✅ Got it. I've updated your ticket priority to **${detectedPriority}**.`;
      const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
      return res.json({ reply, chatId: newChatId || chatId });

    } catch (err) {
      console.error('Error updating Firestore ticket priority:', err);
      const reply = '❌ There was an issue updating the ticket priority.';
      const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
      return res.json({ reply, chatId: newChatId || chatId });
    }
  }

  // Handle ticket activity requests
  if (intent === 'ticket_activity' && extracted_data.ticket_id) {
    const ticketId = extracted_data.ticket_id;
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

  if (intent === 'tick_agent' && extracted_data.ticket_id) {
    const ticketId = extracted_data.ticket_id;
    try {
      const ticket = await getFreshServiceTicketById(ticketId);
      const responderId = ticket.responder_id;
      if (!responderId) {
        const reply = `No agent is currently assigned to ticket #${ticketId}.`;
        const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
        return res.json({ reply, chatId: newChatId || chatId });
      }

      const agent = await getAgentAssigned(responderId);
      const reply2 = `👤 Ticket #${ticketId} is currently assigned to agent **${agent.agent.first_name + " " + agent.agent.last_name}** (${agent.agent.email}).`;
      const newChatId = await logChat(uid, sanitizeMessage, reply2, chatId);
      return res.json({ reply: reply2, chatId: newChatId || chatId });
    } catch (error) {
      const reply = `Sorry, I couldn't fetch the agent assigned to ticket #${ticketId}.`;
      const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
      return res.json({ reply, chatId: newChatId || chatId });
    }
  }

  // Handle ticket status requests
  if (intent === 'ticket_status' && extracted_data.ticket_id) {
    const ticketId = extracted_data.ticket_id;
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

  // Handle list tickets requests
  if (intent === 'list_tickets') {
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

  // Handle general help and ticket creation
  if (intent === 'general_help' || intent === 'create_ticket' || intent === 'other') {
    // GPT + KB fallback
    const kbArticles = await fetchFreshServiceArticles(sanitizeMessage);
    const kbText = kbArticles.map(article => `- ${article.title}: ${article.content}`).join('\n');

    const gptMessages = [
      {
        role: 'system',
        content: `You are an internal IT Help Desk assistant for INB.
                  Use the following FreshService knowledge base to help the user:\n\n${kbText || 'No articles found.'}
                  If the user seems to want help beyond knowledge base, gently ask if they'd like to open a help desk ticket.`,
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

      // Check if user wants to create a ticket
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
  }

  // Fallback for unhandled intents
  const reply = "I'm not sure how to help with that. Could you please rephrase your request?";
  const newChatId = await logChat(uid, sanitizeMessage, reply, chatId);
  return res.json({ reply, chatId: newChatId || chatId });
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

  //Decision logic - Use OpenAI for better intent detection
  let botReply;
  try {
    const confirmationResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `The user was shown a ticket preview and asked if they want to submit it. 
          Based on their response, determine if they want to:
          1. "submit" - Submit the ticket
          2. "cancel" - Cancel/don't submit the ticket
          3. "unclear" - Response is unclear
          
          Respond with only one word: "submit", "cancel", or "unclear"`
        },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.1
    });

    const decision = confirmationResponse.choices?.[0]?.message?.content?.trim().toLowerCase();
    
    if (decision === 'submit') {
      //Use stored ticket preview to submit the actual ticket
      await submitFreshServiceTicketFromPreview(ticketPreview, uid, attachmentUrls);
      botReply = '✅ Your help desk ticket has been submitted successfully.';
    } else if (decision === 'cancel') {
      botReply = 'Okay, no ticket has been created. Let me know if you need anything else.';
    } else {
      botReply = 'I\'m not sure if you want to submit the ticket or not. Please let me know if you\'d like to submit it or cancel.';
    }
  } catch (error) {
    console.error('Error determining confirmation intent:', error);
    // Fallback to simple logic
    if (intent && /yes|sure|please|yeah|submit|go ahead/i.test(intent)) {
      try {
        await submitFreshServiceTicketFromPreview(ticketPreview, uid, attachmentUrls);
        botReply = '✅ Your help desk ticket has been submitted successfully.';
      } catch (error) {
        console.error('Error submitting ticket:', error);
        botReply = 'Sorry, there was an issue submitting your ticket.';
      }
    } else {
      botReply = 'Okay, no ticket has been created. Let me know if you need anything else.';
    }
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