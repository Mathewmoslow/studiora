#!/bin/bash
# setup-parser.sh - Complete parser integration setup script

echo "🚀 Studiora Parser Integration Setup"
echo "===================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from your project root."
    exit 1
fi

# Create necessary directories
echo -e "${BLUE}📁 Creating directories...${NC}"
mkdir -p src/services
mkdir -p src/components/Parser
mkdir -p src/hooks
mkdir -p scripts

# Function to download and save files
save_file() {
    local content="$1"
    local filepath="$2"
    echo "$content" > "$filepath"
    echo -e "${GREEN}✅ Created: $filepath${NC}"
}

# 1. Create backup of existing files
echo -e "${BLUE}📦 Creating backups...${NC}"
[ -f "src/services/DocumentParsers.js" ] && cp "src/services/DocumentParsers.js" "src/services/DocumentParsers.js.backup"
[ -f "src/services/RegexDocumentParser.js" ] && cp "src/services/RegexDocumentParser.js" "src/services/RegexDocumentParser.js.backup"
[ -f "src/App.jsx" ] && cp "src/App.jsx" "src/App.jsx.backup"

# 2. Create component index file
echo -e "${BLUE}📝 Creating component files...${NC}"
cat > src/components/Parser/index.js << 'EOF'
export { ParserUI, ParsedAssignmentsList } from './ParserUI';
EOF
echo -e "${GREEN}✅ Created: src/components/Parser/index.js${NC}"

# 3. Create the integration hook
echo -e "${BLUE}🪝 Creating integration hook...${NC}"
cat > src/hooks/useParserIntegration.jsx << 'EOF'
import { useState, useCallback } from 'react';
import { Upload, X } from 'lucide-react';
import { ParserUI } from '../components/Parser';

export function useParserIntegration({ onAssignmentsImported, isDark }) {
  const [showParser, setShowParser] = useState(false);
  
  const handleParseComplete = useCallback((results) => {
    if (onAssignmentsImported) {
      onAssignmentsImported(results);
    }
    setShowParser(false);
  }, [onAssignmentsImported]);
  
  const ParserButton = () => (
    <button
      onClick={() => setShowParser(true)}
      className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
      title="Import Course Content"
    >
      <Upload className="h-5 w-5" />
    </button>
  );
  
  const ParserModal = () => {
    if (!showParser) return null;
    
    return (
      <>
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
              <ParserUI onParseComplete={handleParseComplete} isDark={isDark} />
            </div>
          </div>
        </div>
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
              <ParserUI onParseComplete={handleParseComplete} isDark={isDark} />
            </div>
          </div>
        </div>
      </>
    );
  };
  
  return { showParser, setShowParser, ParserButton, ParserModal };
}
EOF
echo -e "${GREEN}✅ Created: src/hooks/useParserIntegration.jsx${NC}"

# 4. Create integration instructions
cat > PARSER_INTEGRATION.md << 'EOF'
# Parser Integration Instructions

## Quick Integration (Using the Hook)

Add these 4 lines to your App.jsx:

```javascript
// 1. Import the hook (add with other imports)
import { useParserIntegration } from './hooks/useParserIntegration';

// 2. Inside your App component, add:
const { ParserButton, ParserModal } = useParserIntegration({
  onAssignmentsImported: (results) => {
    setAppData(prev => ({
      ...prev,
      assignments: [...prev.assignments, ...results.assignments],
      modules: [...prev.modules, ...(results.modules || [])]
    }));
  },
  isDark
});

// 3. In your header (near the dark mode button), add:
<ParserButton />

// 4. Before the closing </div> of your component, add:
<ParserModal />
```

## Manual Integration

If you prefer to integrate manually, see the code snippets in `scripts/manual-integration.js`

## Testing

1. Click the Upload button in your app header
2. Paste Canvas content or upload a file
3. Select the document type (or use auto-detect)
4. Click "Parse Content"
5. Check that assignments appear in your calendar

## Troubleshooting

- If the button doesn't appear, check that you added `<ParserButton />` in the header
- If the modal doesn't show, ensure you added `<ParserModal />` at the component end
- Check the browser console for any errors
EOF
echo -e "${GREEN}✅ Created: PARSER_INTEGRATION.md${NC}"

# 5. Create a simple test file
cat > test-parser.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Parser Test</title>
    <script type="module">
        // Quick test to verify parsers work
        import { DocumentParsers } from './src/services/DocumentParsers.js';
        
        const testText = `
        NURS330: Nursing of the Childbearing Family
        Week 1: Module 1
        Quiz
        Quiz 1: Introduction
        May 12
        10 pts
        `;
        
        console.log('Testing parser detection...');
        const type = DocumentParsers.detectDocumentType(testText);
        console.log('Detected type:', type);
    </script>
</head>
<body>
    <h1>Parser Test</h1>
    <p>Check the console for results</p>
</body>
</html>
EOF
echo -e "${GREEN}✅ Created: test-parser.html${NC}"

echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Copy the parser files from the artifacts to:"
echo "   - src/services/DocumentParsers.js"
echo "   - src/services/RegexDocumentParser.js"
echo "   - src/components/Parser/ParserUI.jsx"
echo ""
echo "2. Follow the integration instructions in PARSER_INTEGRATION.md"
echo ""
echo "3. Run your app and test the parser button"
echo ""
echo -e "${GREEN}✨ Setup complete!${NC}"
EOF

# Make the script executable
chmod +x setup-parser.sh