// api/extract-assignments.js
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { courseName, content } = req.body;
    
    if (!courseName || !content) {
      return res.status(400).json({ error: 'Missing courseName or content' });
    }
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{
        role: 'system',
        content: `You are an expert at extracting assignments and events from course materials.
        
Extract ALL assignments, quizzes, exams, projects, and scheduled events.

Return JSON with two arrays:
1. assignments: Array of assignment objects
2. events: Array of scheduled events

For assignments include:
- title: Clear, concise title
- date: Due date in ISO format (YYYY-MM-DD) or null if not specified
- type: One of: reading, quiz, assignment, project, exam, discussion, paper, presentation, lab, clinical
- hours: Estimated hours needed (be realistic)

For events include:
- title: Event name
- date: Date in ISO format or null
- type: One of: class, lab, clinical, review, other
- hours: Duration

Be thorough - extract EVERYTHING that looks like an assignment or event.`
      }, {
        role: 'user',
        content: `Course: ${courseName}\n\n${content}`
      }],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    
    // Ensure arrays exist
    result.assignments = result.assignments || [];
    result.events = result.events || [];
    
    res.status(200).json(result);
  } catch (error) {
    console.error('OpenAI Error:', error);
    res.status(500).json({ 
      error: 'Failed to extract assignments', 
      details: error.message 
    });
  }
}