import axios from 'axios';

export async function getFreshServiceTicketById(ticketId) {
  try {
    const response = await axios.get(
      `https://inbhelpdesk.freshservice.com/api/v2/tickets/${ticketId}`,
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

    return response.data.ticket;
  } catch (error) {
    console.error('Ticket fetch error:', error.response?.data || error.message);
    throw error;
  }
}

export default getFreshServiceTicketById;