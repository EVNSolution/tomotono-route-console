'use client';

import { LockKeyhole } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';

function LoginForm() {
  const search = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
    if (!response.ok) { const payload = await response.json(); setError(payload.error ?? 'Login failed.'); return; }
    window.location.href = search.get('next') || '/';
  }
  return <form onSubmit={(event) => void submit(event)} className="w-full max-w-sm rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.34)]"><div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(94,106,210,0.18)]"><LockKeyhole size={20}/></div><h1 className="mt-5 text-2xl font-[510] tracking-[-0.704px]">Tomotono admin login</h1><p className="mt-2 text-sm leading-6 text-[var(--text-tertiary)]">Delivery route data is protected by a database-backed admin gate.</p><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Admin password" className="mt-5 h-10 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-3 text-sm outline-none focus:border-[var(--accent-violet)]" />{error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}<Button className="mt-5 w-full" variant="primary">Login</Button></form>;
}

export default function LoginPage() { return <main className="flex min-h-screen items-center justify-center px-5"><Suspense fallback={<div className="text-sm text-[var(--text-tertiary)]">Loading secure login…</div>}><LoginForm /></Suspense></main>; }
