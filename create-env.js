const fs = require('fs');

// ✅ الرابط الصحيح من Neon (بدون channel_binding)
const envContent = `DATABASE_URL="postgresql://neondb_owner:npg_wQU9L3hbVORA@ep-round-feather-b2s0e9yw-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require"
`;

fs.writeFileSync('.env', envContent, 'utf8');
console.log('✅ .env created successfully!');
console.log('Content:');
console.log(envContent);