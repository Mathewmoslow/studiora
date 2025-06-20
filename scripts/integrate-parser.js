// scripts/integrate-parser.js
// Run with: node scripts/integrate-parser.js

const fs = require('fs');
const path = require('path');

// Configuration
const APP_FILE_PATH = path.join(process.cwd(), 'src', 'App.jsx');
const BACKUP_PATH = path.join(process.cwd(), 'src', 'App.jsx.backup');

// Code snippets to inject
const IMPORT_STATEMENT = "import { ParserUI } from './components/Parser';";
const UPLOAD_ICON_IMPORT = ", Upload";
const X_ICON_IMPORT = ", X";

const STATE_DECLARATION = "  const [showParser, setShowParser] = useState(false);";

const HANDLER_FUNCTION = `
  // Handler for parsed results
  const handleParseComplete = (results) => {
    // Add assignments to your app data
    setAppData(prev => ({
      ...prev,
      assignments: [...prev.assignments, ...results.assignments],
      modules: [...prev.modules, ...(results.modules || [])]
    }));
    
    // Close parser
    setShowParser(false);
    
    // Show success message
    toast?.success(\`Imported \${results.assignments.length} assignments\`);
  };`;

const PARSER_BUTTON = `
            <button
              onClick={() => setShowParser(true)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Import Course Content"
            >
              <Upload className="h-5 w-5" />
            </button>`;

const PARSER_MODAL = `
      {/* Parser Modal */}
      {showParser && (
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
      )}`;

function updateAppFile() {
  try {
    // Check if App.jsx exists
    if (!fs.existsSync(APP_FILE_PATH)) {
      console.error('❌ App.jsx not found at:', APP_FILE_PATH);
      console.log('Make sure you run this script from your project root directory');
      return;
    }

    // Create backup
    console.log('📁 Creating backup...');
    fs.copyFileSync(APP_FILE_PATH, BACKUP_PATH);
    console.log('✅ Backup created at:', BACKUP_PATH);

    // Read the file
    let content = fs.readFileSync(APP_FILE_PATH, 'utf8');
    const originalContent = content;

    // Step 1: Add imports
    console.log('📝 Adding imports...');
    
    // Add ParserUI import after other component imports
    if (!content.includes("import { ParserUI }")) {
      const componentImportRegex = /import\s+{[^}]+}\s+from\s+['"]\.\/components[^'"]+['"];?/g;
      const matches = content.match(componentImportRegex);
      if (matches && matches.length > 0) {
        const lastComponentImport = matches[matches.length - 1];
        const insertPosition = content.indexOf(lastComponentImport) + lastComponentImport.length;
        content = content.slice(0, insertPosition) + '\n' + IMPORT_STATEMENT + content.slice(insertPosition);
      } else {
        // If no component imports found, add after React import
        const reactImportMatch = content.match(/import\s+React[^;]*;/);
        if (reactImportMatch) {
          const insertPosition = content.indexOf(reactImportMatch[0]) + reactImportMatch[0].length;
          content = content.slice(0, insertPosition) + '\n' + IMPORT_STATEMENT + content.slice(insertPosition);
        }
      }
    }

    // Add Upload and X icons to lucide-react import
    const lucideImportRegex = /import\s+{([^}]+)}\s+from\s+['"]lucide-react['"];?/;
    const lucideMatch = content.match(lucideImportRegex);
    if (lucideMatch) {
      const icons = lucideMatch[1];
      if (!icons.includes('Upload')) {
        content = content.replace(lucideMatch[0], lucideMatch[0].replace(icons, icons + UPLOAD_ICON_IMPORT));
      }
      if (!icons.includes('X')) {
        const updatedLucideMatch = content.match(lucideImportRegex);
        const updatedIcons = updatedLucideMatch[1];
        content = content.replace(updatedLucideMatch[0], updatedLucideMatch[0].replace(updatedIcons, updatedIcons + X_ICON_IMPORT));
      }
    }

    // Step 2: Add state declaration
    console.log('📝 Adding state declaration...');
    if (!content.includes('showParser')) {
      // Find where other useState declarations are
      const useStateRegex = /const\s+\[[^\]]+\]\s*=\s*useState\([^)]*\);/g;
      const useStateMatches = [...content.matchAll(useStateRegex)];
      if (useStateMatches.length > 0) {
        const lastUseState = useStateMatches[useStateMatches.length - 1];
        const insertPosition = lastUseState.index + lastUseState[0].length;
        content = content.slice(0, insertPosition) + '\n' + STATE_DECLARATION + content.slice(insertPosition);
      }
    }

    // Step 3: Add handler function
    console.log('📝 Adding handler function...');
    if (!content.includes('handleParseComplete')) {
      // Find a good position for the handler (after state declarations, before return)
      const returnMatch = content.match(/return\s*\(/);
      if (returnMatch) {
        const insertPosition = returnMatch.index;
        content = content.slice(0, insertPosition) + HANDLER_FUNCTION + '\n\n  ' + content.slice(insertPosition);
      }
    }

    // Step 4: Add parser button in header
    console.log('📝 Adding parser button...');
    if (!content.includes('Upload') || !content.includes('setShowParser(true)')) {
      // Find the header actions section (look for dark mode toggle button)
      const darkModeButtonRegex = /onDarkModeToggle[^}]+}\s*>/;
      const darkModeMatch = content.match(darkModeButtonRegex);
      if (darkModeMatch) {
        const insertPosition = darkModeMatch.index + darkModeMatch[0].length;
        // Find the closing tag of the button
        let closingTagPos = content.indexOf('</button>', insertPosition);
        if (closingTagPos !== -1) {
          closingTagPos = content.indexOf('>', closingTagPos) + 1;
          content = content.slice(0, closingTagPos) + '\n' + PARSER_BUTTON + content.slice(closingTagPos);
        }
      }
    }

    // Step 5: Add parser modal before closing tags
    console.log('📝 Adding parser modal...');
    if (!content.includes('Parser Modal')) {
      // Find the last closing div before the function closing
      const functionEndRegex = /(\s*<\/div>\s*\);\s*})/;
      const match = content.match(functionEndRegex);
      if (match) {
        const insertPosition = match.index;
        content = content.slice(0, insertPosition) + '\n' + PARSER_MODAL + '\n' + content.slice(insertPosition);
      }
    }

    // Step 6: Ensure toast is available (if using toast notifications)
    if (content.includes('toast?.success') && !content.includes('useToast')) {
      console.log('ℹ️  Note: Update the success notification to match your notification system');
    }

    // Write the updated content
    if (content !== originalContent) {
      fs.writeFileSync(APP_FILE_PATH, content);
      console.log('✅ App.jsx updated successfully!');
      console.log('\n📋 Next steps:');
      console.log('1. Review the changes in App.jsx');
      console.log('2. Update the toast notification to match your system');
      console.log('3. Test the parser button in your app');
      console.log('\nIf something went wrong, restore from:', BACKUP_PATH);
    } else {
      console.log('ℹ️  No changes needed - parser integration already exists');
    }

  } catch (error) {
    console.error('❌ Error updating App.jsx:', error.message);
    console.log('\nPlease update App.jsx manually using the provided code snippets');
  }
}

// Alternative: Generate a patch file
function generatePatchFile() {
  const patchContent = `
// ===== PARSER INTEGRATION PATCH =====
// Add these changes to your App.jsx file

// 1. Add to imports section:
${IMPORT_STATEMENT}

// 2. Add Upload and X to your lucide-react import:
// import { ..., Upload, X } from 'lucide-react';

// 3. Add state declaration with other useState calls:
${STATE_DECLARATION}

// 4. Add handler function before return statement:
${HANDLER_FUNCTION}

// 5. Add parser button in header (near dark mode toggle):
${PARSER_BUTTON}

// 6. Add parser modal before closing </div> tags:
${PARSER_MODAL}
`;

  const patchPath = path.join(process.cwd(), 'parser-integration.patch.js');
  fs.writeFileSync(patchPath, patchContent);
  console.log('📄 Patch file created at:', patchPath);
}

// Run the update
console.log('🚀 Starting App.jsx integration...\n');

// Check for flags
const args = process.argv.slice(2);
if (args.includes('--patch')) {
  generatePatchFile();
} else {
  updateAppFile();
  console.log('\n💡 Tip: Run with --patch flag to generate a patch file instead');
}