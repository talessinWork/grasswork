/** Builds the plan for a session (daily / rescue / test) from goals and recent history. Pure. */
import type {
  AttemptRecord,
  DayPlan,
  GoalId,
  GoalRecord,
  LocalDate,
  PlanItem,
  SessionKind,
  SessionRecord,
  StretchSpec,
} from '../types';
import { addDays } from '../util';

export interface PlanInput {
  date: LocalDate;
  kind: SessionKind;
  now: number;
  goals: GoalRecord[];
  /** last 28 days */
  attempts: AttemptRecord[];
  /** last 28 days */
  sessions: SessionRecord[];
  specLookup: (id: string) => StretchSpec;
  specsForGoal: (g: GoalId) => StretchSpec[];
}

export const MAX_DAILY_S = 720;
export const REST_BETWEEN_HOLDS_S = 15;
export const HURT_WINDOW_MS = 48 * 3600_000;
const WEEK_MS = 7 * 86_400_000;
const MIN_HOLD_S = 5;
const RESCUE_MAX_HOLD_S = 30;
const TEST_HOLD_S = 20;
const COMEBACK_MISSED_DAYS = 2;
const COMEBACK_LOOKBACK_DAYS = 14;

/** Total seconds of a plan: holds (both sides for perSide) + 15 s rest between consecutive holds. */
export function estimatePlanSeconds(items: PlanItem[], specLookup: (id: string) => StretchSpec): number {
  let holds = 0;
  let holdTime = 0;
  for (const it of items) {
    const sides = specLookup(it.stretchId).perSide ? 2 : 1;
    holds += it.sets * sides;
    holdTime += it.sets * sides * it.holdS;
  }
  return holdTime + REST_BETWEEN_HOLDS_S * Math.max(0, holds - 1);
}

/** Stretch ids with an attempt marked hurt within 48 h before `now`. */
export function hurtStretchIds(attempts: AttemptRecord[], now: number): Set<string> {
  const ids = new Set<string>();
  for (const a of attempts) {
    if (a.hurt && a.startedAt <= now && now - a.startedAt <= HURT_WINDOW_MS) ids.add(a.stretchId);
  }
  return ids;
}

/**
 * Consecutive days before `date` without a completed session (looking back up to 14 days).
 * 0 when the user never completed a session before `date`.
 */
export function missedDaysBefore(date: LocalDate, sessions: SessionRecord[]): number {
  const doneDates = new Set(sessions.filter((s) => s.completed && s.date < date).map((s) => s.date));
  if (doneDates.size === 0) return 0;
  let missed = 0;
  for (let i = 1; i <= COMEBACK_LOOKBACK_DAYS; i++) {
    if (doneDates.has(addDays(date, -i))) return missed;
    missed++;
  }
  return missed;
}

/** The goal's current variant, stepped down to easier levels while hurt; null if dropped (level 0 hurt). */
function effectiveSpec(goal: GoalRecord, hurt: Set<string>, input: PlanInput): StretchSpec | null {
  let spec = input.specLookup(goal.currentStretchId);
  if (!hurt.has(spec.id)) return spec;
  const ladder = [...input.specsForGoal(goal.goalId)].sort((a, b) => a.level - b.level);
  while (hurt.has(spec.id)) {
    const easier = ladder.filter((s) => s.level < spec.level);
    if (easier.length === 0) return null;
    spec = easier[easier.length - 1];
  }
  return spec;
}

function grownHold(spec: StretchSpec, goal: GoalRecord, now: number): number {
  const weeks = Math.max(0, Math.floor((now - goal.startedAt) / WEEK_MS));
  return spec.defaultHoldS + 5 * weeks;
}

function capItems(items: PlanItem[], specLookup: (id: string) => StretchSpec): PlanItem[] {
  if (estimatePlanSeconds(items, specLookup) <= MAX_DAILY_S) return items;
  let holds = 0;
  let holdTime = 0;
  for (const it of items) {
    const sides = specLookup(it.stretchId).perSide ? 2 : 1;
    holds += it.sets * sides;
    holdTime += it.sets * sides * it.holdS;
  }
  const available = MAX_DAILY_S - REST_BETWEEN_HOLDS_S * Math.max(0, holds - 1);
  const f = Math.max(0, available) / holdTime;
  const out = items.map((it) => ({ ...it, holdS: Math.max(MIN_HOLD_S, Math.floor(it.holdS * f)) }));
  // guard against rounding / min-hold overshoot: trim the longest hold one second at a time
  while (estimatePlanSeconds(out, specLookup) > MAX_DAILY_S) {
    let idx = -1;
    for (let i = 0; i < out.length; i++) if (out[i].holdS > MIN_HOLD_S && (idx < 0 || out[i].holdS > out[idx].holdS)) idx = i;
    if (idx < 0) break;
    out[idx] = { ...out[idx], holdS: out[idx].holdS - 1 };
  }
  return out;
}

export function buildDayPlan(input: PlanInput): DayPlan {
  const { date, kind, now, specLookup } = input;
  const hurt = hurtStretchIds(input.attempts, now);
  const active = input.goals.filter((g) => g.status === 'active');

  let items: PlanItem[] = [];
  for (const goal of active) {
    const spec = effectiveSpec(goal, hurt, input);
    if (!spec) continue;
    const normal = grownHold(spec, goal, now);
    if (kind === 'daily') items.push({ stretchId: spec.id, sets: 2, holdS: normal, goalId: goal.goalId });
    else if (kind === 'rescue')
      items.push({ stretchId: spec.id, sets: 1, holdS: Math.min(RESCUE_MAX_HOLD_S, normal), goalId: goal.goalId });
    else items.push({ stretchId: spec.id, sets: 1, holdS: TEST_HOLD_S, goalId: goal.goalId });
  }

  if (kind === 'daily') {
    const supporting: string[] = [];
    if (active.some((g) => g.goalId === 'deep_squat')) supporting.push('squat_sit');
    supporting.push('couch_stretch');
    for (const id of supporting) {
      if (hurt.has(id)) continue;
      items.push({ stretchId: id, sets: 1, holdS: specLookup(id).defaultHoldS, goalId: null });
    }
    items = capItems(items, specLookup);
    if (missedDaysBefore(date, input.sessions) >= COMEBACK_MISSED_DAYS) {
      items = items.map((it) => ({
        ...it,
        sets: Math.max(1, Math.ceil(it.sets / 2)),
        holdS: Math.max(MIN_HOLD_S, Math.round(it.holdS / 2)),
      }));
    }
  }

  return { date, kind, items, estimatedS: estimatePlanSeconds(items, specLookup) };
}
