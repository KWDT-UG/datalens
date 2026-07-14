import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ApiClientError } from '../api/client';
import {
  usePasswordResetConfirmMutation,
  usePasswordResetRequestMutation,
  usePasswordResetTokenQuery
} from '../api/queries';

export function PasswordResetPage() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('uid') ?? '';
  const token = searchParams.get('token') ?? '';
  const isConfirming = Boolean(uid || token);

  if (isConfirming) {
    return <PasswordResetConfirmForm token={token} uid={uid} />;
  }

  return <PasswordResetRequestForm />;
}

function PasswordResetRequestForm() {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const resetRequest = usePasswordResetRequestMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      await resetRequest.mutateAsync({ identifier });
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : 'Unable to request a password reset right now.'
      );
    }
  }

  if (resetRequest.isSuccess) {
    return (
      <main className="login-page">
        <section className="login-panel">
          <p className="login-panel__eyebrow">KWDT Data Lens</p>
          <h1>Check your email</h1>
          <p>{resetRequest.data.data.message}</p>
          <Link className="button button--primary" to="/login">
            Back to sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="password-reset-request-title">
        <div>
          <p className="login-panel__eyebrow">KWDT Data Lens</p>
          <h1 id="password-reset-request-title">Reset password</h1>
          <p>Enter your username or email address and we will send reset instructions.</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          {error ? <div className="form-alert form-alert--error">{error}</div> : null}
          <label className="form-field">
            <span>Username or email</span>
            <input
              autoComplete="username"
              autoFocus
              onChange={(event) => setIdentifier(event.target.value)}
              required
              type="text"
              value={identifier}
            />
          </label>
          <button className="button button--primary" disabled={resetRequest.isPending}>
            {resetRequest.isPending ? 'Sending...' : 'Send reset instructions'}
          </button>
          <Link className="login-panel__text-link" to="/login">
            Back to sign in
          </Link>
        </form>
      </section>
    </main>
  );
}

function PasswordResetConfirmForm({ token, uid }: { token: string; uid: string }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const resetConfirm = usePasswordResetConfirmMutation();
  const tokenQuery = usePasswordResetTokenQuery(uid, token);
  const linkIsComplete = Boolean(uid && token);
  const tokenIsValid = Boolean(tokenQuery.data?.data.valid);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!linkIsComplete) {
      setError('This password reset link is missing required information.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    try {
      await resetConfirm.mutateAsync({
        uid,
        token,
        new_password: password
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : 'Unable to reset your password.'
      );
    }
  }

  if (resetConfirm.isSuccess) {
    return (
      <main className="login-page">
        <section className="login-panel">
          <p className="login-panel__eyebrow">KWDT Data Lens</p>
          <h1>Password reset</h1>
          <p>Your password has been updated. You can now sign in.</p>
          <Link className="button button--primary" to="/login">
            Continue to sign in
          </Link>
        </section>
      </main>
    );
  }

  if (linkIsComplete && tokenQuery.isLoading) {
    return (
      <main className="login-page">
        <section className="login-panel">
          <p className="login-panel__eyebrow">KWDT Data Lens</p>
          <h1>Checking link</h1>
          <p>We are confirming this password reset link.</p>
        </section>
      </main>
    );
  }

  if (!linkIsComplete || tokenQuery.isError || (tokenQuery.isSuccess && !tokenIsValid)) {
    return (
      <main className="login-page">
        <section className="login-panel">
          <p className="login-panel__eyebrow">KWDT Data Lens</p>
          <h1>Reset link expired</h1>
          <p>This password reset link is invalid, expired, or has already been used.</p>
          <Link className="button button--primary" to="/forgot-password">
            Request a new link
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="password-reset-confirm-title">
        <div>
          <p className="login-panel__eyebrow">KWDT Data Lens</p>
          <h1 id="password-reset-confirm-title">Choose a new password</h1>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          {error ? <div className="form-alert form-alert--error">{error}</div> : null}
          <label className="form-field">
            <span>New password</span>
            <input
              autoComplete="new-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <label className="form-field">
            <span>Confirm password</span>
            <input
              autoComplete="new-password"
              minLength={8}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>
          <button
            className="button button--primary"
            disabled={resetConfirm.isPending || !tokenIsValid}
          >
            {resetConfirm.isPending ? 'Resetting...' : 'Reset password'}
          </button>
          <Link className="login-panel__text-link" to="/forgot-password">
            Request a new link
          </Link>
        </form>
      </section>
    </main>
  );
}
