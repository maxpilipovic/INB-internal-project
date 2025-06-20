import axios from 'axios';

export async function getTicketConversations(ticketId) {
  try {
    const response = await axios.get(
      `https://inbhelpdesk.freshservice.com/api/v2/tickets/${ticketId}/conversations`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        auth: {
          username: process.env.FRESHSERVICE_API_KEY,
          password: 'X',
        },
      }
    );

    return response.data.conversations;
  } catch (error) {
    console.error('Ticket fetch error:', error.response?.data || error.message);
    throw error;
  }
}

export default getTicketConversations;