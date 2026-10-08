// debug-env.js - اعرض قيمة DATABASE_URL دون أي تعقيد
const fs = require('fs');

// اقرأ .env يدوياً
const envContent = fs.readFileSync('.env', 'utf8');
console.log('=== محتوى .env الخام ===');
console.log(envContent);
console.log('========================\n');

// اقرأ DATABASE_URL من process.env
require('dotenv').config();
const url = process.env.DATABASE_URL;
console.log('DATABASE_URL length:', url?.length);
console.log('DATABASE_URL starts with:', url?.substring(0, 30));
console.log('DATABASE_URL contains @:', url?.includes('@'));
console.log('DATABASE_URL contains %40:', url?.includes('%40'));

// ابحث عن أحرف خاصة قد تسبب مشكلة
const specialChars = ['@', '#', '&', ':', '/'];
specialChars.forEach(char => {
    const count = (url?.match(new RegExp('\\' + char, 'g')) || []).length;
    console.log(`Count of "${char}":`, count);
});