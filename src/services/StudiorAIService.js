// src/services/StudiorAIService.js
// Studiora's AI Service - Sequential enhancement mode

export class StudiorAIService {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.model = options.model || 'gpt-3.5-turbo';
    this.baseURL = options.baseURL || 'https://api.openai.com/v1';
    this.timeout = options.timeout || 90000;
    this.maxRetries = options.maxRetries || 3;
  }

  // Sequential enhancement methods
  async parseRemainder(text, regexResults, options = {}) {
    const prompt = this.buildPrompt(text, 'parse-remaining', { regexResults });
    
    try {
      const result = await this.makeRequest(prompt, {
        temperature: 0.3,
        taskType: 'parse-remaining',
        maxTokens: 3000
      });
      
      return {
        assignments: this.validateAssignments(result.assignments || [])
      };
    } catch (error) {
      console.error('🤖 AI parse remaining failed:', error);
      return { assignments: [] };
    }
  }

  async validateAndEnhance(text, regexResults, course, documentType) {
    const prompt = this.buildPrompt(text, 'validate-enhance', { 
      regexResults, 
      course, 
      documentType 
    });
    
    try {
      const result = await this.makeRequest(prompt, {
        temperature: 0.1,
        taskType: 'validate-enhance',
        maxTokens: 4000
      });
      
      // Ensure proper structure with array validation
      const validatedAssignments = Array.isArray(result.validatedAssignments) 
        ? this.validateAssignments(result.validatedAssignments)
        : [];
      
      return {
        validatedAssignments,
        removedAssignments: result.removedAssignments || [],
        enhancementSummary: result.enhancementSummary || '',
        confidence: result.confidence || 0.8
      };
    } catch (error) {
      console.error('🤖 AI validation failed:', error);
      // Ensure we return arrays even on failure
      const assignments = Array.isArray(regexResults?.assignments) ? regexResults.assignments : [];
      return {
        validatedAssignments: assignments,
        removedAssignments: [],
        enhancementSummary: 'AI validation failed - returning original assignments',
        confidence: 0.5
      };
    }
  }

  async consolidate(enhancedRegex, aiRemainder, originalText) {
    const prompt = this.buildPrompt(originalText, 'final-consolidation', {
      enhancedRegex,
      aiRemainder
    });
    
    try {
      const result = await this.makeRequest(prompt, {
        temperature: 0.1,
        taskType: 'final-consolidation',
        maxTokens: 4000
      });
      
      const consolidatedAssignments = Array.isArray(result.consolidatedAssignments) 
        ? this.validateAssignments(result.consolidatedAssignments)
        : [];
        
      return {
        consolidatedAssignments,
        duplicatesRemoved: result.duplicatesRemoved || 0,
        consolidationSummary: result.consolidationSummary || ''
      };
    } catch (error) {
      console.error('🤖 AI consolidation failed:', error);
      throw error;
    }
  }

  // Helper methods
  async makeRequest(prompt, options = {}) {
    const { temperature = 0.3, taskType = 'unknown', maxTokens = 4000 } = options;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(`${this.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: 'system',
                content: 'You are Studiora\'s AI assistant, specializing in parsing nursing education documents. Always respond with valid JSON.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' }
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`API error: ${response.status} - ${error}`);
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content;
        
        try {
          const parsed = JSON.parse(content);
          console.log(`✅ Studiora AI ${taskType} successful`);
          return parsed;
        } catch (parseError) {
          console.error('Failed to parse AI response:', content);
          throw new Error(`Invalid JSON response: ${parseError.message}`);
        }
        
      } catch (error) {
        console.error(`🤖 Studiora AI attempt ${attempt} failed:`, error.message);
        
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        await this.delay(attempt * 1000);
      }
    }
  }

  validateAssignments(assignments) {
    return assignments
      .filter(a => a && a.text && a.date)
      .map(assignment => ({
        ...assignment,
        id: assignment.id || `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: assignment.text.trim(),
        date: this.validateDate(assignment.date),
        type: assignment.type || 'assignment',
        hours: Math.max(0.25, Math.min(8, assignment.hours || 1.5)),
        course: assignment.course || 'unknown',
        confidence: Math.max(0.1, Math.min(1, assignment.confidence || 0.7)),
        source: assignment.source || 'ai'
      }));
  }

  buildPrompt(text, taskType, context = {}) {
    const currentDate = this.getCurrentDateString();
    const basePrompt = `Current date: ${currentDate}
Academic semester: Spring 2025 (May 5 - August 10, 2025)
Document type: ${context.documentType || 'mixed'}
Course: ${context.course || 'nursing'}

IMPORTANT: You must return ONLY valid JSON with no additional text or formatting.`;

    switch (taskType) {
      case 'parse-remaining':
        return `${basePrompt}

Analyze this remaining text after regex extraction. Find ANY assignments missed by regex.
Focus on implicit assignments like "prepare for discussion", "review before class", etc.

REGEX ALREADY FOUND:
${JSON.stringify(context.regexResults?.assignments || [], null, 2)}

REMAINING TEXT TO ANALYZE:
${text}

Return JSON with this EXACT structure:
{
  "assignments": [
    {
      "text": "assignment description",
      "date": "YYYY-MM-DD",
      "type": "assignment|reading|quiz|exam|project|clinical|lab|discussion",
      "hours": 1.5,
      "confidence": 0.7,
      "extractionReason": "why this is an assignment"
    }
  ]
}`;

      case 'validate-enhance':
        return `${basePrompt}

VALIDATE and ENHANCE these regex-extracted assignments. For EACH assignment:
- Verify it's a real assignment (not a false positive)
- Find missing dates by looking at surrounding context
- Improve descriptions using context
- Fix any date parsing issues

ORIGINAL TEXT:
${text}

REGEX ASSIGNMENTS TO VALIDATE:
${JSON.stringify(context.regexResults?.assignments || [], null, 2)}

Return JSON with this EXACT structure:
{
  "validatedAssignments": [
    {
      "id": "keep original id",
      "text": "enhanced description",
      "date": "YYYY-MM-DD",
      "type": "assignment type",
      "hours": 1.5,
      "course": "${context.course || 'unknown'}",
      "confidence": 0.9,
      "validationNote": "why valid/what was fixed"
    }
  ],
  "removedAssignments": ["ids of false positives"],
  "enhancementSummary": "brief summary of changes",
  "confidence": 0.85
}`;

      case 'final-consolidation':
        return `${basePrompt}

CONSOLIDATE all assignments from enhanced regex and AI remainder parsing.
- Merge the two lists
- Remove any duplicates (same assignment found by both)
- Ensure consistent formatting
- Order by date

ENHANCED REGEX ASSIGNMENTS:
${JSON.stringify(context.enhancedRegex?.validatedAssignments || [], null, 2)}

AI REMAINDER ASSIGNMENTS:
${JSON.stringify(context.aiRemainder?.assignments || [], null, 2)}

Return JSON with this EXACT structure:
{
  "consolidatedAssignments": [
    {
      "id": "original or new id",
      "text": "assignment description",
      "date": "YYYY-MM-DD",
      "type": "type",
      "hours": 1.5,
      "course": "course",
      "confidence": 0.8,
      "source": "regex/ai/both",
      "consolidationNote": "unique/duplicate removed/merged"
    }
  ],
  "duplicatesRemoved": 0,
  "consolidationSummary": "X total assignments: Y from regex, Z from AI, W duplicates removed"
}`;

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
      
      // Fixed: Use local timezone instead of UTC
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return null;
    }
  }

  getCurrentDateString() {
    const now = new Date();
    // Fixed: Use local timezone instead of UTC
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default StudiorAIService;