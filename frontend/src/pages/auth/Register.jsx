import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRightIcon, MailIcon, LockIcon, UserIcon, SchoolIcon } from 'lucide-react';
import { AuthLayout, AuthHeading, AuthField, AuthSubmit, AuthError } from './AuthLayout';
import { useAuth } from '../../shared/context/AuthContext';
import { apiErrorMessage } from '../../shared/api/client';

const YEARS = ['1st', '2nd', '3rd', '4th'];

export function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [f, setF] = useState({ full_name: '', email: '', password: '', confirm: '', university: '', research_consent: false });
  const [year, setYear] = useState('2nd');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (f.password.length < 8) return setError('Password must be at least 8 characters');
    if (/^\d+$/.test(f.password) || /^[a-zA-Z]+$/.test(f.password)) return setError('Use a mix of letters and numbers or symbols in your password');
    if (f.password !== f.confirm) return setError('Passwords do not match');
    setError('');
    setBusy(true);
    try {
      const { confirm, university, ...form } = f;
      await register({ ...form, university: university.trim() || null, year_of_study: YEARS.indexOf(year) + 1 });
      navigate('/onboarding');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the account'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout variant="register">
      <AuthHeading eyebrow="Create account" title="Start your" accent="journey." sub="One place to explore, plan, stay balanced and keep moving." />

      <form className="space-y-4" onSubmit={submit}>
        <AuthField label="Full name" name="full_name" icon={UserIcon} placeholder="Awantha Perera" autoComplete="name" value={f.full_name} onChange={set('full_name')} required />
        <AuthField label="University email" name="email" type="email" icon={MailIcon} placeholder="you@university.edu" autoComplete="email" value={f.email} onChange={set('email')} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField label="Password" name="password" type="password" icon={LockIcon} placeholder="••••••••" autoComplete="new-password" value={f.password} onChange={set('password')} minLength={8} maxLength={72} required />
          <AuthField label="Confirm" name="confirm" type="password" icon={LockIcon} placeholder="••••••••" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} minLength={8} maxLength={72} required />
        </div>
        <p data-auth-in className="-mt-2 text-xs text-charcoal-muted">At least 8 characters, mixing letters with numbers or symbols.</p>
        <AuthField label="University" name="university" icon={SchoolIcon} placeholder="University of Westford" autoComplete="organization" value={f.university} onChange={set('university')} />

        <div data-auth-in className="space-y-1.5">
          <p className="text-[13px] font-semibold text-charcoal">Year of study</p>
          <div role="radiogroup" className="grid grid-cols-4 gap-1 rounded-xl border border-black/10 bg-white p-1">
            {YEARS.map((y) => (
              <button
                key={y}
                type="button"
                role="radio"
                aria-checked={year === y}
                onClick={() => setYear(y)}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  year === y ? 'bg-brand-500 text-white shadow-glow' : 'text-charcoal-light hover:bg-black/[0.04]'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        <label data-auth-in className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-peach-light px-4 py-3 text-sm font-medium text-charcoal-light">
          <input type="checkbox" checked={f.research_consent} onChange={set('research_consent')} className="mt-0.5 h-4 w-4 shrink-0 rounded border-black/20 accent-brand-500" />
          I agree to take part in the research pilot (you can withdraw any time)
        </label>

        <AuthError>{error ? String(error) : ''}</AuthError>

        <AuthSubmit busy={busy} busyLabel="Creating…">
          Create account <ArrowRightIcon size={17} className="transition group-hover:translate-x-1" />
        </AuthSubmit>
      </form>

      <p data-auth-in className="mt-7 text-center text-sm text-charcoal-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-600 underline decoration-brand-300 underline-offset-4 hover:decoration-brand-600">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
