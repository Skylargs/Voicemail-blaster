// web/src/lib/voicemailClient.js

export async function fetchVoicemailAudios() {
  const res = await fetch('/voicemail-audio', {
    method: 'GET',
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Failed to load voicemail audio library');
  }

  const data = await res.json();
  return data.items || [];
}

export async function uploadVoicemailAudio(file, name) {
  const formData = new FormData();
  formData.append('file', file);
  if (name) {
    formData.append('name', name);
  }

  const res = await fetch('/voicemail-audio', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to upload voicemail audio');
  }

  return res.json();
}

export async function attachVoicemailToCampaign(campaignId, voicemailAudioId) {
  const res = await fetch(`/campaigns/${campaignId}/voicemail`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ voicemailAudioId }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Failed to attach voicemail audio to campaign');
  }

  return data;
}

