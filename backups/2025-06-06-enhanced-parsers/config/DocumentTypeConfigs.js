// src/services/config/DocumentTypeConfigs.js
// Centralized configuration for different educational domains and document types

class DocumentTypeConfigs {
  static configs = {
    // Nursing/Medical Programs
    nursing: {
      name: 'Nursing/Medical',
      keywords: [
        // Clinical terms
        'clinical', 'simulation', 'patient', 'nursing', 'medical', 'health',
        'hospital', 'rotation', 'rounds', 'shift', 'practicum',
        
        // Assessment types
        'hesi', 'nclex', 'ati', 'kaplan', 'dosage', 'calculation',
        'medication', 'pharmacology', 'pathophysiology', 'anatomy',
        
        // Specific activities
        'remediation', 'case study', 'care plan', 'concept map',
        'skills lab', 'check-off', 'competency', 'injection',
        
        // Course types
        'fundamentals', 'med-surg', 'pediatrics', 'maternity', 'psych',
        'community health', 'leadership', 'gerontology'
      ],
      hourEstimates: {
        'clinical': 8,
        'simulation': 4,
        'skills-lab': 3,
        'hesi-exam': 3,
        'nclex-prep': 2,
        'remediation': 2,
        'case-study': 1.5,
        'care-plan': 2,
        'check-off': 1,
        'reflection': 0.5
      },
      patterns: {
        clinical: /\b(clinical|rotation|shift|hospital)\b/i,
        simulation: /\b(sim|simulation|high-fidelity)\b/i,
        exam: /\b(hesi|nclex|ati|kaplan|exam|test)\b/i,
        skills: /\b(skills?\s*lab|check-?off|competency|demonstration)\b/i,
        remediation: /\b(remediation|review|make-?up)\b/i
      }
    },
    
    // Computer Science/Engineering
    engineering: {
      name: 'Computer Science/Engineering',
      keywords: [
        // Programming
        'code', 'programming', 'algorithm', 'debug', 'compile', 'deploy',
        'repository', 'git', 'github', 'commit', 'branch', 'merge',
        
        // Project types
        'lab', 'project', 'sprint', 'milestone', 'demo', 'presentation',
        'hackathon', 'competition', 'implementation', 'prototype',
        
        // Specific CS terms
        'data structure', 'database', 'api', 'frontend', 'backend',
        'full-stack', 'machine learning', 'ai', 'neural network',
        
        // Assessment
        'code review', 'peer review', 'unit test', 'integration test',
        'documentation', 'readme', 'specification', 'design document'
      ],
      hourEstimates: {
        'lab': 3,
        'project': 8,
        'programming-assignment': 4,
        'code-review': 1,
        'sprint': 20,
        'hackathon': 12,
        'demo': 0.5,
        'documentation': 2,
        'debugging': 3,
        'exam': 2
      },
      patterns: {
        lab: /\b(lab|laboratory)\s*\d*\b/i,
        project: /\b(project|sprint|milestone)\b/i,
        programming: /\b(code|program|implement|develop)\b/i,
        review: /\b(review|peer|feedback)\b/i,
        test: /\b(test|exam|quiz|midterm|final)\b/i
      }
    },
    
    // Business/MBA
    business: {
      name: 'Business/MBA',
      keywords: [
        // Case studies
        'case study', 'case analysis', 'harvard case', 'business case',
        
        // Projects
        'business plan', 'marketing plan', 'financial analysis',
        'swot analysis', 'presentation', 'pitch', 'proposal',
        
        // Specific terms
        'strategy', 'consulting', 'management', 'finance', 'marketing',
        'operations', 'supply chain', 'entrepreneurship', 'venture',
        
        // Activities
        'simulation', 'team project', 'group work', 'client project',
        'field study', 'internship', 'networking event'
      ],
      hourEstimates: {
        'case-study': 3,
        'business-plan': 10,
        'presentation': 2,
        'group-project': 6,
        'simulation': 2,
        'analysis': 3,
        'reading': 2,
        'networking': 2,
        'exam': 3
      },
      patterns: {
        case: /\b(case\s*study|case\s*analysis|harvard\s*case)\b/i,
        presentation: /\b(presentation|pitch|present)\b/i,
        project: /\b(project|plan|proposal)\b/i,
        analysis: /\b(analysis|analyze|evaluate)\b/i
      }
    },
    
    // Liberal Arts/Humanities
    humanities: {
      name: 'Liberal Arts/Humanities',
      keywords: [
        // Writing
        'essay', 'paper', 'thesis', 'dissertation', 'response',
        'reflection', 'journal', 'blog', 'article', 'critique',
        
        // Reading
        'reading', 'chapter', 'article', 'book', 'text', 'literature',
        
        // Activities
        'discussion', 'seminar', 'workshop', 'conference', 'symposium',
        'debate', 'presentation', 'performance', 'exhibition',
        
        // Research
        'research', 'fieldwork', 'interview', 'survey', 'analysis'
      ],
      hourEstimates: {
        'essay': 4,
        'paper': 6,
        'reading': 2,
        'discussion': 1,
        'presentation': 2,
        'research': 5,
        'journal': 1,
        'response': 1,
        'exam': 2
      },
      patterns: {
        writing: /\b(essay|paper|write|writing|response)\b/i,
        reading: /\b(read|reading|chapter|pages?)\b/i,
        discussion: /\b(discussion|discuss|seminar|forum)\b/i,
        research: /\b(research|fieldwork|study)\b/i
      }
    },
    
    // Sciences (Bio, Chem, Physics)
    sciences: {
      name: 'Natural Sciences',
      keywords: [
        // Lab work
        'lab', 'experiment', 'protocol', 'procedure', 'observation',
        'data collection', 'analysis', 'results', 'conclusion',
        
        // Reports
        'lab report', 'research paper', 'poster', 'abstract',
        
        // Specific terms
        'hypothesis', 'methodology', 'equipment', 'safety',
        'chemical', 'reaction', 'specimen', 'sample', 'culture',
        
        // Activities
        'field trip', 'field work', 'collection', 'dissection'
      ],
      hourEstimates: {
        'lab': 4,
        'lab-report': 3,
        'experiment': 3,
        'field-work': 5,
        'data-analysis': 2,
        'poster': 4,
        'research': 5,
        'exam': 2
      },
      patterns: {
        lab: /\b(lab|laboratory|experiment)\b/i,
        report: /\b(report|write-?up|analysis)\b/i,
        field: /\b(field|collection|observation)\b/i
      }
    },
    
    // Mathematics/Statistics
    mathematics: {
      name: 'Mathematics/Statistics',
      keywords: [
        // Assignments
        'problem set', 'homework', 'proof', 'derivation', 'calculation',
        
        // Specific terms
        'theorem', 'lemma', 'equation', 'formula', 'matrix', 'vector',
        'statistics', 'probability', 'analysis', 'calculus', 'algebra',
        
        // Activities
        'workshop', 'tutorial', 'review session', 'practice problems'
      ],
      hourEstimates: {
        'problem-set': 3,
        'homework': 2,
        'proof': 2,
        'exam': 2,
        'quiz': 1,
        'tutorial': 1,
        'workshop': 2
      },
      patterns: {
        homework: /\b(homework|hw|problem\s*set|pset)\b/i,
        proof: /\b(proof|prove|derivation|derive)\b/i,
        practice: /\b(practice|tutorial|workshop)\b/i
      }
    },
    
    // Default/Generic
    default: {
      name: 'General Education',
      keywords: [
        'assignment', 'homework', 'quiz', 'exam', 'test', 'midterm', 'final',
        'project', 'presentation', 'paper', 'essay', 'report',
        'reading', 'chapter', 'discussion', 'forum', 'post',
        'lab', 'activity', 'exercise', 'workshop', 'review'
      ],
      hourEstimates: {
        'assignment': 2,
        'homework': 2,
        'quiz': 1,
        'exam': 2,
        'project': 4,
        'paper': 3,
        'reading': 2,
        'discussion': 1,
        'lab': 3,
        'activity': 1
      },
      patterns: {
        assignment: /\b(assignment|homework|hw)\b/i,
        test: /\b(quiz|exam|test|midterm|final)\b/i,
        project: /\b(project|presentation)\b/i,
        writing: /\b(paper|essay|report|write)\b/i,
        reading: /\b(read|chapter)\b/i
      }
    }
  };
  
  // Detect domain based on course name or content
  static detectDomain(courseName, documentText = '') {
    const searchText = `${courseName} ${documentText}`.toLowerCase();
    
    // Check each domain's keywords
    const domainScores = {};
    
    for (const [domain, config] of Object.entries(this.configs)) {
      if (domain === 'default') continue;
      
      let score = 0;
      config.keywords.forEach(keyword => {
        if (searchText.includes(keyword.toLowerCase())) {
          score += keyword.split(' ').length; // Multi-word keywords score higher
        }
      });
      
      domainScores[domain] = score;
    }
    
    // Find highest scoring domain
    const bestDomain = Object.entries(domainScores)
      .sort(([,a], [,b]) => b - a)[0];
    
    // Return best domain if score is significant, otherwise default
    return (bestDomain && bestDomain[1] > 5) ? bestDomain[0] : 'default';
  }
  
  // Get configuration for a specific domain
  static getConfig(domain = 'default') {
    return this.configs[domain] || this.configs.default;
  }
  
  // Merge domain config with custom overrides
  static buildConfig(courseName, documentText, customConfig = {}) {
    const detectedDomain = this.detectDomain(courseName, documentText);
    const domainConfig = this.getConfig(detectedDomain);
    
    return {
      domain: detectedDomain,
      domainName: domainConfig.name,
      keywords: [
        ...domainConfig.keywords,
        ...(customConfig.additionalKeywords || [])
      ],
      hourEstimates: {
        ...domainConfig.hourEstimates,
        ...(customConfig.hourEstimates || {})
      },
      patterns: {
        ...domainConfig.patterns,
        ...(customConfig.patterns || {})
      },
      // Add any custom config
      ...customConfig,
      // Ensure these aren't overwritten
      documentType: customConfig.documentType || 'schedule',
      defaultYear: customConfig.defaultYear || new Date().getFullYear()
    };
  }
  
  // Helper to determine assignment type based on domain patterns
  static determineType(text, domain = 'default') {
    const config = this.getConfig(domain);
    
    for (const [type, pattern] of Object.entries(config.patterns)) {
      if (pattern.test(text)) {
        return type;
      }
    }
    
    // Fallback to checking against all patterns
    for (const [type, pattern] of Object.entries(this.configs.default.patterns)) {
      if (pattern.test(text)) {
        return type;
      }
    }
    
    return 'assignment';
  }
  
  // Get hour estimate for a specific type and domain
  static getHourEstimate(type, domain = 'default') {
    const config = this.getConfig(domain);
    return config.hourEstimates[type] || 
           this.configs.default.hourEstimates[type] || 
           2; // Default hours
  }
}

export { DocumentTypeConfigs };