/** Gus, the grass mascot: mood from the day's state and one-liners per mood and tone. Pure. */
import type { GusMood, Settings, StreakState, Tone } from '../types';
import { daysBetween, parseHHMM, toLocalDate } from '../util';

export const WILT_HOUR = 18;
const DORMANT_DAYS = 3;

/**
 * Priority: done → thriving; streak 0 and last counted day 3+ days ago → dormant;
 * before sessionTime → waiting; from 18:00 → wilting; otherwise waiting.
 */
export function gusMood(input: { now: number; doneToday: boolean; settings: Settings; streak: StreakState }): GusMood {
  const { now, doneToday, settings, streak } = input;
  if (doneToday) return 'thriving';
  const today = toLocalDate(now);
  // a brand-new user (nothing ever counted) is 'waiting', not dormant
  if (streak.current === 0 && streak.lastCountedDate !== null && daysBetween(streak.lastCountedDate, today) >= DORMANT_DAYS) {
    return 'dormant';
  }
  const d = new Date(now);
  const minutes = d.getHours() * 60 + d.getMinutes();
  if (minutes < parseHHMM(settings.sessionTime)) return 'waiting';
  if (minutes >= WILT_HOUR * 60) return 'wilting';
  return 'waiting';
}

export const GUS_LINES: Record<GusMood, Record<Tone, string[]>> = {
  thriving: {
    polite: [
      'Lovely work today. I feel greener already.',
      'Day {streak} done. Thank you for showing up.',
      'That was a good stretch. Rest well.',
      'All done for today. See you tomorrow.',
    ],
    sassy: [
      'Look at us, photosynthesising. Day {streak}!',
      'Stretched AND hydrated? Who are you?',
      "Day {streak}. I'm not saying I'm proud, but I'm swaying.",
      'Done before the excuses woke up. Nice.',
      'I grew a whole millimetre. You did that.',
    ],
    unhinged: [
      'DAY {streak}. I AM A MIGHTY LAWN. I FEAR NOTHING.',
      'The prophecy is fulfilled. The hamstrings have spoken.',
      'I just did a cartwheel. Grass can do that now. Because of you.',
      'Somewhere, a chair weeps. It is no longer needed.',
    ],
  },
  waiting: {
    polite: [
      'Whenever you are ready: {minutes} minutes today.',
      'Your session is waiting, {minutes} minutes or so.',
      "A little stretch today keeps day {streak} going.",
      'No rush. I will be right here.',
    ],
    sassy: [
      "{minutes} minutes. That's shorter than your last scroll session.",
      'I am fine. Just standing here. Being grass. Waiting.',
      'Day {streak} is not going to stretch itself.',
      'Floor is right there. Just saying.',
    ],
    unhinged: [
      'I have been staring at the door for HOURS. (It has been minutes.)',
      '{minutes} minutes. Our destiny awaits. Also the floor.',
      'Day {streak} hangs by a single blade of grass. Mine.',
      'I rehearsed a welcome song. It is mostly rustling.',
    ],
  },
  wilting: {
    polite: [
      'The day is getting late. {minutes} minutes would still help.',
      'A short stretch before bed keeps day {streak} alive.',
      'Still time today, if you would like.',
      'Even the 3-minute rescue counts tonight.',
    ],
    sassy: [
      'I am drooping a little. Just mentioning it. No pressure.',
      'Day {streak} called. It wants to know if you still care.',
      "{minutes} minutes and I'm perky again. Your call.",
      'Couch is comfy, I know. Couch stretch is comfier. (Lie.)',
    ],
    unhinged: [
      'I AM WILTING. TELL MY ROOTS I LOVED THEM.',
      'The sun has abandoned me. Only you can save day {streak}.',
      'Is this how it ends? Brown at the tips? {minutes} minutes, please.',
      'I can see the light. It is your phone. Open the app.',
    ],
  },
  dormant: {
    polite: [
      'Welcome back whenever you are ready. We start small.',
      'A fresh start is just one stretch away.',
      'No judgement. Shall we do a gentle session?',
      'I kept your spot warm.',
    ],
    sassy: [
      'Oh, hi. I was napping. Totally not because you left.',
      "I've been dormant. It's a lifestyle choice. Mostly yours.",
      'Back? Cool cool. Easy session, I promise.',
      'Roots are still alive. Let us water them.',
    ],
    unhinged: [
      'I HAVE RETURNED FROM THE SOIL. Did you miss me? Say yes.',
      'I dreamt of squats. Long, deep squats. Let us begin anew.',
      'Winter is over. It is whatever season you open the app in.',
      'I was a seed. Now I want to be a lawn again. Help.',
    ],
  },
};

/** Deterministic line for (mood, tone, seed), with {streak} and {minutes} filled in. */
export function gusLine(mood: GusMood, tone: Tone, seed: number, ctx: { streak: number; minutesPlanned: number }): string {
  const lines = GUS_LINES[mood][tone];
  const i = ((Math.floor(seed) % lines.length) + lines.length) % lines.length;
  return lines[i].replace(/\{streak\}/g, String(ctx.streak)).replace(/\{minutes\}/g, String(ctx.minutesPlanned));
}
