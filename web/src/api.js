export async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });
  
  // Try to parse JSON, fallback to status-based response
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (err) {
      // If JSON parsing fails, return error
      return { error: `HTTP ${response.status}` };
    }
  }
  
  // For non-JSON responses
  if (response.ok) {
    return { success: true };
  } else {
    return { error: `HTTP ${response.status}` };
  }
}

