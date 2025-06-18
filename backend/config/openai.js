import OpenAI from 'openai';
import dotenv from 'dotenv';

//INITALIZES OPENAI CLIENT

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default openai;