import { useState } from 'react';
import { api } from '../api.js';
import { ICON } from '../icons.js';

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [parentalPin, setParentalPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body =
        mode === 'login' ? { username, password } : { username, password, parentalPin };
      const data = await api(mode === 'login' ? '/api/login' : '/api/register', {
        method: 'POST',
        body,
      });
      onAuth(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo"><span className="auth-logo-mark">{ICON.rainbow}</span> DisKids</div>
        <p className="auth-tagline">A safe, friendly place to chat with friends!</p>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => { setMode('login'); setError(''); }}
          >
            Log In
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'tab active' : 'tab'}
            onClick={() => { setMode('register'); setError(''); }}
          >
            New Account
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          <label>
            <span>Nickname</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your nickname"
              maxLength={20}
              autoComplete="username"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Shh... secret password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </label>

          {mode === 'register' && (
            <label>
              <span>Parental PIN</span>
              <input
                type="password"
                value={parentalPin}
                onChange={(e) => setParentalPin(e.target.value)}
                placeholder="Ask a grown-up to enter the PIN"
                inputMode="numeric"
                required
              />
              <small className="hint">A grown-up needs to enter the parental PIN to create an account.</small>
            </label>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'One sec...' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-safety">
           {ICON.shield} Safe chat: bad words, phone numbers, and emails are automatically hidden.
           {ICON.lock} No private messages - only friendly group channels.
        </div>
      </div>
    </div>
  );
}