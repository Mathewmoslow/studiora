// src/services/StudiorAIService.js
// High-Token StudiorAIService - Fixed JSON parsing for GPT-4o responses

export class StudiorAIService {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    
    this.model = options.model || 
                 import.meta.env.VITE_AI_MODEL || 
                 'gpt-4o';
    
    this.baseURL = options.baseURL || 'https://api.openai.com/v1';
    this.timeout = parseInt(import.meta.env.VITE_AI_TIMEOUT) || 60000;
    this.maxRetries = 2;
    
    // Token limits based on model
    this.tokenLimits = {
      'gpt-4': 6000,
      'gpt-4-turbo': 20000,
      'gpt-4o': 20000,
      'gpt-4o-mini': 20000
    };
    
    this.maxInputTokens = this.tokenLimits[this.model] || 20000;
    
    console.log(`🤖 Studiora AI initialized: ${this.model} (${this.maxInputTokens} token limit)`);
  }

  async parseIndependently(text, template, options = {}) {
    const { onProgress } = options;
    
    onProgress?.({ stage: 'ai-analyze', message: `AI analyzing with ${this.model}...` });

    // Check if we need to chunk or can process all at once
    const estimatedTokens = this.estimateTokens(text);
    console.log(`📊 Estimated tokens: ${estimatedTokens}, Model limit: ${this.maxInputTokens}`);
    
    if (estimatedTokens > this.maxInputTokens) {
      console.log('📦 Using chunked processing for large content...');
      return await this.parseInChunks(text, template, options);
    }

    const prompt = this.buildFullDocumentPrompt(text, template);
    
    try {
      onProgress?.({ stage: 'ai-extract', message: 'AI processing full document...' });
      
      const result = await this.makeRequest(prompt, {
        temperature: 0.3,
        taskType: 'full-document-parsing',
        maxTokens: 8000
      });

      onProgress?.({ stage: 'ai-complete', message: 'AI parsing complete' });
      
      return this.validateAndEnhanceAIResult(result);
      
    } catch (error) {
      console.error('🤖 Full document AI parsing failed:', error);
      console.log('🔄 Falling back to chunked processing...');
      return await this.parseInChunks(text, template, options);
    }
  }

  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  buildFullDocumentPrompt(text, template) {
    const currentDate = new Date().toISOString().split('T')[0];
    
    return `You are Studiora's AI parser, expert in nursing education content. Parse this COMPLETE document comprehensively.

IMPORTANT: Respond with CLEAN JSON only. Do NOT wrap your response in markdown code blocks or any other formatting.

FULL DOCUMENT TO PARSE:
${text}

CONTEXT:
- Current date: ${currentDate}
- Academic semester: Spring 2025 (May 5 - August 10, 2025)
- Template: ${template}
- Course: NCLEX Immersion (Nursing licensure preparation)

COMPREHENSIVE EXTRACTION REQUIREMENTS:
1. ALL assignments (explicit and implicit)
   - Quizzes, exams, HESI prep, remediation, activities
   - Include prep work like "HESI Exam Prep" assignments
   - Extract reflection quizzes and case studies
   
2. ALL dates (convert relative to absolute YYYY-MM-DD)
   - "Monday May 5" → "2025-05-05"
   - "Due: 1:45PM" → use the class date
   - "Due: 11:59PM" → use the assignment date
   
3. Class schedule and events
   - Lecture times, exam times, simulation days
   - ON-CAMPUS vs ZOOM sessions
   
4. Study time estimation
   - Quizzes: 1-2 hours
   - HESI Exams: 2-3 hours 
   - HESI Prep: 1.5 hours
   - Remediation: 2-3 hours
   - Activities: 0.5-1 hour

RESPOND WITH CLEAN JSON (no markdown formatting):
{
  "assignments": [
    {
      "text": "Complete assignment description",
      "date": "YYYY-MM-DD",
      "type": "quiz|exam|prep|remediation|activity|simulation",
      "hours": 1.5,
      "course": "nclex",
      "confidence": 0.95,
      "extractionReason": "Why this was identified as an assignment",
      "timeOfDay": "1:45PM|11:59PM|2:00PM",
      "points": 50,
      "week": 1
    }
  ],
  "modules": [
    {
      "number": 1,
      "title": "Health Assessment",
      "course": "nclex",
      "weekRange": "Week 1-2",
      "keyTopics": "Assessment, foundations, prioritization"
    }
  ],
  "events": [
    {
      "title": "HESI Health Assessment Exam",
      "date": "YYYY-MM-DD",
      "time": "14:00",
      "type": "exam|lecture|simulation",
      "location": "ON-CAMPUS|ZOOM|NB 109",
      "duration": "2 hours"
    }
  ],
  "gradingBreakdown": {
    "quizzes": "10%",
    "hesiExams": "60%",
    "finalExam": "20%"
  },
  "importantPolicies": [
    "No makeup quizzes allowed",
    "HESI exams require 77% minimum"
  ],
  "overallConfidence": 0.92
}`;
  }

  async parseInChunks(text, template, options = {}) {
    const { onProgress } = options;
    
    console.log('📦 Processing in chunks due to size...');
    onProgress?.({ stage: 'ai-chunk', message: 'Chunking large document...' });

    const chunks = this.intelligentChunking(text);
    const allResults = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      onProgress?.({ 
        stage: 'ai-chunk', 
        message: `Processing section ${i + 1}/${chunks.length}: ${chunk.title}` 
      });

      try {
        const chunkResult = await this.parseChunk(chunk, template, i + 1);
        if (chunkResult?.assignments?.length > 0) {
          allResults.push(chunkResult);
        }
        
        if (i < chunks.length - 1) {
          await this.delay(1500);
        }
      } catch (error) {
        console.warn(`Section ${i + 1} failed:`, error.message);
      }
    }

    return this.mergeChunkResults(allResults);
  }

  intelligentChunking(text) {
    const weekRegex = /Week (\d+) \([^)]+\)/g;
    const weekMatches = [...text.matchAll(weekRegex)];
    
    if (weekMatches.length === 0) {
      return this.simpleChunking(text);
    }

    const chunks = [];
    for (let i = 0; i < weekMatches.length; i++) {
      const match = weekMatches[i];
      const weekNumber = match[1];
      const startIndex = match.index;
      const endIndex = weekMatches[i + 1]?.index || text.length;
      
      const chunkText = text.substring(startIndex, endIndex);
      
      if (chunkText.length > 100) {
        chunks.push({
          title: `Week ${weekNumber}`,
          text: chunkText,
          weekNumber: parseInt(weekNumber)
        });
      }
    }

    console.log(`📦 Created ${chunks.length} intelligent chunks by week`);
    return chunks;
  }

  simpleChunking(text) {
    const chunkSize = Math.floor(this.maxInputTokens * 3.5);
    const chunks = [];
    
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunkText = text.substring(i, i + chunkSize);
      chunks.push({
        title: `Section ${Math.floor(i/chunkSize) + 1}`,
        text: chunkText,
        chunkNumber: Math.floor(i/chunkSize) + 1
      });
    }
    
    return chunks;
  }

  async parseChunk(chunk, template, chunkIndex) {
    const prompt = `Parse this section of NCLEX course content.

IMPORTANT: Respond with CLEAN JSON only. Do NOT wrap your response in markdown code blocks.

SECTION: ${chunk.title}
CONTENT:
${chunk.text}

Extract assignments, dates, and events from this section only.
Convert all dates to YYYY-MM-DD format.
Estimate realistic study hours.

RESPOND WITH CLEAN JSON:
{
  "assignments": [...],
  "events": [...],
  "weekInfo": {
    "weekNumber": ${chunk.weekNumber || chunkIndex},
    "title": "${chunk.title}"
  },
  "overallConfidence": 0.85
}`;

    try {
      const result = await this.makeRequest(prompt, {
        temperature: 0.3,
        taskType: 'chunk-parsing',
        maxTokens: 4000
      });
      
      return this.validateAndEnhanceAIResult(result);
    } catch (error) {
      console.warn(`Chunk ${chunkIndex} parsing failed:`, error.message);
      return null;
    }
  }

  mergeChunkResults(results) {
    const merged = {
      assignments: [],
      modules: [],
      events: [],
      gradingBreakdown: {},
      importantPolicies: [],
      overallConfidence: 0
    };

    let totalConfidence = 0;
    let count = 0;

    results.forEach(result => {
      if (result.assignments) merged.assignments.push(...result.assignments);
      if (result.modules) merged.modules.push(...result.modules);
      if (result.events) merged.events.push(...result.events);
      if (result.gradingBreakdown) Object.assign(merged.gradingBreakdown, result.gradingBreakdown);
      if (result.importantPolicies) merged.importantPolicies.push(...result.importantPolicies);
      
      if (result.overallConfidence) {
        totalConfidence += result.overallConfidence;
        count++;
      }
    });

    merged.overallConfidence = count > 0 ? totalConfidence / count : 0.7;
    
    merged.assignments = this.deduplicateAndSort(merged.assignments);
    merged.events = this.deduplicateAndSort(merged.events);
    
    console.log(`🔄 Merged results: ${merged.assignments.length} assignments, ${merged.events.length} events`);
    
    return merged;
  }

  deduplicateAndSort(items) {
    const unique = [];
    const seen = new Set();

    items.forEach(item => {
      const key = `${item.text?.toLowerCase()}-${item.date}`;
      if (!seen.has(key) && item.text) {
        seen.add(key);
        unique.push(item);
      }
    });

    return unique.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date) - new Date(b.date);
    });
  }

  async reconcileResults(reconciliationData, options = {}) {
    const { onProgress } = options;
    
    onProgress?.({ stage: 'ai-reconcile', message: 'AI reconciling with high-token model...' });

    const prompt = this.buildReconciliationPrompt(reconciliationData);
    
    try {
      const result = await this.makeRequest(prompt, {
        temperature: 0.1,
        taskType: 'reconciliation',
        maxTokens: 6000
      });

      return this.validateReconciliationResult(result);
      
    } catch (error) {
      console.error('🔄 AI reconciliation failed:', error);
      return this.fallbackReconciliation(reconciliationData);
    }
  }

  buildReconciliationPrompt(data) {
    const regexAssignments = data.regexResults?.assignments || [];
    const aiAssignments = data.aiResults?.assignments || [];
    
    return `Reconcile these parsing results for NCLEX course content.

IMPORTANT: Respond with CLEAN JSON only. Do NOT wrap your response in markdown code blocks.

REGEX PARSER RESULTS (${regexAssignments.length} assignments):
${JSON.stringify(regexAssignments.slice(0, 10), null, 2)}
${regexAssignments.length > 10 ? `... and ${regexAssignments.length - 10} more` : ''}

AI PARSER RESULTS (${aiAssignments.length} assignments):
${JSON.stringify(aiAssignments.slice(0, 10), null, 2)}
${aiAssignments.length > 10 ? `... and ${aiAssignments.length - 10} more` : ''}

RECONCILIATION TASKS:
1. Match similar assignments (account for different wording)
2. Prefer AI dates over regex dates (better context understanding)  
3. Combine unique assignments from both parsers
4. Resolve conflicts intelligently
5. IMPORTANT: Include ALL unique assignments - be inclusive, not exclusive

RESPOND WITH CLEAN JSON:
{
  "finalAssignments": [...], 
  "reconciliationSummary": "Details of reconciliation process",
  "finalConfidence": 0.92,
  "stats": {
    "totalFound": 45,
    "regexUnique": 5,
    "aiUnique": 8,
    "matches": 32
  }
}`;
  }

  fallbackReconciliation(data) {
    const regexAssignments = data.regexResults?.assignments || [];
    const aiAssignments = data.aiResults?.assignments || [];
    
    const finalAssignments = aiAssignments.length > 0 ? 
      [...aiAssignments, ...regexAssignments] : regexAssignments;
    
    return {
      finalAssignments: this.deduplicateAndSort(finalAssignments),
      finalConfidence: 0.8,
      reconciliationSummary: `Fallback merge: ${finalAssignments.length} assignments`,
      stats: {
        totalFound: finalAssignments.length,
        regexUnique: regexAssignments.length,
        aiUnique: aiAssignments.length,
        matches: 0
      }
    };
  }

  // FIXED: JSON parsing to handle both clean JSON and markdown-wrapped JSON
  extractJSON(content) {
    // Remove markdown code blocks if present
    const cleanContent = content
      .replace(/^```json\s*/, '')  // Remove opening ```json
      .replace(/^```\s*/, '')      // Remove opening ```
      .replace(/\s*```$/, '')      // Remove closing ```
      .trim();

    try {
      return JSON.parse(cleanContent);
    } catch (error) {
      // If still failing, try to find JSON within the content
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error(`Failed to parse JSON: ${error.message}`);
    }
  }

  async makeRequest(prompt, options = {}) {
    const { temperature, taskType, maxTokens } = options;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        console.log(`🤖 ${this.model} request attempt ${attempt} (${taskType})`);

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
                content: 'You are an expert at parsing nursing education content. ALWAYS respond with clean JSON - no markdown formatting, no code blocks, just pure JSON.'
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
          throw new Error(`${this.model} API error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        
        if (!data.choices?.[0]?.message?.content) {
          throw new Error('Invalid API response format');
        }

        // FIXED: Use new JSON extraction method
        const result = this.extractJSON(data.choices[0].message.content);
        
        console.log(`✅ ${this.model} success: ${data.usage?.total_tokens || 'unknown'} tokens used`);
        
        return result;

      } catch (error) {
        console.warn(`🤖 ${this.model} attempt ${attempt} failed:`, error.message);
        
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        await this.delay(2000 * attempt);
      }
    }
  }

  validateAndEnhanceAIResult(result) {
    result.assignments = result.assignments || [];
    result.modules = result.modules || [];
    result.events = result.events || [];
    result.overallConfidence = result.overallConfidence || 0.7;

    result.assignments = result.assignments
      .filter(a => a.text && a.text.length > 5)
      .map(assignment => ({
        id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: assignment.text,
        date: this.validateDate(assignment.date),
        type: assignment.type || 'assignment',
        hours: Math.max(0.25, Math.min(8, assignment.hours || 1.5)),
        course: assignment.course || 'nclex',
        confidence: Math.max(0.1, Math.min(1, assignment.confidence || 0.8)),
        extractionReason: assignment.extractionReason || 'AI identified',
        timeOfDay: assignment.timeOfDay || null,
        points: assignment.points || null,
        week: assignment.week || null
      }));

    return result;
  }

  validateReconciliationResult(result) {
    return {
      matches: result.matches || [],
      regexUnique: result.regexUnique || [],
      aiUnique: result.aiUnique || [],
      conflicts: result.conflicts || [],
      finalAssignments: result.finalAssignments || [],
      finalConfidence: result.finalConfidence || 0.8,
      reconciliationSummary: result.reconciliationSummary || 'Reconciliation completed',
      stats: result.stats || {}
    };
  }

  validateDate(dateString) {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      
      if (date.getFullYear() !== 2025) {
        return null;
      }
      
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