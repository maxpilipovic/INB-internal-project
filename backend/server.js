//DEV ONLY! Disable TLS
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

//IMPORTS
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import axios from 'axios';

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

async function fetchFreshServiceArticles(searchTerm) {
  try {
    const response = await axios.get(
      `https://inbhelpdesk.freshservice.com/api/v2/solutions/articles/search`,
      {
        params: { search_term: searchTerm },
        auth: {
          username: process.env.FRESHSERVICE_API_KEY, //API KEY YES
          password: 'X' //Password
        },
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    //Extract titles & description.text
    const results = response.data.articles.map(article => ({
      title: article.title || 'No Title',
      content: article.description_text ? article.description_text.trim() : 'No description available',
    }));

    console.log(`✅ Found ${results.length} KB articles for "${searchTerm}"`);
    results.forEach((a, i) => {
      console.log(`Article ${i + 1}: ${a.title} -> ${a.content.slice(0, 100)}...`);
    });

    return results;
  } catch (error) {
    console.error("Error fetching from FreshService:", error.message);
    return [];
  }
}

//Post Request Handler for /api/chat
app.post('/api/chat', async (req, res) => {

  //Extract user message from request body (frontend)
  const userMessage = req.body.message;
  const searchTerm = userMessage;

  const kbArticles = await fetchFreshServiceArticles(searchTerm);

  const kbText = kbArticles.map(article => `- ${article.title}: ${article.content}`).join('\n');

  //Create an array of messages to send to OpenAI
  // The first message is the system prompt with knowledge base
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

  //Send messages to OpenAI and get the response
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
    });

    //Extract bot's reply from the response
    const botReply = completion.choices?.[0]?.message?.content?.trim();

    //Log in console for debugging
    //console.log('GPT Reply', botReply);

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


