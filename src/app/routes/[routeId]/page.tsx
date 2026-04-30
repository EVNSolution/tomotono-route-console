import { ArrowLeft, Clock3, MapPin } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmRouteButton, StopActions } from '@/components/route-console/stop-actions';
import { RouteMap } from '@/components/route-console/route-map';
import { Button } from '@/components/ui/button';
import { Metric, Panel } from '@/components/ui/panel';
import { getRouteDetail } from '@/lib/delivery/store';

export const dynamic = 'force-dynamic';

export default async function RouteDetailPage({ params }: { params: Promise<{ routeId: string }> }) {
  const { routeId } = await params;
  const detail = await getRouteDetail(routeId);
  if (!detail) notFound();
  const { route, stops } = detail;
  const arrived = stops.filter((stop) => stop.status === 'arrived').length;
  return <main className="min-h-screen px-5 py-5 lg:px-8"><section className="mx-auto flex max-w-7xl flex-col gap-5"><header className="flex flex-col gap-4 border-b border-[rgba(255,255,255,0.06)] pb-5 lg:flex-row lg:items-end lg:justify-between"><div><Button asChild variant="subtle" size="sm"><Link href="/"><ArrowLeft size={14}/> Dashboard</Link></Button><h1 className="mt-4 text-4xl font-[510] tracking-[-1.056px]">{route.routeName}</h1><p className="mt-2 text-sm text-[var(--text-tertiary)]">{route.driverName} · {route.serviceDate} · {route.status}</p></div><ConfirmRouteButton routeId={route.id}/></header><div className="grid gap-3 md:grid-cols-4"><Metric label="Stops" value={route.stopCount}/><Metric label="Reviewed" value={route.reviewedStopCount}/><Metric label="Arrived" value={arrived}/><Metric label="ETA window" value={route.firstEtaLocal?.slice(11) ?? '--'} detail={route.lastEtaLocal ? `until ${route.lastEtaLocal.slice(11)}` : undefined}/></div><div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><RouteMap route={route} stops={stops}/><Panel className="max-h-[460px] overflow-y-auto p-4"><h2 className="text-lg font-[510]">Stop detail panel</h2><div className="mt-4 space-y-3">{stops.map((stop) => <StopActions stop={stop} key={stop.id}/>)}</div></Panel></div><Panel className="overflow-hidden"><div className="grid grid-cols-[64px_1fr_120px_120px_140px] border-b border-[rgba(255,255,255,0.06)] px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-[var(--text-quaternary)]"><span>Seq</span><span>Stop / Order</span><span>ETA</span><span>Actual</span><span>Status</span></div>{stops.map((stop) => <div key={stop.id} className="grid grid-cols-[64px_1fr_120px_120px_140px] items-center border-b border-[rgba(255,255,255,0.04)] px-4 py-3 text-sm"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-indigo)] text-xs font-[590]">{stop.sequence}</span><div><p className="font-[510]"><MapPin className="mr-2 inline" size={13}/>{stop.orderNumber} · {stop.customerName}</p><p className="mt-1 text-xs text-[var(--text-tertiary)]">{stop.fullAddress}</p><p className="mt-1 text-xs text-[var(--text-quaternary)]">{stop.itemSummary}</p></div><span className="font-mono text-xs text-[var(--text-secondary)]"><Clock3 className="mr-1 inline" size={12}/>{stop.etaLocal?.slice(11) ?? '--'}</span><span className="font-mono text-xs text-[var(--text-tertiary)]">{stop.actualArrivalLocal?.slice(11) ?? '--'}</span><span className="text-xs font-[510] uppercase tracking-[0.12em] text-[var(--accent-violet)]">{stop.status}</span></div>)}</Panel></section></main>;
}
