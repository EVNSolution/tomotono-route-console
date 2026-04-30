'use client';

import { CheckCircle2, Save } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { RouteStop } from '@/lib/delivery/types';

export function StopActions({ stop }: { stop: RouteStop }) {
  const [memo, setMemo] = useState(stop.dispatcherMemo ?? '');
  const [tip, setTip] = useState(stop.deliveryTip ?? '');
  const [status, setStatus] = useState(stop.status);

  async function save() {
    await fetch(`/api/stops/${stop.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dispatcherMemo: memo, deliveryTip: tip, status }) });
  }

  return <div className="space-y-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
    <div className="flex items-center justify-between gap-3"><p className="text-xs font-[590] text-[var(--text-secondary)]">#{stop.sequence} {stop.orderNumber}</p><select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0f1011] px-2 py-1 text-xs text-[var(--text-secondary)]"><option value="pending">pending</option><option value="arrived">arrived</option><option value="issue">issue</option><option value="skipped">skipped</option></select></div>
    <p className="text-xs leading-5 text-[var(--text-tertiary)]">{stop.fullAddress}</p>
    <textarea value={tip} onChange={(e) => setTip(e.target.value)} placeholder="Delivery tip" className="min-h-16 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-2 text-xs text-[var(--text-secondary)] outline-none focus:border-[var(--accent-violet)]" />
    <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Dispatcher memo" className="min-h-16 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-2 text-xs text-[var(--text-secondary)] outline-none focus:border-[var(--accent-violet)]" />
    <Button size="sm" variant="subtle" onClick={() => void save()}><Save size={13} /> Save stop</Button>
  </div>;
}

export function ConfirmRouteButton({ routeId }: { routeId: string }) {
  const [done, setDone] = useState(false);
  return <Button variant={done ? 'ghost' : 'primary'} onClick={async () => { await fetch(`/api/routes/${routeId}/confirm`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ note: 'Confirmed from operations console' }) }); setDone(true); }}><CheckCircle2 size={15} />{done ? 'Confirmed' : 'Confirm route review'}</Button>;
}
