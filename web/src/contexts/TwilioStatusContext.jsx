// web/src/contexts/TwilioStatusContext.jsx

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const TwilioStatusContext = createContext(null);

export function TwilioStatusProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [hasConfig, setHasConfig] = useState(false);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/settings/twilio', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load Twilio settings: ${res.status}`);
      }

      const data = await res.json();
      setHasConfig(Boolean(data.hasConfig));
      setConfig(data.config || null);
    } catch (err) {
      console.error('Error fetching Twilio status:', err);
      setError(err);
      setHasConfig(false);
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const value = {
    loading,
    hasConfig,
    config,
    error,
    refresh: fetchStatus,
  };

  return (
    <TwilioStatusContext.Provider value={value}>
      {children}
    </TwilioStatusContext.Provider>
  );
}

export function useTwilioStatus() {
  const ctx = useContext(TwilioStatusContext);
  if (!ctx) {
    throw new Error('useTwilioStatus must be used within TwilioStatusProvider');
  }
  return ctx;
}

