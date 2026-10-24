/** Deep links: grasswork://session?kind=daily|rescue|test (reminder notifications carry these in data.url). */
import * as Linking from 'expo-linking';
import type { SessionKind } from '../core/types';

const KINDS: SessionKind[] = ['daily', 'rescue', 'test'];

export function parseKind(k: unknown): SessionKind {
  return typeof k === 'string' && (KINDS as string[]).includes(k) ? (k as SessionKind) : 'daily';
}

/** grasswork://session?kind=rescue → 'rescue'; a non-session url → null */
export function sessionKindFromUrl(url: string | null | undefined): SessionKind | null {
  if (!url) return null;
  const parsed = Linking.parse(url);
  const path = `${parsed.hostname ?? ''}/${parsed.path ?? ''}`.replace(/^\/+/, '');
  if (!path.startsWith('session')) return null;
  return parseKind(parsed.queryParams?.kind);
}
