// setup-env.js
const fs = require('fs');

// ✅ ضع Connection String الكامل من Supabase هنا
const DATABASE_URL = "postgresql://postgres.vhfmprenvbgredqraczv:Z94q6Hb5u5pa9026@aws-0-london.pooler.supabase.com:6543/postgres?pgbouncer=true";

const envContent = `DATABASE_URL="${DATABASE_URL}"\n`;

fs.writeFileSync('.env', envContent, 'utf8');

console.log('✅ .env created successfully!');
console.log('Content:');
console.log(envContent);
console.log('File location: C:\\STSS\\.env');