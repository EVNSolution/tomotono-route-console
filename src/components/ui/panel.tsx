import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn('rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] shadow-[0_0_0_1px_rgba(0,0,0,0.2),0_24px_80px_rgba(0,0,0,0.28)]', className)} {...props} />; }
export function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) { return <Panel className="p-4"><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-quaternary)]">{label}</p><p className="mt-2 text-2xl font-[510] tracking-[-0.704px] text-[var(--text-primary)]">{value}</p>{detail ? <p className="mt-1 text-xs text-[var(--text-tertiary)]">{detail}</p> : null}</Panel>; }
