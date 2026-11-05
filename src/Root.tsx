import React, { useEffect, useState } from 'react';
import { Lock, LogOut, UserPlus } from 'lucide-react';
import App from './App';
import { Landing } from './Landing';
import { AuthScreen } from './auth/AuthScreen';
import { currentSession, logout, passwordProblem, register } from './auth/localAuth';

const IDLE_MS = 30 * 60 * 1000;

export default function Root() {
  const [user, setUser] = useState<string | null>(() => currentSession()?.username ?? null);
  const [view, setView] = useState<'landing' | 'auth'>('landing');
  const [notice, setNotice] = useState<string | null>(null);

  // Auto-lock: after 30 minutes without input, or when the 8-hour session expires.
  useEffect(() => {
    if (!user) return;
    let last = Date.now();
    const touch = () => { last = Date.now(); };
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = window.setInterval(() => {
      if (Date.now() - last > IDLE_MS || !currentSession()) {
        lock('KroyPulse locked itself after 30 minutes without activity. Sign in again to continue.');
      }
    }, 30_000);
    return () => { events.forEach((e) => window.removeEventListener(e, touch)); window.clearInterval(timer); };
  }, [user]);

  const lock = (message: string | null = null) => {
    logout();
    setUser(null);
    setNotice(message);
    setView('auth');
  };

  if (!user) {
    return view === 'landing'
      ? <Landing onStart={() => setView('auth')} />
      : <AuthScreen notice={notice} onSignedIn={(u) => { setUser(u); setNotice(null); }} onBack={() => setView('landing')} />;
  }

  return (
    <>
      <AccountBar user={user} onLock={() => lock(null)} />
      <App />
    </>
  );
}

function AccountBar({ user, onLock }: { user: string; onLock: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(name, pw);
      setMsg(`Account "${name.trim().toLowerCase()}" created on this computer.`);
      setName(''); setPw(''); setAdding(false);
    } catch (err: any) {
      setMsg(err?.message || 'Could not create the account.');
    }
  };

  return (
    <div className="bg-slate-900 text-slate-200 text-[11px] px-3 sm:px-6 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="inline-flex items-center gap-1.5"><Lock className="w-3 h-3 text-emerald-400" /> Local session · <strong className="text-white">{user}</strong> · data stays on this device</span>
      <span className="flex-1" />
      {msg && <span className="text-amber-300">{msg}</span>}
      {adding ? (
        <form onSubmit={add} className="flex flex-wrap items-center gap-1.5">
          <input aria-label="New username" placeholder="username" value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-white w-28" />
          <input aria-label="New password" placeholder="password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-white w-32" />
          <button disabled={Boolean(pw && passwordProblem(pw, name))} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded px-2 py-0.5 cursor-pointer disabled:opacity-50">Add</button>
          <button type="button" onClick={() => setAdding(false)} className="text-slate-400 hover:text-white cursor-pointer">Cancel</button>
        </form>
      ) : (
        <button onClick={() => { setAdding(true); setMsg(null); }} className="inline-flex items-center gap-1 hover:text-white cursor-pointer"><UserPlus className="w-3 h-3" /> Add staff account</button>
      )}
      <button onClick={onLock} className="inline-flex items-center gap-1 hover:text-white cursor-pointer"><LogOut className="w-3 h-3" /> Lock</button>
    </div>
  );
}
