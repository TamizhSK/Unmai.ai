const fs = require('fs');
const path = require('path');

function fixImports(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      fixImports(filePath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Fix broken import lines
      content = content.replace(/import { [^}]+ } from '@\/lib\/api-client[^;]*/g, (match) => {
        // Extract the type names from the import
        const typeMatch = match.match(/import { ([^}]+) }/);
        if (typeMatch) {
          const types = typeMatch[1];
          return `import { ${types} } from '@/lib/api-client';`;
        }
        return match;
      });
      
      // Fix any remaining broken lines
      content = content.replace(/from '@\/lib\/api-client[^;]*/g, "from '@/lib/api-client';");
      
      fs.writeFileSync(filePath, content);
    }
  }
}

fixImports('./src');
console.log('Fixed all imports');
