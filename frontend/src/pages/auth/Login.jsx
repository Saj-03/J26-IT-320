import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRightIcon, MailIcon, LockIcon } from 'lucide-react';
import { AuthLayout, AuthHeading, AuthField, AuthSubmit, AuthError } from './AuthLayout';
import { useAuth } from '../../shared/context/AuthContext';
import { apiErrorMessage } from '../../shared/api/client';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password, remember);
      navigate('/app');
    } catch (err) {
      setError(apiErrorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout variant="login">
      <AuthHeading eyebrow="Log in" title="Welcome" accent="back." sub="Pick up right where you left off — your plan, goals and check-ins are waiting." />

      <form className="space-y-5" onSubmit={submit}>
        <AuthField label="Email" name="email" type="email" icon={MailIcon} placeholder="you@university.edu" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <AuthField label="Password" name="password" type="password" icon={LockIcon} placeholder="••••••••" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        <AuthError>{error}</AuthError>

        <div data-auth-in className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2 font-medium text-charcoal-light">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-black/20 accent-brand-500" />
            Remember me
          </label>
          <a href="#" className="font-semibold text-brand-600 hover:text-brand-700">Forgot password?</a>
        </div>

        <AuthSubmit busy={busy} busyLabel="Logging in…">
          Log in <ArrowRightIcon size={17} className="transition group-hover:translate-x-1" />
        </AuthSubmit>
      </form>

      <p data-auth-in className="mt-7 text-center text-sm text-charcoal-muted">
        New to ThriveU?{' '}
        <Link to="/register" className="font-semibold text-brand-600 underline decoration-brand-300 underline-offset-4 hover:decoration-brand-600">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
