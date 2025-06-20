// src/services/StudiorAIService.js
// Studiora's AI Service - Sequential enhancement mode with validation

export class StudiorAIService {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.model = options.model || 'gpt-4o'; // Changed from 'gpt-4' to 'gpt-4o' for 128k context
    this.baseURL = options.baseURL || 'https://api.openai.com/v1';
    this.timeout = options.timeout || 120000;
    this.maxRetries = options.maxRetries || 3;
  }

  async makeRequest(prompt, options = {}) {
    const { temperature, taskType, maxTokens } = options;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

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
                content: this.getSystemPrompt(taskType)
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: temperature || 0.3,
            max_tokens: maxTokens || 16000  // Much higher default for GPT-4o
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`API error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        
        if (!data.choices?.[0]?.message?.content) {
          throw new Error('Invalid API response format');
        }

        // Extract content and clean it
        let content = data.choices[0].message.content;
        
        // Remove markdown code blocks if present
        content = content.replace(/^```json\s*\n?/i, '');
        content = content.replace(/\n?```\s*$/i, '');
        content = content.trim();
        
        // Try to parse JSON
        let result;
        try {
          result = JSON.parse(content);
        } catch (parseError) {
          console.error('Failed to parse AI response:', content);
          throw new Error(`Invalid JSON response: ${parseError.message}`);
        }
        
        // Add metadata
        result._meta = {
          model: this.model,
          taskType,
          attempt,
          timestamp: Date.now(),
          tokensUsed: data.usage?.total_tokens,
          studiorVersion: '1.0.0'
        };
        
        return result;

      } catch (error) {
        console.warn(`🤖 Studiora AI attempt ${attempt} failed:`, error.message);
        
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
  }

  // STAGE 2: Parse remainder text after regex extraction
  async parseRemainder(remainingText, context) {
    if (!this.apiKey) {
      throw new Error('AI service requires API key');
    }

    const prompt = `You are analyzing REMAINDER text after regex extraction. The regex parser has already found these assignments:

EXISTING ASSIGNMENTS FOUND BY REGEX:
${JSON.stringify(context.existingAssignments, null, 2)}

DOCUMENT TYPE: ${context.documentType}
COURSE: ${context.course}

REMAINING TEXT TO ANALYZE:
${remainingText}

Your task is to find ONLY NEW assignments that the regex parser missed. Look for:
- Implicit assignments ("be prepared to discuss", "review before class")
- Assignments in unusual formats
- Assignments mentioned in context but not as clear directives
- Preparation requirements for labs/clinicals
- Hidden deadlines in narrative text

DO NOT re-extract assignments already found by regex.

RESPOND WITH ONLY VALID JSON (no markdown, no code blocks):
{
  "assignments": [
    {
      "text": "Assignment description",
      "date": "YYYY-MM-DD or null",
      "type": "reading|quiz|exam|assignment|lab|discussion|clinical|simulation|prep",
      "hours": 1.5,
      "course": "${context.course}",
      "confidence": 0.8,
      "extractionReason": "Why this was identified as a NEW assignment"
    }
  ]
}`;

    try {
      const result = await this.makeRequest(prompt, {
        temperature: 0.3,
        taskType: 'remainder-parsing',
        maxTokens: 4000
      });

      // Validate and enhance the result
      return {
        assignments: (result.assignments || []).map((assignment, idx) => ({
          ...assignment,
          id: assignment.id || `ai_remainder_${Date.now()}_${idx}`,
          date: this.validateDate(assignment.date),
          source: 'ai-remainder'
        }))
      };
    } catch (error) {
      console.error('🤖 AI remainder parsing failed:', error);
      throw error;
    }
  }

  // STAGE 3: Validate and enhance regex results
  async validateAssignments(validationRequest) {
    if (!this.apiKey) {
      throw new Error('AI service requires API key');
    }

    const { originalText, regexAssignments, documentType, course } = validationRequest;

    const prompt = `You are validating and enhancing assignments found by regex parsing.

ORIGINAL DOCUMENT (first 3000 chars):
${originalText}

DOCUMENT TYPE: ${documentType}
COURSE: ${course}

REGEX FOUND THESE ASSIGNMENTS:
${JSON.stringify(regexAssignments.map(a => ({
  text: a.text,
  date: a.date,
  type: a.type,
  points: a.points,
  module: a.module
})), null, 2)}

YOUR TASKS:
1. VALIDATE each assignment (is it real or a false positive?)
2. FIX missing dates by looking at context
3. IMPROVE vague descriptions using surrounding text
4. STANDARDIZE assignment types
5. ADD missing information (points, hours, etc.)
6. FLAG invalid entries for removal

For dates, consider:
- Module/week context
- Sequence of assignments
- Academic calendar (Spring 2025: May 5 - August 10)
- Typical patterns (quizzes on Fridays, etc.)

RESPOND WITH ONLY VALID JSON (no markdown, no code blocks):
{
  "validatedAssignments": [
    {
      "originalIndex": 0,
      "isValid": true,
      "text": "Enhanced assignment description",
      "date": "YYYY-MM-DD",
      "type": "standardized_type",
      "hours": 1.5,
      "points": 10,
      "course": "${course}",
      "confidence": 0.95,
      "enhancementNotes": "What was improved"
    }
  ],
  "confidence": 0.85,
  "insights": [
    "Pattern noticed or recommendation"
  ]
}`;

    try {
      const result = await this.makeRequest(prompt, {
        temperature: 0.2,
        taskType: 'validation-enhancement',
        maxTokens: 8000
      });

      // Map validated assignments back with original IDs
      const validatedAssignments = [];
      
      (result.validatedAssignments || []).forEach(validated => {
        if (validated.isValid && validated.originalIndex < regexAssignments.length) {
          const original = regexAssignments[validated.originalIndex];
          validatedAssignments.push({
            ...original,
            ...validated,
            id: original.id,
            aiEnhanced: true,
            date: this.validateDate(validated.date) || original.date
          });
        }
      });

      return {
        validatedAssignments,
        confidence: result.confidence || 0.7,
        insights: result.insights || []
      };
    } catch (error) {
      console.error('🤖 AI validation failed:', error);
      throw error;
    }
  }

  getSystemPrompt(taskType) {
    const basePrompt = `You are Studiora's AI assistant, an expert in nursing education content parsing. You specialize in:
- Nursing curricula (OB/GYN, Adult Health, NCLEX prep, Gerontology)
- Academic assignment extraction
- Educational content analysis
- Date interpretation and conversion
- Learning objective identification

Always respond with ONLY valid JSON format. No markdown, no code blocks, no extra text.`;

    switch (taskType) {
      case 'remainder-parsing':
        return `${basePrompt}

Your task is REMAINDER PARSING. You are analyzing text that remains AFTER regex extraction.
- The regex parser has already processed the document and extracted obvious assignments
- You are ONLY looking at what's left over
- Find implicit assignments, unusual formats, and missed items
- DO NOT re-extract what regex already found
- Focus on context clues and implications`;

      case 'validation-enhancement':
        return `${basePrompt}

Your task is VALIDATION AND ENHANCEMENT of regex results.
- Validate EVERY assignment to ensure it's real
- Convert ALL relative dates to absolute dates
- Improve unclear descriptions using context
- Add missing information from surrounding text
- Standardize formatting and structure
- Flag any false positives for removal`;

      case 'final-consolidation':
        return `${basePrompt}

Your task is FINAL CONSOLIDATION of all parsed assignments.
- Merge assignments from enhanced regex and AI remainder parsing
- Identify and resolve any duplicates
- Ensure consistent formatting
- Order assignments logically by date
- Create the final authoritative list`;

      case 'sequential-enhancement':
        return `${basePrompt}

Your task is SEQUENTIAL ENHANCEMENT. A regex parser has already extracted assignments. You must:
- Validate EVERY assignment found by regex (mandatory)
- Find and fix missing dates by looking at context
- Identify any assignments the regex parser missed
- Flag invalid entries that aren't real assignments
- Improve accuracy of extracted information`;

      default:
        return basePrompt;
    }
  }

  validateDate(dateString) {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      
      // Ensure date is within reasonable academic bounds
      const minDate = new Date('2025-01-01');
      const maxDate = new Date('2025-12-31');
      
      if (date < minDate || date > maxDate) return null;
      
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