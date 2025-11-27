import { useState, useEffect } from 'react';
import { api } from './api';

export default function Dashboard({ onLogout }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Create campaign form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [creating, setCreating] = useState(false);

  // Add leads form
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [leadsText, setLeadsText] = useState('');
  const [addingLeads, setAddingLeads] = useState(false);

  // Blast results
  const [blastResults, setBlastResults] = useState({});

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const data = await api('/auth/me');
      if (data.error || !data.user) {
        onLogout();
        return;
      }
      loadCampaigns();
    } catch (err) {
      console.error('Session check error:', err);
      onLogout();
    }
  }

  async function loadCampaigns() {
    try {
      setLoading(true);
      const data = await api('/campaigns');
      if (data.error) {
        if (data.error.includes('401') || data.error.includes('Unauthorized')) {
          onLogout();
          return;
        }
        setError(data.error);
      } else {
        setCampaigns(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Load campaigns error:', err);
      setError('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCampaign(e) {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const data = await api('/campaigns', {
        method: 'POST',
        body: JSON.stringify({ name: campaignName, fromNumber })
      });

      if (data.error) {
        setError(data.error);
      } else {
        setCampaignName('');
        setFromNumber('');
        setShowCreateForm(false);
        loadCampaigns();
      }
    } catch (err) {
      setError('Failed to create campaign');
      console.error('Create campaign error:', err);
    } finally {
      setCreating(false);
    }
  }

  async function handleAddLeads(campaignId) {
    if (!leadsText.trim()) {
      setError('Please enter leads');
      return;
    }

    setAddingLeads(true);
    setError('');

    try {
      // Parse leads from textarea (format: name,phone)
      const lines = leadsText.trim().split('\n').filter(line => line.trim());
      const leads = lines.map(line => {
        const [name, number] = line.split(',').map(s => s.trim());
        return { name: name || null, number };
      }).filter(lead => lead.number);

      if (leads.length === 0) {
        setError('No valid leads found. Format: name,phone');
        setAddingLeads(false);
        return;
      }

      const data = await api(`/campaigns/${campaignId}/leads`, {
        method: 'POST',
        body: JSON.stringify({ leads })
      });

      if (data.error) {
        setError(data.error);
      } else {
        setLeadsText('');
        setSelectedCampaign(null);
        loadCampaigns();
      }
    } catch (err) {
      setError('Failed to add leads');
      console.error('Add leads error:', err);
    } finally {
      setAddingLeads(false);
    }
  }

  async function handleBlast(campaignId) {
    setError('');

    try {
      const data = await api(`/campaigns/${campaignId}/blast`, {
        method: 'POST'
      });

      if (data.error) {
        setError(data.error);
      } else {
        setBlastResults(prev => ({
          ...prev,
          [campaignId]: data
        }));
        loadCampaigns();
      }
    } catch (err) {
      setError('Failed to start blast');
      console.error('Blast error:', err);
    }
  }

  function formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Dashboard</h1>
        <button
          onClick={onLogout}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px',
          marginBottom: '20px',
          backgroundColor: '#ffe6e6',
          color: 'red',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#646cff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {showCreateForm ? 'Cancel' : 'Create Campaign'}
        </button>

        {showCreateForm && (
          <form onSubmit={handleCreateCampaign} style={{
            marginTop: '15px',
            padding: '15px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: '#f9f9f9'
          }}>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Campaign Name
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                From Number
              </label>
              <input
                type="text"
                value={fromNumber}
                onChange={(e) => setFromNumber(e.target.value)}
                placeholder="+1234567890"
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: creating ? 'not-allowed' : 'pointer',
                opacity: creating ? 0.6 : 1
              }}
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </form>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Campaigns</h2>
        {campaigns.length === 0 ? (
          <p>No campaigns yet. Create one to get started.</p>
        ) : (
          campaigns.map((campaign) => (
            <div
              key={campaign.id}
              style={{
                marginBottom: '20px',
                padding: '15px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: '#fff'
              }}
            >
              <div style={{ marginBottom: '10px' }}>
                <h3 style={{ margin: '0 0 10px 0' }}>{campaign.name}</h3>
                <div style={{ color: '#666', fontSize: '14px' }}>
                  <div>From: {campaign.fromNumber}</div>
                  <div>Created: {formatDate(campaign.createdAt)}</div>
                  <div>
                    Leads: {campaign._count?.leads || 0} | 
                    Call Logs: {campaign._count?.callLogs || 0}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSelectedCampaign(selectedCampaign === campaign.id ? null : campaign.id)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {selectedCampaign === campaign.id ? 'Cancel' : 'Add Leads'}
                </button>

                <button
                  onClick={() => handleBlast(campaign.id)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Start Blast
                </button>
              </div>

              {selectedCampaign === campaign.id && (
                <div style={{
                  marginTop: '15px',
                  padding: '15px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '4px'
                }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>
                    Paste leads (format: name,phone - one per line)
                  </label>
                  <textarea
                    value={leadsText}
                    onChange={(e) => setLeadsText(e.target.value)}
                    placeholder="John Doe,+1234567890&#10;Jane Smith,+0987654321"
                    rows={5}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      fontFamily: 'monospace'
                    }}
                  />
                  <button
                    onClick={() => handleAddLeads(campaign.id)}
                    disabled={addingLeads}
                    style={{
                      marginTop: '10px',
                      padding: '8px 16px',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: addingLeads ? 'not-allowed' : 'pointer',
                      opacity: addingLeads ? 0.6 : 1
                    }}
                  >
                    {addingLeads ? 'Adding...' : 'Add Leads'}
                  </button>
                </div>
              )}

              {blastResults[campaign.id] && (
                <div style={{
                  marginTop: '15px',
                  padding: '15px',
                  backgroundColor: '#e7f3ff',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}>
                  <strong>Blast Results:</strong>
                  <pre style={{ marginTop: '10px', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(blastResults[campaign.id], null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

