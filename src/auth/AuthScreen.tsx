import React, { useState } from 'react';
import { ArrowLeft, FlaskConical, KeyRound, Lock, ShieldCheck, UserPlus } from 'lucide-react';
import { TEST_ACCOUNT, hasOwner, hasTestAccount, login, passwordProblem, register } from './localAuth';

interface Props {
  notice?: string | null;
  onSignedIn: (username: string) => void;
  onBack: () => void;
}

export const AuthScreen: React.FC<Props> = ({ notice, onSignedIn, onBack }) => {
  const canCreate = !hasOwner(); // until the owner account exists, anyone may create it
  const testReady = hasTestAccount();
  const [mode, setMode] = useState<'signin' | 'signup'>(canCreate && !testReady ? 'signup' : 'signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signUp = mode === 'signup';

  const switchTo = (m: 'signin' | 'signup') => { setMode(m); setError(null); setPassword(''); setConfirm(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (signUp && password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      if (signUp) await register(username, password);
      const s = await login(username, password);
      onSignedIn(s.username);
    } catch (err: any) {
      setError(err?.message || 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const hint = signUp && password ? passwordProblem(password) : null;
  const input = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500';
  const link = 'font-bold text-emerald-700 hover:underline cursor-pointer';
  const switchLine = signUp
    ? testReady && <>Just trying it? <button type="button" onClick={() => switchTo('signin')} className={link}>Sign in with the test account</button></>
    : canCreate
      ? <>New shop on this computer? <button type="button" onClick={() => switchTo('signup')} className={link}>Create the owner account</button></>
      : <>Need another account? Sign in, then use <strong>Add staff account</strong> at the top.</>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="text-emerald-200 hover:text-white text-xs font-semibold inline-flex items-center gap-1 mb-4 cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to home
        </button>
        <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              {signUp ? <UserPlus className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">{signUp ? 'Create the owner account' : 'Sign in to KroyPulse'}</h1>
              <p className="text-xs text-slate-500">{signUp ? 'The first account on this computer belongs to the shop owner.' : 'Accounts are stored only on this computer.'}</p>
            </div>
          </div>

          {notice && <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2">{notice}</div>}

          {!signUp && testReady && (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900">
              <FlaskConical className="w-4 h-4 text-emerald-700 shrink-0" />
              <p className="flex-1">
                <span className="block font-bold">Test account</span>
                Username <strong className="font-mono">{TEST_ACCOUNT.username}</strong> · Password <strong className="font-mono">{TEST_ACCOUNT.password}</strong>
              </p>
              <button type="button" onClick={() => { setUsername(TEST_ACCOUNT.username); setPassword(TEST_ACCOUNT.password); setError(null); }} className="rounded-md border border-emerald-300 bg-white px-2.5 py-1 font-bold text-emerald-800 hover:bg-emerald-100 cursor-pointer">
                Fill in
              </button>
            </div>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Username</span>
            <input className={input + ' mt-1'} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Password</span>
            <input className={input + ' mt-1'} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={signUp ? 'new-password' : 'current-password'} required />
            {hint && <span className="text-[11px] text-amber-700 mt-1 block">{hint}</span>}
          </label>
          {signUp && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Confirm password</span>
              <input className={input + ' mt-1'} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </label>
          )}

          {error && <div role="alert" className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">{error}</div>}

          <button type="submit" disabled={busy || Boolean(hint)} className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-2.5 cursor-pointer disabled:opacity-60">
            {busy ? 'Checking…' : signUp ? 'Create account and continue' : 'Sign in'}
          </button>

          {switchLine && <p className="text-xs text-center text-slate-600">{switchLine}</p>}

          <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-3 space-y-1">
            <p className="flex gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Passwords are stored only as salted PBKDF2-SHA-256 hashes.</p>
            <p className="flex gap-1.5"><Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> The app locks itself after 30 minutes without activity.</p>
            {testReady && <p className="pl-5">Anyone can use the test account. Before real use, the owner removes it from the bar at the top.</p>}
            {!signUp && <p className="pl-5">Forgot the password? There is no server to reset it. Clear this site's data in the browser and create a new owner account; no customer data is lost because none is stored.</p>}
          </div>
        </form>
      </div>
    </div>
  );
};
