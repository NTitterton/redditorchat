require('dotenv').config();

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const axios = require('axios');

const app = express();
const port = 3001;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());

// Cache for storing user comments
const userCommentsCache = new Map();

async function fetchUserComments(username) {
  console.log(`Attempting to fetch comments for user: ${username}`);
  
  if (userCommentsCache.has(username)) {
    console.log('Returning cached comments');
    return userCommentsCache.get(username);
  }

  try {
    console.log(`Making Reddit API request for ${username}'s comments`);
    const response = await axios.get(
      `https://www.reddit.com/user/${username}/comments.json?limit=50`
    );
    
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
      statusText: error.response?.statusText
    });
    throw new Error(`Failed to fetch user comments: ${error.message}`);
  }
}

app.post('/initialize-chat', async (req, res) => {
  try {
    const { username } = req.body;
    await fetchUserComments(username);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/chat', async (req, res) => {
  try {
    const { message, username } = req.body;
    console.log(`Chat request received for user ${username}:`, message);

    const userComments = await fetchUserComments(username);
    console.log('Retrieved comments, preparing OpenAI request');

    const systemPrompt = `You are simulating the Reddit user ${username}. Here are their recent comments to understand their writing style and personality:\n\n${userComments}\n\nRespond to messages in a way that matches their writing style and personality. Keep responses concise and natural, as if in a casual conversation.`;
    
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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 