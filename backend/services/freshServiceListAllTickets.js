import axios from 'axios';

export async function listFreshServiceTicketsByEmail(email) {
  try {
    const response = await axios.get(
      `https://inbhelpdesk.freshservice.com/api/v2/tickets?email=${encodeURIComponent(email)}`,
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

    console.log('✅ Tickets fetched:', response.data);
    return response.data.tickets;

  } catch (error) {
    console.error('❌ Failed to fetch FreshService tickets:', error.response?.data || error.message);
    throw new Error ('Failed to fetch tickets from FreshService');
  }
}

export default listFreshServiceTicketsByEmail;

