import { useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';

interface SettingsScreenProps {
  session: Session | null;
  online: boolean;
  supabaseConfigured: boolean;
  syncLabel: string;
  syncing: boolean;
  onBack: () => void;
  onSync: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function SettingsScreen({
  session,
  online,
  supabaseConfigured,
  syncLabel,
  syncing,
  onBack,
  onSync,
  onSignIn,
  onSignUp,
  onSignOut
}: SettingsScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (mode === 'sign-in') {
        await onSignIn(email, password);
      } else {
        await onSignUp(email, password);
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    setError(null);

    try {
      await onSignOut();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Sign out failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-screen settings-screen">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Account</h1>
        </div>
        <button className="button secondary compact" type="button" onClick={onBack}>
          Back
        </button>
      </header>

      <section className="settings-panel">
        <h2>Sync</h2>
        <p className="muted">{syncLabel}</p>
        <p className="muted">{online ? 'Network is available.' : 'Network is offline.'}</p>

        {session ? (
          <>
            <div className="account-box">
              <span>Signed in as</span>
              <strong>{session.user.email}</strong>
            </div>
            <div className="button-row">
              <button
                className="button primary"
                type="button"
                onClick={onSync}
                disabled={!online || syncing}
              >
                {syncing ? 'Syncing...' : 'Sync now'}
              </button>
              <button className="button secondary" type="button" onClick={handleSignOut} disabled={busy}>
                Sign out
              </button>
            </div>
          </>
        ) : supabaseConfigured ? (
          <form className="auth-form" onSubmit={handleAuth}>
            <div className="segmented-control" role="group" aria-label="Authentication mode">
              <button
                className={mode === 'sign-in' ? 'selected' : ''}
                type="button"
                onClick={() => setMode('sign-in')}
              >
                Sign in
              </button>
              <button
                className={mode === 'sign-up' ? 'selected' : ''}
                type="button"
                onClick={() => setMode('sign-up')}
              >
                Sign up
              </button>
            </div>

            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            {error ? <p className="form-error">{error}</p> : null}

            <button className="button primary" type="submit" disabled={busy}>
              {busy ? 'Working...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        ) : (
          <div className="empty-state inline">
            <h2>Supabase is not configured</h2>
            <p>
              Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment to
              enable account sync.
            </p>
          </div>
        )}

        {session && error ? <p className="form-error">{error}</p> : null}
      </section>
    </main>
  );
}
