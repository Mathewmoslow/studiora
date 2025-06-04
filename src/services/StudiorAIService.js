// src/services/StudiorAIService.js
// Option 5: AI Service with OpenAI Function Calling

export class StudiorAIService {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.model = options.model || import.meta.env.VITE_AI_MODEL || 'gpt-4o';
    this.baseURL = options.baseURL || 'https://api.openai.com/v1';
    this.timeout = parseInt(import.meta.env.VITE_AI_TIMEOUT) || 60000;
    this.maxRetries = 2;
    
    console.log(`🤖 Studiora AI initialized: ${this.model} (Function Calling)`);
  }

  async parseWithFunctionCalling(text, options = {}) {
    const { alreadyFoundCount = 0, instruction = 'Parse nursing assignments' } = options;
    
    const prompt = `${instruction}

REMAINING TEXT TO ANALYZE:
${text}

Context: ${alreadyFoundCount} assignments already found by regex. Look for additional assignments in this remaining text that might have been missed - things like:
- Implicit assignments ("come prepared to discuss")
- Assignments with unusual formatting
- Reading assignments without clear "assignment" keywords
- Clinical prep work
- Study activities

Current date: ${new Date().toISOString().split('T')[0]}
Academic semester: Spring 2025 (May 5 - August 10, 2025)

Find ALL additional assignments in this text.`;

    const functionSchema = {
      name: 'parse_nursing_assignments',
      description: 'Extract nursing assignments, events, and modules from educational content',
      parameters: {
        type: 'object',
        properties: {
          assignments: {
            type: 'array',
            description: 'List of assignments found in the text',
            items: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  description: 'Complete description of the assignment'
                },
                date: {
                  type: 'string',
                  description: 'Due date in YYYY-MM-DD format'
                },
                type: {
                  type: 'string',
                  enum: ['quiz', 'exam', 'reading', 'assignment', 'video', 'discussion', 'clinical', 'simulation', 'prep', 'activity'],
                  description: 'Type of assignment'
                },
                hours: {
                  type: 'number',
                  description: 'Estimated study hours needed',
                  minimum: 0.25,
                  maximum: 8
                },
                course: {
                  type: 'string',
                  enum: ['nclex', 'obgyn', 'adulthealth', 'geronto', 'unknown'],
                  description: 'Course category'
                },
                confidence: {
                  type: 'number',
                  description: 'Confidence level (0-1)',
                  minimum: 0,
                  maximum: 1
                },
                extractionReason: {
                  type: 'string',
                  description: 'Why this was identified as an assignment'
                }
              },
              required: ['text', 'date', 'type', 'hours', 'course', 'confidence']
            }
          },
          events: {
            type: 'array',
            description: 'Scheduled events like lectures, labs, exams',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                date: { type: 'string' },
                time: { type: 'string' },
                type: { type: 'string', enum: ['lecture', 'clinical', 'exam', 'simulation', 'lab'] },
                location: { type: 'string' },
                duration: { type: 'string' }
              },
              required: ['title', 'date', 'type']
            }
          },
          modules: {
            type: 'array',
            description: 'Course modules or units',
            items: {
              type: 'object',
              properties: {
                number: { type: 'integer' },
                title: { type: 'string' },
                course: { type: 'string' },
                weekRange: { type: 'string' },
                keyTopics: { type: 'string' }
              },
              required: ['number', 'title']
            }
          }
        },
        required: ['assignments']
      }
    };

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at parsing nursing education content. Use the provided function to structure your findings.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          functions: [functionSchema],
          function_call: { name: 'parse_nursing_assignments' },
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const functionCall = data.choices[0]?.message?.function_call;
      
      if (!functionCall || functionCall.name !== 'parse_nursing_assignments') {
        throw new Error('Function calling failed - no valid function call returned');
      }

      const result = JSON.parse(functionCall.arguments);
      console.log(`✅ Function calling success: ${data.usage?.total_tokens || 'unknown'} tokens used`);
      
      return this.validateAndEnhanceResult(result);

    } catch (error) {
      console.error('🤖 Function calling failed:', error);
      throw error;
    }
  }

  validateAndEnhanceResult(result) {
    // Ensure arrays exist
    result.assignments = result.assignments || [];
    result.modules = result.modules || [];
    result.events = result.events || [];

    // Validate and enhance assignments
    result.assignments = result.assignments
      .filter(a => a.text && a.text.length > 5)
      .map(assignment => ({
        id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: assignment.text,
        date: this.validateDate(assignment.date),
        type: assignment.type || 'assignment',
        hours: Math.max(0.25, Math.min(8, assignment.hours || 1.5)),
        course: assignment.course || 'unknown',
        confidence: Math.max(0.1, Math.min(1, assignment.confidence || 0.8)),
        extractionReason: assignment.extractionReason || 'AI identified additional assignment'
      }));

    return result;
  }

  validateDate(dateString) {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      
      // Ensure within academic year
      if (date.getFullYear() !== 2025) return null;
      
      return date.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default StudiorAIService;