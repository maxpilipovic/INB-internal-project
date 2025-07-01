import openai from '../config/openai.js';

export async function generateTitleFromMessage(userMessage) {
  const prompt = `
  Based on this user message, generate a short and relevant chat title (max 5 words). Focus on summarizing the goal or main topic.

  Message: "${userMessage}"

  Title:
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You summarize user messages into short titles.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content.trim();
}