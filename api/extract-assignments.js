// api/extract-assignments.js - Optimized version
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Helper to clean AI responses
const cleanAIResponse = (response) => {
  let cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/gi, '');
  const jsonStart = Math.min(
    cleaned.indexOf('{') > -1 ? cleaned.indexOf('{') : Infinity,
    cleaned.indexOf('[') > -1 ? cleaned.indexOf('[') : Infinity
  );
  if (jsonStart !== Infinity) {
    cleaned = cleaned.substring(jsonStart);
  }
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const jsonEnd = Math.max(lastBrace, lastBracket);
  if (jsonEnd > -1) {
    cleaned = cleaned.substring(0, jsonEnd + 1);
  }
  return cleaned.trim();
};

// Main extraction prompt
const createExtractionPrompt = (content, courseName) => {
  const today = new Date().toISOString().split('T')[0];
  
  return `Extract ALL assignments and events from this ${courseName} course content.

TODAY: ${today}
SEMESTER: Spring 2025 (May 5 - Aug 10, 2025)

ASSIGNMENT PATTERNS TO FIND:
• Direct: "Assignment:", "Quiz:", "Exam:", "Due:"
• Imperatives: complete, submit, bring, prepare, review, study, read
• Requirements: "students must", "required", "mandatory"
• Prep work: "before class", "prior to", "by [date]"
• Clinical/Lab: "bring to clinical", "lab prep", "simulation"

EVENT PATTERNS:
• Classes: "meets", "class time", "lecture"
• Clinical: "clinical rotation", "clinical hours"
• Lab: "lab session", "skills lab"

CONTENT TO ANALYZE:
${content.substring(0, 4000)}${content.length > 4000 ? '...[truncated]' : ''}

OUTPUT THIS EXACT JSON FORMAT:
{
  "assignments": [
    {
      "title": "clear, concise title",
      "date": "YYYY-MM-DD or null",
      "type": "reading|quiz|assignment|project|exam|discussion|paper|presentation|lab|clinical",
      "hours": 2.0,
      "description": "any additional details"
    }
  ],
  "events": [
    {
      "title": "event name",
      "date": "YYYY-MM-DD or null",
      "type": "class|lab|clinical|review|exam",
      "hours": 1.5,
      "time": "HH:MM or null",
      "location": "location or null"
    }
  ]
}

IMPORTANT:
- Extract EVERYTHING that looks like an assignment
- Convert all dates to YYYY-MM-DD format
- Estimate realistic hours based on type
- Keep titles short but descriptive`;
};

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
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }
    
    // Make the API call
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{
        role: 'system',
        content: 'You are an expert at extracting assignments from course materials. Always return valid JSON.'
      }, {
        role: 'user',
        content: createExtractionPrompt(content, courseName)
      }],
      temperature: 0.3,
      max_tokens: 2000
    });
    
    // Clean and parse the response
    const rawResponse = response.choices[0].message.content;
    const cleanedResponse = cleanAIResponse(rawResponse);
    
    let result;
    try {
      result = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Parse error:', parseError);
      console.error('Raw response:', rawResponse);
      console.error('Cleaned response:', cleanedResponse);
      
      // Return empty arrays if parsing fails
      result = { assignments: [], events: [] };
    }
    
    // Ensure arrays exist and add metadata
    result.assignments = (result.assignments || []).map(a => ({
      ...a,
      course: courseName,
      extractedAt: new Date().toISOString()
    }));
    
    result.events = (result.events || []).map(e => ({
      ...e,
      course: courseName,
      extractedAt: new Date().toISOString()
    }));
    
    console.log(`Extracted ${result.assignments.length} assignments and ${result.events.length} events for ${courseName}`);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('OpenAI Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to extract assignments', 
      details: error.message 
    });
  }
}