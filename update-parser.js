// ES Module syntax - uses 'import' instead of 'require'
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// In ES modules, __dirname doesn't exist, so we need to create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to find the project root by looking for package.json
function findProjectRoot(startPath) {
  let currentPath = startPath;
  
  while (currentPath !== '/') {
    if (fs.existsSync(path.join(currentPath, 'package.json'))) {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
  }
  
  throw new Error('Could not find project root (no package.json found)');
}

try {
  // Find the project root from wherever we are
  const projectRoot = findProjectRoot(__dirname);
  console.log(`Found project root at: ${projectRoot}`);
  
  // Look for App.jsx relative to the project root
  const appPath = path.join(projectRoot, 'src', 'App.jsx');
  
  if (!fs.existsSync(appPath)) {
    console.error(`App.jsx not found at: ${appPath}`);
    console.error('Current directory:', __dirname);
    console.error('Project root:', projectRoot);
    process.exit(1);
  }
  
  // Read the file
  let content = fs.readFileSync(appPath, 'utf8');
  
  // Check what needs to be updated
  if (content.includes('new StudioraDualParser()')) {
    // Replace the mock parser instantiation with the real one
    content = content.replace(
      /const parser = new StudioraDualParser\(\);/g,
      'const parser = new StudioraDualParser(import.meta.env.VITE_OPENAI_API_KEY);'
    );
    
    fs.writeFileSync(appPath, content);
    console.log('✅ Successfully updated parser to use API key from environment');
  } else if (content.includes('new StudioraDualParser(import.meta.env.VITE_OPENAI_API_KEY)')) {
    console.log('✅ Parser already uses the API key - no changes needed');
  } else {
    console.log('⚠️  Could not find parser initialization in the file');
    console.log('You may need to add it manually in the handleParse function');
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
}