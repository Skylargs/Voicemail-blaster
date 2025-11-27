export async function fetchCampaign(id) {
  const res = await fetch(`/campaigns/${id}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Failed to load campaign ${id}: ${res.status}`);
  }
  return res.json();
}

export async function fetchCampaignLeads(id) {
  const res = await fetch(`/campaigns/${id}/leads`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Failed to load leads for campaign ${id}: ${res.status}`);
  }
  return res.json();
}

export async function uploadCampaignLeadsCsv(id, csvText) {
  // Simple CSV parser: assume first row is header with "name" and/or "phone" or "number"
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) {
    throw new Error('CSV must have a header row and at least one data row');
  }
  const header = lines[0]
    .split(',')
    .map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf('name');
  // Support both "phone" and "number" column names
  const phoneIdx = header.indexOf('phone') !== -1 ? header.indexOf('phone') : header.indexOf('number');
  if (phoneIdx === -1) {
    throw new Error('CSV must contain a "phone" or "number" column');
  }
  const leads = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const phone = cols[phoneIdx];
    if (!phone) continue;
    const name = nameIdx >= 0 ? cols[nameIdx] || null : null;
    // Backend expects "number" field
    leads.push({ name, number: phone });
  }
  if (!leads.length) {
    throw new Error('No valid leads with phone numbers found in CSV');
  }
  const res = await fetch(`/campaigns/${id}/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ leads }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to upload leads: ${res.status} ${text}`);
  }
  return res.json();
}

export async function blastCampaign(id) {
  const res = await fetch(`/campaigns/${id}/blast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({}), // body can be empty; backend uses campaignId
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Surface TWILIO_NOT_CONFIGURED as a typed error
    if (data && data.code === 'TWILIO_NOT_CONFIGURED') {
      const err = new Error(data.message || 'Twilio not configured');
      err.code = 'TWILIO_NOT_CONFIGURED';
      throw err;
    }
    const err = new Error(data.error || 'Failed to start blast');
    err.code = data.code || 'BLAST_FAILED';
    throw err;
  }
  return data;
}

