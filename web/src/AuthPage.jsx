import { useState } from 'react';
import { api } from './api';

export default function AuthPage({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const data = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (data.error) {
        setError(data.error);
      } else {
        onLogin(data.user);
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ 
      maxWidth: '400px', 
      margin: '50px auto', 
      padding: '20px',
      border: '1px solid #ccc',
      borderRadius: '8px'
    }}>
      <h1>{isRegister ? 'Create Account' : 'Login'}</h1>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '5px' }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: '5px' }}>
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isRegister ? 8 : undefined}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {error && (
          <div style={{ 
            color: 'red', 
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: '#ffe6e6',
            borderRadius: '4px'
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '16px',
            backgroundColor: '#646cff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Loading...' : (isRegister ? 'Register' : 'Login')}
        </button>
      </form>

      <div style={{ marginTop: '15px', textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => {
            setIsRegister(!isRegister);
            setError('');
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#646cff',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          {isRegister ? 'Already have an account? Login' : 'Create account'}
        </button>
      </div>
    </div>
  );
}


