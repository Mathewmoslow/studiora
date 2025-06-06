// src/tests/parser-comparison.test.js
import { ScheduleParser } from '../services/ScheduleParser.js';
import { EnhancedScheduleParser } from '../services/EnhancedScheduleParser.js';
import fs from 'fs';

// Load your sample data
const sampleData = fs.readFileSync('./test-data/nclex335-sample.txt', 'utf8');

// Run both parsers
console.log('🧪 Running parser comparison test...\n');

// Test original parser
const originalParser = new ScheduleParser();
const originalResults = originalParser.parse(sampleData, 'NCLEX335');

// Test enhanced parser
const enhancedParser = new EnhancedScheduleParser();
const enhancedResults = enhancedParser.parse(sampleData, 'NCLEX335');

// Compare results
const comparison = {
  original: {
    total: originalResults.assignments.length,
    byType: groupByType(originalResults.assignments)
  },
  enhanced: {
    total: enhancedResults.assignments.length,
    byType: groupByType(enhancedResults.assignments)
  },
  expected: {
    total: 53,
    byType: {
      'class-meetings': 12,
      'quiz': 14,
      'exam': 6,
      'other': 21
    }
  }
};

// Helper function to group assignments by type
function groupByType(assignments) {
  return assignments.reduce((acc, assignment) => {
    const type = assignment.type || 'other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
}

// Display results
console.log('📊 Parser Comparison Results:');
console.log('Original Parser:', comparison.original);
console.log('Enhanced Parser:', comparison.enhanced);
console.log('Expected:', comparison.expected);

// Find what's missing
if (enhancedResults.assignments.length < 53) {
  console.log('\n⚠️  Missing assignments - investigating...');
  // Add logic here to identify specific missing items
}