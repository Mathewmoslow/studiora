// server.js - ES Module version
import express from 'express';
import OpenAI from 'openai';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Extract assignments endpoint
app.post('/api/extract-assignments', async (req, res) => {
  console.log('Received request for:', req.body.courseName);
  
  try {
    const { courseName, content } = req.body;
    
    if (!content || !courseName) {
      return res.status(400).json({ 
        error: 'Missing required fields: courseName and content' 
      });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Extract all assignments and events from course content. 
          Return JSON with two arrays:
          - assignments: [{title, date, type, hours}]
          - events: [{title, date, type, hours}]
          Use ISO date format. Estimate hours if not specified.`
        },
        {
          role: 'user',
          content: `Course: ${courseName}\n\n${content}`
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    // Ensure arrays exist
    result.assignments = result.assignments || [];
    result.events = result.events || [];
    
    console.log(`Extracted ${result.assignments.length} assignments and ${result.events.length} events`);
    
    res.json(result);
  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to extract assignments' 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'Configured ✓' : 'Missing ✗'}`);
});