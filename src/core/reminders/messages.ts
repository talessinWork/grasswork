/**
 * Gus's reminder copy. [step][variant] per tone.
 * Steps: 0 friendly start, 1 gentle poke, 2 streak warning, 3 Gus wilting, 4 last call + 3-minute rescue.
 * Rules: never cruel, never about bodies, no emoji. Placeholders: {streak}, {minutes}.
 */
import type { Tone } from '../types';

export const MESSAGES: Record<Tone, string[][]> = {
  polite: [
    [
      'Morning! Your {minutes}-minute stretch is ready whenever you are.',
      "It's stretch time. {minutes} minutes, and Gus will keep you company.",
      'Gus is up and ready. Shall we do today\'s {minutes} minutes?',
    ],
    [
      'Just a gentle reminder: today\'s stretch is still waiting for you.',
      'Gus is still here, roots ready. {minutes} minutes whenever suits you.',
      'A small nudge from Gus: a few minutes of stretching would be lovely today.',
    ],
    [
      'Your {streak}-day streak would love a session today.',
      'Keep your {streak}-day streak going. Just {minutes} minutes today.',
      "Friendly heads-up: today's session keeps your {streak}-day streak alive.",
    ],
    [
      'Gus is drooping a little. A quick stretch would perk him right up.',
      'Gus is getting thirsty for a session. {minutes} minutes is all it takes.',
      'The evening is here and Gus is wilting slightly. Care to stretch together?',
    ],
    [
      'Last call for today. Short on time? Try the 3-minute rescue session.',
      'The day is almost over. The 3-minute rescue still counts, and Gus would be grateful.',
      'One last reminder: a 3-minute rescue session keeps today on the board.',
    ],
  ],
  sassy: [
    [
      'Gus is stretched and waiting. Your move. {minutes} minutes.',
      'Rise and stretch. Gus already did his and he is a plant.',
      'Session time. {minutes} minutes. Gus brought snacks (sunlight).',
    ],
    [
      'Gus noticed you opened three other apps first. Just saying.',
      'Still waiting. Gus has been doing grass things all morning. Your turn.',
      'Hey. Hi. Remember Gus? {minutes} minutes. That is it.',
    ],
    [
      'Your {streak}-day streak is looking at you with big sad eyes.',
      '{streak} days of work. Do not leave them hanging now.',
      'Gus did the math: {streak} days of streak, {minutes} minutes to keep it. Easy trade.',
    ],
    [
      'Gus is wilting. Dramatically. On purpose. For you.',
      'Gus has started leaning sideways. He says it is your fault (affectionately).',
      'Gus is losing his green. A stretch would fix that. Hint hint.',
    ],
    [
      'Last call. No time? The 3-minute rescue exists for exactly this.',
      'Okay, final offer: 3-minute rescue. Gus will take it and say nothing. Probably.',
      'Clock is ticking. One 3-minute rescue session. Gus believes in you, mostly.',
    ],
  ],
  unhinged: [
    [
      'THE HOUR HAS COME. Gus summons you to {minutes} minutes of glorious stretching.',
      'Gus has awoken from his slumber and he demands STRETCHES.',
      'Hear ye, hear ye: the stretch begins NOW. Gus has rolled out the tiny grass carpet.',
    ],
    [
      'Gus has been staring at the door for hours. Waiting. Always waiting.',
      'Gus wrote you a poem. It is just the word "stretch" eleven times.',
      'The wind whispers your name. It is Gus. He is the wind now. Please stretch.',
    ],
    [
      'A {streak}-day streak hangs by a single blade of grass. Will you save it?',
      'Gus has lit {streak} tiny candles, one for each day. Do not let them go out.',
      'Legends speak of a {streak}-day streak. The legend continues only if you stretch.',
    ],
    [
      'Gus is WILTING. He has started writing his memoirs. Chapter one: "Abandoned."',
      'Gus has collapsed onto the soil and is whispering "{minutes} minutes" into the void.',
      'Gus is fading to beige. Beige! Do you want that on your conscience?',
    ],
    [
      'FINAL CALL. Gus has one leaf left. The 3-minute rescue can save him.',
      'This is it. The last reminder. 3-minute rescue. Gus is begging on his roots.',
      'Midnight approaches like a villain. Only the 3-minute rescue can stop it.',
    ],
  ],
};

/** Used for steps whose variants all talk about the streak when there is no streak to protect. */
const NO_STREAK_FALLBACK: Record<Tone, string[]> = {
  polite: [
    'Today is a great day to start a streak. Just {minutes} minutes.',
    'Day one starts with a single session. Gus would love to begin with you.',
    'A fresh start is waiting: {minutes} minutes of stretching today.',
  ],
  sassy: [
    'Streaks do not start themselves. {minutes} minutes. Day one. Go.',
    'Gus is ready to count to one. Help him out.',
    'Fun fact: every big streak started as a day like today.',
  ],
  unhinged: [
    'A NEW ERA BEGINS TODAY. Day one. Gus has prepared a parade.',
    'Gus has carved "DAY ONE" into a pebble. Make it true.',
    'The prophecy foretold a streak. It begins with you. Today. {minutes} minutes.',
  ],
};

const TITLES = ['Gus', 'Gus', 'Gus', 'Gus', 'Grasswork'];

function fill(template: string, ctx: { streak: number; minutes: number }): string {
  return template.replace(/\{streak\}/g, String(ctx.streak)).replace(/\{minutes\}/g, String(ctx.minutes));
}

/** Deterministic: the same (tone, step, seed) always yields the same message. */
export function pickMessage(
  tone: Tone,
  step: number,
  seed: number,
  ctx: { streak: number; minutes: number },
): { title: string; body: string } {
  const s = Math.max(0, Math.min(4, Math.floor(step)));
  let variants = MESSAGES[tone][s];
  if (ctx.streak <= 0) {
    const safe = variants.filter((v) => !/streak/i.test(v));
    variants = safe.length > 0 ? safe : NO_STREAK_FALLBACK[tone];
  }
  const idx = ((Math.floor(Math.abs(seed)) % variants.length) + variants.length) % variants.length;
  return { title: TITLES[s], body: fill(variants[idx], ctx) };
}
