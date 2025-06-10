//DEV ONLY!
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

//Load environment variables
dotenv.config();

//Create app
const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.message;

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

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
    });

    const botReply = completion.choices?.[0]?.message?.content?.trim();
    console.log('GPT Reply', botReply);

    res.json({ reply: botReply || "GPT is currently unavailable." });
  } catch (err) {
    console.error('OPENAI Error', err);
    res.json({ reply: "GPT is currently unavailable." });
  }
});

//Start server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));


