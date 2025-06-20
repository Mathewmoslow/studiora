// src/hooks/useParserIntegration.jsx
import { useState, useCallback } from 'react';
import { Upload, X } from 'lucide-react';
import { ParserUI } from '../components/Parser';

export function useParserIntegration({ onAssignmentsImported, isDark }) {
  const [showParser, setShowParser] = useState(false);
  
  const handleParseComplete = useCallback((results) => {
    // Call the parent handler with the results
    if (onAssignmentsImported) {
      onAssignmentsImported(results);
    }
    
    // Close parser
    setShowParser(false);
  }, [onAssignmentsImported]);
  
  // Parser trigger button component
  const ParserButton = () => (
    <button
      onClick={() => setShowParser(true)}
      className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
      title="Import Course Content"
    >
      <Upload className="h-5 w-5" />
    </button>
  );
  
  // Parser modal component
  const ParserModal = () => {
    if (!showParser) return null;
    
    return (
      <>
        {/* Mobile full-screen version */}
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowParser(false)} />
          <div className="fixed inset-x-4 top-4 bottom-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-4 border-b dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold dark:text-white">Import Course Content</h2>
                <button onClick={() => setShowParser(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <X className="h-5 w-5 dark:text-gray-300" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <ParserUI 
                onParseComplete={handleParseComplete}
                isDark={isDark}
              />
            </div>
          </div>
        </div>

        {/* Desktop centered version */}
        <div className="hidden lg:block fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowParser(false)} />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-4 border-b dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold dark:text-white">Import Course Content</h2>
                <button onClick={() => setShowParser(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <X className="h-5 w-5 dark:text-gray-300" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-5rem)]">
              <ParserUI 
                onParseComplete={handleParseComplete}
                isDark={isDark}
              />
            </div>
          </div>
        </div>
      </>
    );
  };
  
  return {
    showParser,
    setShowParser,
    ParserButton,
    ParserModal
  };
}

// Simple integration script for App.jsx
export const getIntegrationCode = () => `
// In your App.jsx:

// 1. Import the hook
import { useParserIntegration } from './hooks/useParserIntegration';

// 2. Use the hook in your component
const { ParserButton, ParserModal } = useParserIntegration({
  onAssignmentsImported: (results) => {
    setAppData(prev => ({
      ...prev,
      assignments: [...prev.assignments, ...results.assignments],
      modules: [...prev.modules, ...(results.modules || [])]
    }));
    // Show success message
    console.log(\`Imported \${results.assignments.length} assignments\`);
  },
  isDark
});

// 3. Add the button in your header
<ParserButton />

// 4. Add the modal at the end of your component
<ParserModal />
`;