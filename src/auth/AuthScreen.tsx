import React, { useState } from 'react';
import { ArrowLeft, KeyRound, Lock, ShieldCheck, UserPlus } from 'lucide-react';
import { hasAnyUser, login, passwordProblem, register } from './localAuth';

interface Props {
  notice?: string | null;
  onSignedIn: (username: string) => void;
  onBack: () => void;
}

export const AuthScreen: React.FC<Props> = ({ notice, onSignedIn, onBack }) => {
  const firstRun = !hasAnyUser();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (firstRun && password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      if (firstRun) await register(username, password);
      const s = await login(username, password);
      onSignedIn(s.username);
    } catch (err: any) {
      setError(err?.message || 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const hint = firstRun && password ? passwordProblem(password, username) : null;
  const input = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500';

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="text-emerald-200 hover:text-white text-xs font-semibold inline-flex items-center gap-1 mb-4 cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to home
        </button>
        <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              {firstRun ? <UserPlus className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">{firstRun ? 'Create the owner account' : 'Sign in to KroyPulse'}</h1>
              <p className="text-xs text-slate-500">{firstRun ? 'First time on this computer. This account stays on this device.' : 'Your account is stored only on this computer.'}</p>
            </div>
          </div>

          {notice && <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2">{notice}</div>}

          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Username</span>
            <input className={input + ' mt-1'} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Password</span>
            <input className={input + ' mt-1'} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={firstRun ? 'new-password' : 'current-password'} required />
            {hint && <span className="text-[11px] text-amber-700 mt-1 block">{hint}</span>}
          </label>
          {firstRun && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Confirm password</span>
              <input className={input + ' mt-1'} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </label>
          )}

          {error && <div role="alert" className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">{error}</div>}

          <button type="submit" disabled={busy || Boolean(hint)} className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-2.5 cursor-pointer disabled:opacity-60">
            {busy ? 'Checking…' : firstRun ? 'Create account and continue' : 'Sign in'}
          </button>

          <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-3 space-y-1">
            <p className="flex gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Passwords are stored only as salted PBKDF2-SHA-256 hashes.</p>
            <p className="flex gap-1.5"><Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> The app locks itself after 30 minutes without activity.</p>
            {!firstRun && <p className="pl-5">Forgot the password? There is no server to reset it. Clear this site's data in the browser and create a new owner account; no customer data is lost because none is stored.</p>}
          </div>
        </form>
      </div>
    </div>
  );
};
