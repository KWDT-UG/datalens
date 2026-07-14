import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { ApiClientError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

type RedirectState = {
  from?: {
    pathname?: string;
  };
};

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = (location.state as RedirectState | null)?.from?.pathname ?? '/dashboard';

  if (auth.isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await auth.login(username, password);
      navigate(redirectTo, { replace: true });
    } catch (caughtError) {
      if (caughtError instanceof ApiClientError) {
        setError(caughtError.message);
      } else {
        setError('Unable to sign in right now.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div>
          <p className="login-panel__eyebrow">KWDT Data Lens</p>
          <h1 id="login-title">Sign in</h1>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          {error ? <div className="form-alert form-alert--error">{error}</div> : null}
          <label className="form-field">
            <span>Username</span>
            <input
              autoComplete="username"
              autoFocus
              onChange={(event) => setUsername(event.target.value)}
              required
              type="text"
              value={username}
            />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <Link className="login-panel__text-link" to="/forgot-password">
            Forgot password?
          </Link>
          <button className="button button--primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
