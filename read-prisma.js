const fs = require('fs');
const content = fs.readFileSync('node_modules/@prisma/client/default.js', 'utf8');
console.log(content.substring(0, 500));
