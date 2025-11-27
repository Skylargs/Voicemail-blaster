export async function fetchBillingUsage() {
  const res = await fetch('/billing/usage', {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Failed to load billing usage: ${res.status}`);
  }
  return res.json();
}

export async function fetchBillingStatus() {
  const res = await fetch('/billing/status', {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Failed to load billing status: ${res.status}`);
  }
  return res.json();
}

export async function startBillingSubscription() {
  const res = await fetch('/billing/start', {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to start billing: ${res.status} ${text}`);
  }
  return res.json();
}

export async function openBillingPortal() {
  const res = await fetch('/billing/portal', {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to open billing portal: ${res.status} ${text}`);
  }
  const data = await res.json();
  if (data.url) {
    window.location.href = data.url;
  }
  return data;
}

export function centsToDollars(cents) {
  return (cents || 0) / 100;
}

