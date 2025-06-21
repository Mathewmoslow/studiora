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

  console.log('API Key exists:', !!process.env.OPENAI_API_KEY);
  
  try {
    const { courseName, content } = req.body;
    
    if (!courseName || !content) {
      return res.status(400).json({ error: 'Missing courseName or content' });
    }
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{
        role: 'system',
        content: `Extract all assignments and events from course content. 
        Return JSON with two arrays:
        - assignments: [{title, date, type, hours}]
        - events: [{title, date, type, hours}]
        Use ISO date format (YYYY-MM-DD). Estimate hours if not specified.`
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
    console.error('OpenAI Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to extract assignments', 
      details: error.message 
    });
  }
}