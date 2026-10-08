const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

client.connect()
  .then(() => {
    console.log('✅ SUCCESS - Connected to Supabase!');
    return client.query('SELECT NOW() as now');
  })
  .then(res => {
    console.log('📅 Server time:', res.rows[0].now);
    client.end();
  })
  .catch(err => {
    console.error('❌ FAILED:', err.message);
    console.error('Error code:', err.code);
    client.end();
  });