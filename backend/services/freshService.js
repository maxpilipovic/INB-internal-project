import axios from 'axios';

export async function fetchFreshServiceArticles(searchTerm) {
  try {
    const response = await axios.get(
      'https://inbhelpdesk.freshservice.com/api/v2/solutions/articles/search',
      {
        params: { search_term: searchTerm },
        auth: {
          username: process.env.FRESHSERVICE_API_KEY,
          password: 'X',
        },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.articles.slice(0, 5).map(article => ({
      title: article.title || 'No Title',
      content: article.description_text ? article.description_text.trim() : 'No description available',
    }));
  } catch (error) {
    console.error('Error fetching from FreshService:', error.message);
    return [];
  }
}