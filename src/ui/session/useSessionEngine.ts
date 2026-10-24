/**
 * Session glue: pose frames → PoseSmoother → Calibrator → checkFraming → createEvaluator → createHoldVerifier → createCueThrottle,
 * with the flow driven by the pure reduceSession. Every rule lives in src/core; this hook only wires them to React,
 * speech, haptics and AppServices (startSession / recordAttempt / finishSession).
 *
 * Frame-rate state (the latest pose) goes to a FrameStore so only the skeleton re-renders per frame;
 * the rest of the UI gets a small `live` snapshot.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Calibration, EvalResult, PoseFrame, SessionKind, StretchSpec } from '../../core/types';
import { getSpec } from '../../core/evaluator/specs/index';
import { checkFraming, type FramingCheck } from '../../core/evaluator/framing';
import { createEvaluator, type Evaluator } from '../../core/evaluator/evaluate';
import { Calibrator } from '../../core/pose/calibration';
import { PoseSmoother } from '../../core/pose/oneEuro';
import { createHoldVerifier, toAttempt, type HoldState, type HoldVerifier } from '../../core/session/holdVerifier';
import { createCueThrottle } from '../../core/session/cueThrottle';
import {
  currentStep,
  initSession,
  reduceSession,
  type SessionEvent,
  type SessionState,
  type SessionStep,
} from '../../core/session/sessionMachine';
import { newId } from '../../core/util';
import type { SummaryVM } from '../../services/contract';
import { useServices, useSettings } from '../ServicesProvider';
import { createFrameStore } from './frameStore';
import { hapticHoldDone, hapticHoldStart, hush, say } from './voice';

/** framing must stay OK this long before moving on, so a lucky frame doesn't skip setup */
const FRAMING_SETTLE_MS = 1200;
/** instructions auto-advance: the verifier still waits for a real entry into the pose */
const INSTRUCTIONS_MS = 6000;
const SETUP_HINT_GAP_MS = 5000;

export type EngineStatus = 'loading' | 'running' | 'finishing' | 'summary' | 'closed' | 'error';

export interface SetupUI {
  hint: string | null;
  framing: FramingCheck | null;
  calibrated: boolean;
  calProgress: number;
}

export interface LiveUI {
  result: EvalResult | null;
  hold: HoldState | null;
  /** last spoken / shown cue */
  cue: string | null;
}

export function useSessionEngine(kind: SessionKind) {
  const services = useServices();
  const { settings } = useSettings();

  const [status, setStatus] = useState<EngineStatus>('loading');
  const [error, setError] = useState<Error | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [summary, setSummary] = useState<SummaryVM | null>(null);
  const [setup, setSetup] = useState<SetupUI>({ hint: null, framing: null, calibrated: false, calProgress: 0 });
  const [live, setLive] = useState<LiveUI>({ result: null, hold: null, cue: null });
  const [paused, setPausedState] = useState(false);
  const [muted, setMuted] = useState(false);
  /** best depth reached for each stretch during this session (for the depth meter tick) */
  const [sessionBest, setSessionBest] = useState<Record<string, number>>({});

  const frames = useMemo(() => createFrameStore(), []);
  const sessionRef = useRef<SessionState | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pausedRef = useRef(false);
  const voiceRef = useRef(true);
  const smoother = useRef(new PoseSmoother()).current;
  const calibrator = useRef(new Calibrator()).current;
  const throttle = useRef(createCueThrottle()).current;
  const calRef = useRef<Calibration | null>(null);
  const evaluatorRef = useRef<Evaluator | null>(null);
  const verifierRef = useRef<HoldVerifier | null>(null);
  const holdStartedAtRef = useRef(0);
  const holdLiveRef = useRef(false);
  const finishingHoldRef = useRef(false);
  const framingOkSinceRef = useRef<number | null>(null);
  const lastHintRef = useRef<{ text: string | null; at: number }>({ text: null, at: 0 });
  const writesRef = useRef<Promise<unknown>[]>([]);
  const finishedRef = useRef(false);

  voiceRef.current = !!settings?.voiceCues && !muted;

  const speak = useCallback((text: string) => {
    if (voiceRef.current) say(text);
  }, []);

  const dispatch = useCallback((ev: SessionEvent) => {
    const s = sessionRef.current;
    if (!s) return;
    const next = reduceSession(s, ev);
    if (next === s) return;
    sessionRef.current = next;
    setSession(next);
  }, []);

  // ---------------------------------------------------------------------------
  // start
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { session: rec, plan } = await services.startSession(kind, Date.now());
        if (cancelled) return;
        sessionIdRef.current = rec.id;
        const s = initSession(plan, getSpec, Date.now());
        sessionRef.current = s;
        setSession(s);
        setStatus('running');
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      hush();
    };
  }, [services, kind]);

  const step: SessionStep | null = session ? currentStep(session) : null;
  const spec: StretchSpec | null = step ? getSpec(step.stretchId) : null;
  const phase = session?.phase ?? null;

  // ---------------------------------------------------------------------------
  // finishing a hold (complete or "It hurts")
  // ---------------------------------------------------------------------------
  const finishHold = useCallback(
    (hurt: boolean) => {
      const s = sessionRef.current;
      const st = s ? currentStep(s) : null;
      const verifier = verifierRef.current;
      const sessionId = sessionIdRef.current;
      if (!s || s.phase !== 'holding' || !st || !verifier || !sessionId || finishingHoldRef.current) return;
      finishingHoldRef.current = true;
      const now = Date.now();
      const attempt = toAttempt(verifier.state(), {
        id: newId('a_'),
        sessionId,
        stretchId: st.stretchId,
        side: st.side,
        startedAt: holdStartedAtRef.current || now,
        endedAt: now,
        hurt,
      });
      if (attempt.bestDepth != null) {
        const sp = getSpec(st.stretchId);
        setSessionBest((prev) => {
          const old = prev[st.stretchId];
          const better = old == null || (sp.depthBetter === 'higher' ? attempt.bestDepth! > old : attempt.bestDepth! < old);
          return better ? { ...prev, [st.stretchId]: attempt.bestDepth! } : prev;
        });
      }
      writesRef.current.push(
        services.recordAttempt(attempt).catch((e) => console.warn('[grasswork] recordAttempt failed', e)),
      );
      if (hurt) {
        hush();
        speak("Okay. We'll skip that one today. Be gentle.");
      } else {
        hapticHoldDone();
        speak('Hold complete. Nice.');
      }
      dispatch({ type: hurt ? 'HURT' : 'HOLD_DONE', attempt, now });
    },
    [dispatch, services, speak],
  );

  // ---------------------------------------------------------------------------
  // per-frame pipeline
  // ---------------------------------------------------------------------------
  const onFrame = useCallback(
    (raw: PoseFrame) => {
      const s = sessionRef.current;
      if (!s || pausedRef.current) return;
      const frame = smoother.smooth(raw);
      frames.set(frame);
      const st = currentStep(s);
      const sp = st ? getSpec(st.stretchId) : null;

      const maybeSpeakHint = (hint: string | null) => {
        const now = Date.now();
        const last = lastHintRef.current;
        if (!hint || (hint === last.text && now - last.at < SETUP_HINT_GAP_MS * 2) || now - last.at < SETUP_HINT_GAP_MS) return;
        lastHintRef.current = { text: hint, at: now };
        speak(hint);
      };

      switch (s.phase) {
        case 'calibrating': {
          const cp = calibrator.push(frame);
          const fc = sp ? checkFraming(frame, sp) : null;
          setSetup({ hint: cp.hint, framing: fc, calibrated: cp.status === 'done', calProgress: cp.progress });
          if (cp.status === 'need_body') maybeSpeakHint(cp.hint);
          if (cp.status === 'done' && cp.calibration) {
            calRef.current = cp.calibration;
            dispatch({ type: 'CALIBRATED' });
          }
          break;
        }
        case 'framing': {
          if (!sp) break;
          const fc = checkFraming(frame, sp);
          setSetup((prev) => ({ ...prev, hint: fc.hint, framing: fc, calibrated: true, calProgress: 1 }));
          if (fc.ok) {
            if (framingOkSinceRef.current == null) framingOkSinceRef.current = frame.t;
            else if (frame.t - framingOkSinceRef.current >= FRAMING_SETTLE_MS) {
              framingOkSinceRef.current = null;
              dispatch({ type: 'FRAMING_OK' });
            }
          } else {
            framingOkSinceRef.current = null;
            maybeSpeakHint(fc.hint);
          }
          break;
        }
        case 'holding': {
          const ev = evaluatorRef.current;
          const ver = verifierRef.current;
          if (!ev || !ver) break;
          const r = ev.evaluate(frame);
          const hs = ver.push(r);
          const isLive = hs.phase === 'holding';
          if (isLive && !holdLiveRef.current && hs.heldMs === 0) hapticHoldStart();
          holdLiveRef.current = isLive;
          const cue = throttle.next(r, Date.now());
          if (cue) speak(cue);
          setLive((prev) => ({ result: r, hold: hs, cue: cue ?? (r.valid ? null : prev.cue) }));
          if (hs.phase === 'complete') finishHold(false);
          break;
        }
        default:
          break;
      }
    },
    [calibrator, dispatch, finishHold, frames, smoother, speak, throttle],
  );

  // ---------------------------------------------------------------------------
  // phase entry effects
  // ---------------------------------------------------------------------------
  const stepIndex = session?.stepIndex ?? 0;

  useEffect(() => {
    if (!session) return;
    const s = session;
    const st = currentStep(s);
    const sp = st ? getSpec(st.stretchId) : null;

    switch (s.phase) {
      case 'calibrating':
        speak('Prop your phone on the floor, step back, and stand tall for a moment.');
        return;
      case 'framing':
        framingOkSinceRef.current = null;
        return;
      case 'instructions': {
        if (!sp || !st || !calRef.current) return;
        evaluatorRef.current = createEvaluator(sp, calRef.current);
        verifierRef.current = createHoldVerifier({ targetS: st.holdS, depthBetter: sp.depthBetter });
        throttle.reset();
        setLive({ result: null, hold: null, cue: null });
        const side = st.side ? ` ${st.side} side.` : '';
        speak(`${sp.name}.${side} ${sp.instructions}`);
        return;
      }
      case 'holding':
        verifierRef.current?.reset();
        evaluatorRef.current?.reset();
        holdStartedAtRef.current = Date.now();
        holdLiveRef.current = false;
        finishingHoldRef.current = false;
        return;
      case 'rest':
      case 'summary':
      case 'aborted':
        return;
    }
    // stepIndex matters: a new step re-enters 'instructions' even when the phase name repeats
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.phase, stepIndex]);

  // timers: instructions auto-advance and the rest countdown; both stop while paused (and re-arm on resume)
  useEffect(() => {
    if (paused || !session) return;
    if (session.phase === 'instructions') {
      const t = setTimeout(() => dispatch({ type: 'START_HOLD' }), INSTRUCTIONS_MS);
      return () => clearTimeout(t);
    }
    if (session.phase === 'rest') {
      const id = setInterval(() => dispatch({ type: 'TICK', now: Date.now() }), 250);
      return () => clearInterval(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.phase, stepIndex, paused, dispatch]);

  // ---------------------------------------------------------------------------
  // end of session
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!session || (session.phase !== 'summary' && session.phase !== 'aborted') || finishedRef.current) return;
    finishedRef.current = true;
    const aborted = session.phase === 'aborted';
    const sessionId = sessionIdRef.current;
    setStatus('finishing');
    (async () => {
      try {
        await Promise.all(writesRef.current);
        if (!sessionId) throw new Error('No session');
        const vm = await services.finishSession(sessionId, Date.now());
        if (aborted && session.attempts.length === 0 && writesRef.current.length === 0) {
          setStatus('closed');
          return;
        }
        setSummary(vm);
        setStatus('summary');
        if (vm.holdsVerified > 0) speak(`Day ${vm.dayNumber}. Done.`);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        setStatus(aborted ? 'closed' : 'error');
      }
    })();
  }, [session, services, speak]);

  // ---------------------------------------------------------------------------
  // actions
  // ---------------------------------------------------------------------------
  const setPaused = useCallback((p: boolean) => {
    pausedRef.current = p;
    setPausedState(p);
    if (p) hush();
  }, []);

  /** Skipping or ending mid-hold still saves the verified seconds (SKIP / ABORT carry no attempt). */
  const savePartialHold = useCallback(() => {
    const s = sessionRef.current;
    const st = s ? currentStep(s) : null;
    const verifier = verifierRef.current;
    const sessionId = sessionIdRef.current;
    if (!s || s.phase !== 'holding' || !st || !verifier || !sessionId || finishingHoldRef.current) return;
    const hs = verifier.state();
    if (hs.heldMs <= 0) return;
    finishingHoldRef.current = true;
    const now = Date.now();
    const attempt = toAttempt(hs, {
      id: newId('a_'),
      sessionId,
      stretchId: st.stretchId,
      side: st.side,
      startedAt: holdStartedAtRef.current || now,
      endedAt: now,
      hurt: false,
    });
    writesRef.current.push(services.recordAttempt(attempt).catch((e) => console.warn('[grasswork] recordAttempt failed', e)));
  }, [services]);

  const actions = useMemo(
    () => ({
      startHold: () => dispatch({ type: 'START_HOLD' }),
      hurt: () => finishHold(true),
      skip: () => {
        setPaused(false);
        savePartialHold();
        dispatch({ type: 'SKIP', now: Date.now() });
      },
      end: () => {
        setPaused(false);
        hush();
        savePartialHold();
        dispatch({ type: 'ABORT' });
      },
      setPaused,
      toggleMute: () =>
        setMuted((m) => {
          if (!m) hush();
          return !m;
        }),
    }),
    [dispatch, finishHold, savePartialHold, setPaused],
  );

  /** next step to preview during rest (display only) */
  const nextStep = useMemo(() => {
    if (!session || session.phase !== 'rest') return null;
    return session.steps.slice(session.stepIndex + 1).find((x) => !session.skippedStretchIds.includes(x.stretchId)) ?? null;
  }, [session]);

  return {
    status,
    error,
    session,
    phase,
    step,
    spec,
    nextStep,
    setup,
    live,
    calibration: calRef.current,
    summary,
    paused,
    muted,
    voiceOn: !!settings?.voiceCues,
    sessionBest: spec ? (sessionBest[spec.id] ?? null) : null,
    frames,
    onFrame,
    actions,
  };
}

export type SessionEngine = ReturnType<typeof useSessionEngine>;
