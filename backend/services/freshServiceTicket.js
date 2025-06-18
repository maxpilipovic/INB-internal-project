import axios from 'axios';
import openai from '../config/openai.js';
import { db } from '../config/firebase.js';
import fetch from 'node-fetch';

async function generateTicketDetails(userMessage) {

     const systemPrompt = `
You are an AI assistant helping an IT support team. 
Given a user's message, generate a JSON object with the following fields:
- subject: a brief title of the issue
- description: a clear, professional summary
- priority: 1 (Low), 2 (Medium), 3 (High), or 4 (Urgent) depending on urgency

Return only the JSON. Example:
{
  "subject": "Cannot access Outlook email",
  "description": "The user is experiencing issues accessing their Outlook email account. They have tried restarting their computer and checking internet connectivity.",
  "priority": 2
}
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.4, //DONT KNOW WHAT TEMP IS? OPENAI SUGGESTED
  });

  const json = completion.choices?.[0]?.message?.content;

  try {
    return JSON.parse(json);
  } catch (error) {
    console.error('Error parsing JSON:', error);

    return {
        subject: 'User reported an issue',
        description: 'userMessage',
        priority: 2,
    };
  }
}

export async function submitFreshServiceTicket(userMessage, uid) {
  try {
    //Lookup user email from Firestore
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) throw new Error('User not found in Firestore');
    const userEmail = userDoc.data().email;

    //Generate details with GPT
    const ticketDetails = await generateTicketDetails(userMessage);

    //Construct the payload
    const payload = {
      description: ticketDetails.description,
      subject: ticketDetails.subject,
      email: userEmail, //REAL EMAIL
      priority: ticketDetails.priority,
      status: 2,
      workspace_id: 2,
    };

    //Submit to FreshService
    const response = await axios.post(
      'https://inbhelpdesk.freshservice.com/api/v2/tickets',
      payload,
      {
        auth: {
          username: process.env.FRESHSERVICE_API_KEY,
          password: 'X',
        },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Ticket submitted:', response.data);
    return response.data;

  } catch (error) {
    console.error('❌ Failed to submit FreshService ticket:', error.response?.data || error.message);
    throw error;
  }
}

export default submitFreshServiceTicket;