require('dotenv').config();

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const axios = require('axios');
const btoa = str => Buffer.from(str).toString('base64');

const app = express();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const USER_AGENT = 'RedditorChat/1.0.0';

app.use(cors());
app.use(express.json());

// Cache for storing user comments
const userCommentsCache = new Map();

function logRequest(req, message) {
  console.log(`[${new Date().toISOString()}] ${message}`, {
    path: req.path,
    body: req.body,
    headers: req.headers
  });
}

async function getRedditAccessToken() {
  try {
    const basicAuth = btoa(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`);
    const response = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT
        }
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Reddit access token:', error);
    throw new Error('Failed to authenticate with Reddit');
  }
}

async function fetchUserComments(username) {
  console.log(`Attempting to fetch comments for user: ${username}`);
  
  if (userCommentsCache.has(username)) {
    console.log('Returning cached comments');
    return userCommentsCache.get(username);
  }

  try {
    const accessToken = await getRedditAccessToken();
    console.log(`Making Reddit API request for ${username}'s comments`);
    const response = await axios.get(
      `https://oauth.reddit.com/user/${username}/comments?limit=50`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': USER_AGENT
        }
      }
    );
    
    if (!response.data?.data?.children?.length) {
      throw new Error('No comments found or invalid username');
    }
    
    const comments = response.data.data.children
      .map(child => child.data.body)
      .join('\n\n');
    
    console.log(`Successfully fetched ${response.data.data.children.length} comments`);
    console.log('First comment preview:', comments.slice(0, 100) + '...');
    
    userCommentsCache.set(username, comments);
    return comments;
  } catch (error) {
    console.error('Error fetching Reddit comments:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    if (error.response?.status === 403) {
      throw new Error('Unable to access Reddit API. Please try again later.');
    } else if (error.response?.status === 404) {
      throw new Error('Username not found');
    }
    
    throw new Error(`Failed to fetch user comments: ${error.message}`);
  }
}

app.post('/initialize-chat', async (req, res) => {
  logRequest(req, 'Initialize chat request received');
  try {
    const { username } = req.body;
    await fetchUserComments(username);
    console.log(`Successfully initialized chat for ${username}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Initialize chat error:', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: error.message });
  }
});

app.post('/chat', async (req, res) => {
  try {
    const { message, username } = req.body;
    console.log(`Chat request received for user ${username}:`, message);

    const userComments = await fetchUserComments(username);
    console.log('Retrieved comments, preparing OpenAI request');

    const systemPrompt = `You are simulating Reddit user ${username}. Analyze and mimic their writing style, vocabulary, and personality based on these recent comments:

${userComments}

Guidelines:
1. Match their tone, word choice, and typical response length
2. Only share opinions/knowledge that align with their comment history
3. If asked about personal details or topics not evident in their comments, respond as they might - either deflecting or stating you can't speak to that
4. Stay in character - don't break the fourth wall or acknowledge you're an AI
5. Maintain their typical level of formality/casualness
6. Use similar punctuation and capitalization patterns
7. Mirror their sense of humor and interaction style

Keep responses concise and natural, as if in a casual Reddit conversation.`;
    
    console.log('System prompt length:', systemPrompt.length);
    console.log('Making OpenAI API request...');

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    console.log('OpenAI response received:', completion.choices[0].message);
    res.json({ response: completion.choices[0].message.content });
  } catch (error) {
    console.error('Error in chat endpoint:', {
      message: error.message,
      type: error.constructor.name,
      stack: error.stack,
      openAiError: error.response?.data || 'No OpenAI error data'
    });
    res.status(500).json({ 
      error: error.message,
      details: error.response?.data || 'No additional details available'
    });
  }
});

// Move port definition to only be used in local dev
if (process.env.NODE_ENV !== 'production') {
  const port = 3001;
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

// Export the app for Lambda
module.exports = app; 