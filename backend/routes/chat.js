import express from 'express';
import openai from '../config/openai.js';
import { fetchFreshServiceArticles } from '../services/freshService.js';
import { logChat } from '../services/firestore.js';
import { submitFreshServiceTicket } from '../services/freshServiceTicket.js';

const router = express.Router();

router.post('/chat', async (req, res) => {
  const userMessage = req.body.message;

  //Check if user wants to submit a ticket
  const intentResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
        {role: 'system', content: 'You are an internal INB IT Help Desk assistant. Determine if the user wants to submit a help desk ticket.'},
        {role: 'user', content: userMessage},
    ],
  });

  const intent = intentResponse.choices?.[0]?.message?.content?.toLowerCase(); //Grabs content in response  

  if (intent.includes('yes') || intent.includes('sure') || intent.includes('please') || intent.includes('yeah')) {
    // User agrees to create ticket
    try {
      await submitFreshServiceTicket(userMessage); //Call FreshService POST API
      const botReply = '✅ Your help desk ticket has been submitted successfully.';
      await logChat(userMessage, botReply);
      return res.json({ reply: botReply });
    } catch (error) {
      console.error('Error submitting ticket:', error);
      const botReply = 'Sorry, there was an issue submitting your ticket. Please try again later.';
      await logChat(userMessage, botReply);
      return res.json({ reply: botReply });
    }
  }

  //Look through knowledgebase articles.
  const kbArticles = await fetchFreshServiceArticles(userMessage);
  const kbText = kbArticles.map(article => `- ${article.title}: ${article.content}`).join('\n');

  const messages = [
    {
      role: 'system',
      content: `You are an internal INB IT Help Desk assistant. Use the following FreshService knowledge base to help users:\n\n${kbText || 'No articles found. Ask the user to submit a help desk ticket.'}`,
    },
    {
      role: 'user',
      content: userMessage,
    },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
    });

    const botReply = completion.choices?.[0]?.message?.content?.trim();
    await logChat(userMessage, botReply);
    res.json({ reply: botReply || 'GPT is currently unavailable.' });
  } catch (err) {
    console.error('OPENAI Error', err);
    const botReply = ('GPT is currently unavailable.');
    await logChat(userMessage, botReply);
    res.json({ reply: botReply});
  }
});

export default router;