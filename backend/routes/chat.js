import express from 'express';
import openai from '../config/openai.js';
import { fetchFreshServiceArticles } from '../services/freshService.js';
import { logChat } from '../services/firestore.js';
import { submitFreshServiceTicket } from '../services/freshServiceTicket.js';

const router = express.Router();

router.post('/chat', async (req, res) => {
  //const userMessage = req.body.message;
  const { message: userMessage, uid } = req.body;

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

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: gptMessages,
    });

    const botReply = completion.choices?.[0]?.message?.content?.trim();

    //3.Log the response
    await logChat(uid, userMessage, botReply);

    const wantsTicket = /submit.*ticket|create.*ticket|help desk ticket|i need.*help/i.test(userMessage) || 
                    /should I create.*ticket|would you like.*ticket|I couldn’t find a good answer/i.test(botReply);

                    
    //4.Check if bot is offering to create a ticket (based on trigger phrase)
    if (wantsTicket) {
      return res.json({ 
        reply: botReply, 
        awaitingTicketConfirmation: true, 
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

router.post('/chat/confirm-ticket', async (req, res) => {
  //const userConfirmation = req.body.message;
  //const ticketContext = req.body.ticketContext || 'User did not provide issue context.';
  const { message: userConfirmation, ticketContext = 'User did not provide issue context.', uid } = req.body;

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
      await submitFreshServiceTicket(ticketContext); // <-- use original issue here
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