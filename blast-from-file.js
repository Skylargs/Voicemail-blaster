require('dotenv').config();
const fs = require('fs');
const fetch = require('node-fetch');

async function main() {
  const publicBaseUrl = process.env.PUBLIC_BASE_URL;

  if (!publicBaseUrl) {
    console.error('PUBLIC_BASE_URL missing in .env');
    process.exit(1);
  }

  // Load numbers.json
  let payload;
  try {
    const raw = fs.readFileSync('./numbers.json', 'utf8');
    payload = JSON.parse(raw);
  } catch (err) {
    console.error('Error reading numbers.json:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(payload.numbers) || payload.numbers.length === 0) {
    console.error('numbers.json must contain a non-empty "numbers" array');
    process.exit(1);
  }

  console.log(`Blasting ${payload.numbers.length} numbers...`);

  const res = await fetch(`${publicBaseUrl}/blast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

main().catch(err => {
  console.error('Error in blast-from-file:', err);
  process.exit(1);
});

