/** Display-only formatting helpers (no business rules). */
import type { DayPlan } from '../core/types';

/** 24 → "0:24", 250 → "4:10" */
export function mmss(totalS: number): string {
  const s = Math.max(0, Math.round(totalS));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 150 → "2h 30m", 42 → "42m" */
export function hoursMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}

/** "Friday, 23 Oct" */
export function dayHeader(ms: number): string {
  const d = new Date(ms);
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${weekday}, ${date}`;
}

/** "Friday, 21:30" */
export function eveningHeader(ms: number): string {
  const d = new Date(ms);
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
  return `${weekday}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function planMinutes(plan: DayPlan): number {
  return Math.max(1, Math.round(plan.estimatedS / 60));
}

/** "4 stretches · 7 min" */
export function planSummary(plan: DayPlan): string {
  const n = plan.items.length;
  return `${n} ${n === 1 ? 'stretch' : 'stretches'} · ${planMinutes(plan)} min`;
}

export function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
