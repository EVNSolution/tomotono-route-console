import { ArrowRight, MapPinned, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { CsvUpload } from '@/components/route-console/csv-upload';
import { Button } from '@/components/ui/button';
import { Metric, Panel } from '@/components/ui/panel';
import { getDeliveryState } from '@/lib/delivery/store';
import { DEFAULT_AWS_REGION, DEFAULT_TIMEZONE } from '@/lib/delivery/types';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const state = await getDeliveryState();
  const totalStops = state.stops.length;
  const arrivedStops = state.stops.filter((stop) => stop.status === 'arrived').length;
  return <main className="min-h-screen px-5 py-5 lg:px-8">
    <section className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-4 border-b border-[rgba(255,255,255,0.06)] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-[11px] font-[510] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" /> Tomotono Operations / {DEFAULT_TIMEZONE}</div><h1 className="max-w-4xl text-4xl font-[510] tracking-[-1.056px] text-[var(--text-primary)] lg:text-5xl">Delivery route console for CSV import, map review, and final dispatch confidence.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-tertiary)]">Dark-mode-native MVP based on DESIGN.md. Upload EasyRoutes CSV, inspect route sequence, verify ETAs and arrivals, capture delivery tips, and confirm route review before operations handoff.</p></div>
        <div className="flex gap-2"><Button asChild variant="ghost"><Link href="/settings"><ShieldCheck size={15}/> Settings</Link></Button>{state.routes[0] ? <Button asChild variant="primary"><Link href={`/routes/${state.routes[0].id}`}>Open first route <ArrowRight size={15}/></Link></Button> : null}</div>
      </header>
      <CsvUpload />
      <div className="grid gap-3 md:grid-cols-4"><Metric label="Delivery days" value={state.deliveryDays.length} detail="CSV grouped by service date"/><Metric label="Routes" value={state.routes.length} detail="Driver/route combinations"/><Metric label="Stops" value={totalStops} detail={`${arrivedStops} with actual arrival`}/><Metric label="Deploy region" value={DEFAULT_AWS_REGION} detail="AWS Canada Central target"/></div>
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><Panel className="p-4"><h2 className="text-lg font-[510] tracking-[-0.24px]">Delivery dates</h2><div className="mt-4 space-y-2">{state.deliveryDays.map((day) => <div key={day.id} className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3"><div className="flex items-center justify-between"><span className="font-mono text-sm text-[var(--text-primary)]">{day.serviceDate}</span><span className="text-xs text-[var(--text-tertiary)]">{day.confirmedRouteCount}/{day.routeCount} confirmed</span></div><p className="mt-1 text-xs text-[var(--text-quaternary)]">{day.stopCount} stops · {day.timezone}</p></div>)}</div></Panel>
      <Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] p-4"><h2 className="text-lg font-[510] tracking-[-0.24px]">Route queue</h2><span className="text-xs text-[var(--text-quaternary)]">high-signal review surface</span></div><div className="divide-y divide-[rgba(255,255,255,0.06)]">{state.routes.map((route) => <Link href={`/routes/${route.id}`} key={route.id} className="grid gap-3 p-4 transition hover:bg-[rgba(255,255,255,0.03)] md:grid-cols-[1fr_0.8fr_0.6fr_0.5fr]"><div><p className="font-[510] text-[var(--text-primary)]">{route.routeName}</p><p className="mt-1 text-xs text-[var(--text-tertiary)]">{route.serviceDate} · {route.firstEtaLocal ?? 'ETA n/a'} → {route.lastEtaLocal ?? 'n/a'}</p></div><div className="text-sm text-[var(--text-secondary)]">{route.driverName}</div><div className="text-sm text-[var(--text-tertiary)]">{route.stopCount} stops</div><div className="text-right text-xs font-[510] uppercase tracking-[0.12em] text-[var(--accent-violet)]">{route.status}</div></Link>)}</div></Panel></div>
      <Panel className="p-4"><div className="flex items-center gap-2 text-sm font-[510]"><MapPinned size={16}/> MVP scope guard</div><p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">No optimization engine, live Shopify mutation, real customer notification, or raw CSV fixture commit is included. This console prepares a safe display/review seam for future optimization API results.</p></Panel>
    </section>
  </main>;
}
