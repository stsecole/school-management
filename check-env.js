const fs = require('fs');

console.log('=== Current Directory ===');
console.log(process.cwd());
console.log('');

console.log('=== Looking for .env file ===');
const envPath = '.env';
console.log('Path:', envPath);
console.log('Exists:', fs.existsSync(envPath));
console.log('');

if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    console.log('=== .env Content (raw) ===');
    console.log(JSON.stringify(content));
    console.log('');
    console.log('=== .env Content (display) ===');
    console.log(content);
    console.log('');
    
    if (!content.includes('DATABASE_URL')) {
        console.log('⚠️ WARNING: DATABASE_URL not found in .env file!');
    }
}