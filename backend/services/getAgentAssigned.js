import axios from 'axios';

export async function getAgentAssigned(id) {
  try {
    const response = await axios.get(
      `https://inbhelpdesk.freshservice.com/api/v2/agents/${id}`,
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

    console.log('✅ Agent assigned:', response.data);
    return response.data;

  } catch (error) {
    console.error('❌ Failed to fetch agent assigned:', error.response?.data || error.message);
    throw new Error('Failed to fetch agent assigned from FreshService');
  }
}