// blast-from-csv.js

require('dotenv').config();

const fs = require('fs');

const path = require('path');

const fetch = require('node-fetch');

const CSV_FILE = path.join(__dirname, 'leads.csv');

function parseCsvPhones(csvText) {

  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  if (lines.length <= 1) return [];

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());

  const phoneIdx = header.indexOf('phone');

  if (phoneIdx === -1) {

    throw new Error('CSV must contain a "phone" column');

  }

  const numbers = [];

  for (let i = 1; i < lines.length; i++) {

    const cols = lines[i].split(',').map(c => c.trim());

    const phone = cols[phoneIdx];

    if (!phone) continue;

    const cleaned = phone.replace(/[\s\-\(\)]/g, '');

    const normalized =

      cleaned.startsWith('+') ? cleaned :

      cleaned.startsWith('1') ? '+' + cleaned :

      '+1' + cleaned;

    numbers.push(normalized);

  }

  return numbers;

}

async function main() {

  const publicBaseUrl = process.env.PUBLIC_BASE_URL;

  if (!publicBaseUrl) {

    console.error('PUBLIC_BASE_URL missing in .env');

    process.exit(1);

  }

  let csv;

  try {

    csv = fs.readFileSync(CSV_FILE, 'utf8');

  } catch (err) {

    console.error(`Error reading ${CSV_FILE}:`, err.message);

    process.exit(1);

  }

  let numbers;

  try {

    numbers = parseCsvPhones(csv);

  } catch (err) {

    console.error('Error parsing CSV:', err.message);

    process.exit(1);

  }

  if (!numbers.length) {

    console.error('No valid phone numbers found in CSV');

    process.exit(1);

  }

  console.log(`Blasting ${numbers.length} numbers from CSV...`);

  const res = await fetch(`${publicBaseUrl}/blast`, {

    method: 'POST',

    headers: { 'Content-Type': 'application/json' },

    body: JSON.stringify({ numbers })

  });

  const data = await res.json();

  console.log('Blast result:', JSON.stringify(data, null, 2));

}

main().catch(err => {

  console.error('Error in blast-from-csv:', err);

  process.exit(1);

});
