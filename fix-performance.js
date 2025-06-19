const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'App.tsx'); // Adjust path as needed
let content = fs.readFileSync(filePath, 'utf8');

// Replace all setTimeout delays with Promise.resolve()
content = content.replace(/await new Promise\(resolve => setTimeout\(resolve, \d+\)\);/g, 'await Promise.resolve();');

// Add defer to handleParse
content = content.replace(
  /const handleParse = async \(\) => {\s*setIsLoading\(true\);\s*setProgress\(\[\]\);/g,
  'const handleParse = async () => {\n    setIsLoading(true);\n    setProgress([]);\n    \n    // Defer heavy computation to next tick\n    await Promise.resolve();'
);

fs.writeFileSync(filePath, content);
console.log('Performance fixes applied!');
