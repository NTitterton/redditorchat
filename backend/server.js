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
  if (userCommentsCache.has(username)) {
    return userCommentsCache.get(username);
  }

  try {
    const response = await axios.get(
      `https://www.reddit.com/user/${username}/comments.json?limit=50`
    );
    
    const comments = response.data.data.children
      .map(child => child.data.body)
      .join('\n\n');
    
    userCommentsCache.set(username, comments);
    return comments;
  } catch (error) {
    console.error('Error fetching Reddit comments:', error);
    throw new Error('Failed to fetch user comments');
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
    const userComments = await fetchUserComments(username);

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are simulating the Reddit user ${username}. Here are their recent comments to understand their writing style and personality:\n\n${userComments}\n\nRespond to messages in a way that matches their writing style and personality. Keep responses concise and natural, as if in a casual conversation.`
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    res.json({ response: completion.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 