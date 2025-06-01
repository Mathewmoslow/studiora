// src/services/StudiorAIService.js
// Studiora's AI Service - Independent parsing and intelligent reconciliation

export class StudiorAIService {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.model = options.model || 'gpt-4';
    this.baseURL = options.baseURL || 'https://api.openai.com/v1';
    this.timeout = options.timeout || 45000;
    this.maxRetries = options.maxRetries || 3;
  }

  async parseIndependently(text, template, options = {}) {
    const { onProgress } = options;
    
    onProgress?.({ stage: 'ai-analyze', message: 'AI analyzing document structure...' });

    const prompt = this.buildIndependentParsingPrompt(text, template);
    
    try {
      onProgress?.({ stage: 'ai-extract', message: 'AI extracting assignments and dates...' });
      
      const result = await this.makeRequest(prompt, {
        temperature: 0.3,
        taskType: 'independent-parsing',
        maxTokens: 4000
      });

      onProgress?.({ stage: 'ai-complete', message: 'AI parsing complete' });
      
      return this.validateAndEnhanceAIResult(result);
      
    } catch (error) {
      console.error('🤖 Studiora AI parsing failed:', error);
      throw new Error(`AI parsing failed: ${error.message}`);
    }
  }

  async reconcileResults(reconciliationData, options = {}) {
    const { onProgress } = options;
    
    onProgress?.({ stage: 'ai-reconcile', message: 'AI analyzing differences...' });

    const prompt = this.buildReconciliationPrompt(reconciliationData);
    
    try {
      const result = await this.makeRequest(prompt, {
        temperature: 0.1, // Very low for precise reconciliation
        taskType: 'reconciliation',
        maxTokens: 4000
      });

      onProgress?.({ stage: 'reconcile-complete', message: 'Reconciliation complete' });
      
      return this.validateReconciliationResult(result);
      
    } catch (error) {
      console.error('🔄 Studiora reconciliation failed:', error);
      throw new Error(`Reconciliation failed: ${error.message}`);
    }
  }

  buildIndependentParsingPrompt(text, template) {
    const currentDate = new Date().toISOString().split('T')[0];
    
    return `You are Studiora's AI parser, specializing in nursing education content. Parse this document INDEPENDENTLY and COMPREHENSIVELY.

DOCUMENT TO PARSE:
${text}

CONTEXT:
- Current date: ${currentDate}
- Academic semester: Spring 2025 (May 5 - August 10, 2025)
- Template hint: ${template}
- Domain: Nursing education (OB/GYN, Adult Health, NCLEX prep, Gerontology)

EXTRACTION REQUIREMENTS:
1. ALL assignments (explicit and implicit)
   - Readings, quizzes, exams, projects, discussions, labs, clinical prep
   - Include "come prepared to discuss", "review before class", etc.
   - Homework, worksheets, case studies, simulations
   
2. ALL dates (convert relative to absolute)
   - "next week" → specific date
   - "Friday" → specific Friday date  
   - "by end of week" → Friday of that week
   - "before class" → day before class meeting
   
3. Course/module structure
   - Module numbers and titles
   - Week organization
   - Course codes (NURS, NSG, etc.)
   
4. Educational context
   - Learning objectives
   - Prerequisites
   - Study recommendations
   - Workload warnings

NURSING-SPECIFIC PATTERNS:
- Clinical rotations and prep requirements
- NCLEX/HESI exam preparations
- Skills lab assignments
- Case study discussions
- Medication calculation practice
- Simulation scenarios

RESPOND IN VALID JSON:
{
  "assignments": [
    {
      "text": "Complete assignment description",
      "date": "YYYY-MM-DD",
      "type": "reading|quiz|exam|assignment|lab|discussion|clinical|simulation|prep",
      "hours": 1.5,
      "course": "obgyn|adulthealth|nclex|geronto|unknown",
      "confidence": 0.95,
      "extractionReason": "Why this was identified as an assignment"
    }
  ],
  "modules": [
    {
      "number": 1,
      "title": "Module title",
      "course": "course_code", 
      "chapters": "Chapter information",
      "keyTopics": "Key learning topics",
      "classMeeting": "Meeting schedule"
    }
  ],
  "events": [
    {
      "title": "Event name",
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "type": "lecture|clinical|exam|simulation|lab"
    }
  ],
  "learningObjectives": {
    "module1": ["objective1", "objective2"]
  },
  "studyHints": [
    {
      "assignment": "Assignment name",
      "hints": ["hint1", "hint2"],
      "timeRecommendation": "Start X days early"
    }
  ],
  "workloadWarnings": [
    {
      "week": "Week X",
      "reason": "Heavy workload description",
      "recommendation": "How to manage"
    }
  ],
  "overallConfidence": 0.88
}`;
  }

  buildReconciliationPrompt(data) {
    return `You are Studiora's reconciliation AI. Two independent parsers analyzed the same document. Your task is to create the most accurate, complete final result.

ORIGINAL DOCUMENT:
${data.originalText}

REGEX PARSER RESULTS:
Confidence: ${data.regexResults.confidence}
Assignments found: ${data.regexResults.assignments.length}
${JSON.stringify(data.regexResults.assignments, null, 2)}

AI PARSER RESULTS:  
Confidence: ${data.aiResults.confidence}
Assignments found: ${data.aiResults.assignments.length}
${JSON.stringify(data.aiResults.assignments, null, 2)}

RECONCILIATION TASKS:
1. MATCH assignments that are the same (despite different wording)
2. IDENTIFY unique assignments found by only one parser
3. RESOLVE conflicts (same assignment, different details)
4. DETERMINE the most accurate version for each item
5. CALCULATE final confidence based on agreement

MATCHING CRITERIA:
- Similar text content (accounting for abbreviations)
- Same due dates or logically related dates
- Same assignment type and purpose
- Consider that one parser might be more complete

CONFLICT RESOLUTION:
- Prefer specific dates over vague dates
- Prefer complete descriptions over abbreviated ones
- Trust AI for context and implications
- Trust regex for structured patterns
- When in doubt, include both if genuinely different

RESPOND IN VALID JSON:
{
  "matches": [
    {
      "regexAssignment": {...},
      "aiAssignment": {...},
      "resolved": {
        "text": "Final assignment text",
        "date": "YYYY-MM-DD",
        "type": "assignment_type",
        "hours": 1.5,
        "course": "course_code",
        "confidence": 0.95
      },
      "winnerSource": "ai|regex|merged",
      "reasoning": "Why this resolution was chosen"
    }
  ],
  "regexUnique": [
    {
      "assignment": {...},
      "keepReason": "Why this should be kept",
      "confidence": 0.8
    }
  ],
  "aiUnique": [
    {
      "assignment": {...},
      "keepReason": "Why this should be kept",
      "confidence": 0.9
    }
  ],
  "conflicts": [
    {
      "issue": "Description of conflict",
      "regexVersion": {...},
      "aiVersion": {...},
      "resolution": {...},
      "reasoning": "Resolution explanation"
    }
  ],
  "finalConfidence": 0.92,
  "reconciliationSummary": "Found X matches, Y regex-unique, Z ai-unique, W conflicts resolved"
}`;
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
            max_tokens: maxTokens || 4000
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

        const result = JSON.parse(data.choices[0].message.content);
        
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

  getSystemPrompt(taskType) {
    const basePrompt = `You are Studiora's AI assistant, an expert in nursing education content parsing. You specialize in:
- Nursing curricula (OB/GYN, Adult Health, NCLEX prep, Gerontology)
- Academic assignment extraction
- Educational content analysis
- Date interpretation and conversion
- Learning objective identification

Always respond in valid JSON format. Be thorough, accurate, and educational-context aware.`;

    switch (taskType) {
      case 'independent-parsing':
        return `${basePrompt}

Your task is INDEPENDENT PARSING. Parse educational documents comprehensively without any external influence. Extract ALL assignments, dates, and educational content. Pay special attention to:
- Implicit assignments ("come prepared", "review before")
- Relative dates that need conversion to absolute dates
- Nursing-specific terminology and requirements
- Clinical rotations and lab requirements
- NCLEX preparation activities`;

      case 'reconciliation':
        return `${basePrompt}

Your task is INTELLIGENT RECONCILIATION. Two independent parsers analyzed the same document. You must:
- Compare their results analytically
- Identify genuine matches vs. unique findings
- Resolve conflicts with clear reasoning
- Create the most accurate final result
- Prioritize completeness and accuracy over either individual parser`;

      default:
        return basePrompt;
    }
  }

  validateAndEnhanceAIResult(result) {
    // Ensure required fields exist
    result.assignments = result.assignments || [];
    result.modules = result.modules || [];
    result.events = result.events || [];
    result.learningObjectives = result.learningObjectives || {};
    result.studyHints = result.studyHints || [];
    result.workloadWarnings = result.workloadWarnings || [];
    result.overallConfidence = result.overallConfidence || 0.5;

    // Validate and fix assignments
    result.assignments = result.assignments.map(assignment => ({
      text: assignment.text || 'Unknown assignment',
      date: this.validateDate(assignment.date),
      type: assignment.type || 'assignment',
      hours: Math.max(0.25, Math.min(8, assignment.hours || 1.5)),
      course: assignment.course || 'unknown',
      confidence: Math.max(0.1, Math.min(1, assignment.confidence || 0.7)),
      extractionReason: assignment.extractionReason || 'AI identified'
    }));

    return result;
  }

  validateReconciliationResult(result) {
    result.matches = result.matches || [];
    result.regexUnique = result.regexUnique || [];
    result.aiUnique = result.aiUnique || [];
    result.conflicts = result.conflicts || [];
    result.finalConfidence = Math.max(0.1, Math.min(1, result.finalConfidence || 0.7));
    result.reconciliationSummary = result.reconciliationSummary || 'Reconciliation completed';

    return result;
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
