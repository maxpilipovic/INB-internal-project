import axios from 'axios';
import openai from '../config/openai.js';
import { db } from '../config/firebase.js';
import fs from 'fs';

export async function generateTicketDetailsFromHistory(history) {
  const userOnly = history
  .filter(msg => msg.role === 'user')
  .map(msg => `- ${msg.content}`)
  .join('\n');

  const systemPrompt = `
You are an IT Help Desk assistant. Based on the user's messages below, generate a FreshService help desk ticket with:
- "subject": a short, clear title (5-8 words)
- "description": a detailed explanation based on the user's problem
- "priority": 1 (Low), 2 (Medium), 3 (High), or 4 (Urgent)

Follow these **Priority Rules**:
- Use priority 4 (Urgent) if the user mentions:
  - system-wide outage
  - urgent business impact
  - security or data breach
- Use priority 2 (Medium) for login problems, password resets, or email access issues
- Use priority 1 (Low) for general questions, how-to requests, or minor inconveniences
- Use priority 3 (High) if the issue is blocking but not critical (e.g., can't print, software crashes, local network issues)

Respond with **only** valid JSON. No extra commentary or explanation.

Example:
{
  "subject": "Outlook email access error",
  "description": "User cannot access Outlook on mobile. Tried restarting, still fails. Error says 'Permission denied' on iPhone.",
  "priority": 2
}

Here is the user chat history:
${userOnly}
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userOnly }
    ],
    temperature: 0.4,
  });

  const content = completion.choices?.[0]?.message?.content;

  try {
    return JSON.parse(content);
  } catch {
    console.error('Failed to parse GPT ticket details.');
    return {
      subject: 'User-reported issue',
      description: userOnly,
      priority: 2,
    };
  }
}

export async function submitFreshServiceTicket(history, uid, attachmentUrls = []) {
  try {
    // Lookup user email from Firestore
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) throw new Error('User not found in Firestore');
    const userEmail = userDoc.data().sanitizedEmail;

    // Generate ticket details using GPT
    const ticketDetails = await generateTicketDetailsFromHistory(history);

    // Combine URLs into the description if any
    const descriptionWithLinks = attachmentUrls.length
      ? `${ticketDetails.description}\n\nAttached files:\n${attachmentUrls.map((url, i) => `File ${i + 1}: ${url}`).join('\n')}`
      : ticketDetails.description;

    // No attachments — regular JSON payload
    const payload = {
      subject: ticketDetails.subject,
      description: descriptionWithLinks,
      email: userEmail,
      priority: ticketDetails.priority,
      status: 2,
      workspace_id: 2,
    };

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

export async function submitFreshServiceTicketFromPreview(ticketPreview, uid, attachmentUrls = []) {
  const { subject, description, priority } = ticketPreview;

  // Use existing method but pass explicitly generated fields
  return await submitFreshServiceTicket(
    [
      { role: 'user', content: subject },
      { role: 'assistant', content: description }
    ],
    uid,
    attachmentUrls,
    { subject, description, priority }
  );
}
