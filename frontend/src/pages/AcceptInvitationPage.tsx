import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ApiClientError } from '../api/client';
import { useAcceptInvitationMutation } from '../api/queries';

export function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const acceptInvitation = useAcceptInvitationMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!token) {
      setError('This invitation link is missing its token.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    try {
      await acceptInvitation.mutateAsync({ token, username, password });
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : 'Unable to accept this invitation.'
      );
    }
  }

  if (acceptInvitation.isSuccess) {
    return (
      <main className="login-page">
        <section className="login-panel">
          <p className="login-panel__eyebrow">KWDT Data Lens</p>
          <h1>Invitation accepted</h1>
          <p>Your account is ready. You can now sign in.</p>
          <Link className="button button--primary" to="/login">
            Continue to sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="accept-invitation-title">
        <div>
          <p className="login-panel__eyebrow">KWDT Data Lens</p>
          <h1 id="accept-invitation-title">Accept invitation</h1>
          <p>Choose your username and password to activate your account.</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          {error ? <div className="form-alert form-alert--error">{error}</div> : null}
          <label className="form-field">
            <span>Username</span>
            <input
              autoComplete="username"
              autoFocus
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input
              autoComplete="new-password"
              minLength={8}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Confirm password</span>
            <input
              autoComplete="new-password"
              minLength={8}
              required
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <button className="button button--primary" disabled={acceptInvitation.isPending}>
            {acceptInvitation.isPending ? 'Activating...' : 'Activate account'}
          </button>
        </form>
      </section>
    </main>
  );
}
