//DEV ONLY! Disable TLS
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

//IMPORTS
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

//Port
const PORT = 5000;

//Load environment variables
dotenv.config();

//Create app
const app = express();

//Middleware (CORS) and JSON parsing
app.use(cors());
app.use(express.json());

//Create OpenAI client instance with API Key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

//Post Request Handler for /api/chat
app.post('/api/chat', async (req, res) => {

  //Extract user message from request body (frontend)
  const userMessage = req.body.message;

  //Create an array of messages to send to OpenAI
  // The first message is the system prompt with knowledge base
  const messages = [
    {
      role: 'system',
      content: `You are an internal IT Help Desk assistant. Use the following knowledge base to answer questions:
- Q: How do I reset my password?
  A: Visit https://passwordreset.company.com.
- Q: How do I connect to the VPN?
  A: Open Cisco AnyConnect and sign in with your domain credentials.
- Q: How do I request software?
  A: Submit a request at https://servicedesk.company.com.
If unsure, ask the user to submit a help desk ticket.`,
    },
    {
      role: 'user',
      content: userMessage,
    },
  ];

  //Send messages to OpenAI and get the response
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
    });

    //Extract bot's reply from the response
    const botReply = completion.choices?.[0]?.message?.content?.trim();

    //Log in console for debugging
    console.log('GPT Reply', botReply);

    //Send the bot's reply back to the frontend
    res.json({ reply: botReply || "GPT is currently unavailable." });
  } catch (err) {

    //Log error for debugging
    console.error('OPENAI Error', err);

    //Send error response to frontend
    res.json({ reply: "GPT is currently unavailable." });
  }
});

//Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));


