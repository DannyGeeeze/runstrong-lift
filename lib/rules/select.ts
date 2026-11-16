/**
 * ============================================================================
 *  EXERCISE SELECTION
 * ============================================================================
 *  For each slot we build a deterministic, ordered list of candidates, then pick
 *  index `attempt` from it (attempt 0 = first generate, 1+ = Regenerate). So:
 *    - Regenerate always stays in the same slot and session type.
 *    - Order: block picks first (keep the same picks 3–4 weeks), then a ~70/30
 *      interleave of featured vs library exercises.
 *    - A "prefer" predicate (e.g. plyo categories not yet done this week) moves
 *      matching candidates to the front without excluding anything.
 *  The order is seeded by date + slot key, so it's stable within a day and
 *  testable.
 * ============================================================================
 */

import { addDays, diffDays } from "../dates";
import type { BlockPicks, Exercise } from "../types";

/** Keep block picks this long before rotating (the coach: 3–4 weeks). */
export const BLOCK_DAYS = 28;
/** Featured share when filling from outside the block. */
export const FEATURED_SHARE = 0.7;
/** Picks remembered per slot key. */
export const PICKS_PER_SLOT = 2;

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small seeded PRNG (mulberry32). */
export function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function orderCandidates(
  candidates: Exercise[],
  opts: { seed: string; blockIds?: string[]; prefer?: (e: Exercise) => boolean },
): Exercise[] {
  const rand = rng(opts.seed);
  const blockIds = opts.blockIds ?? [];
  const inBlock = blockIds
    .map((id) => candidates.find((c) => c.id === id))
    .filter((e): e is Exercise => !!e);
  const rest = candidates.filter((c) => !blockIds.includes(c.id));
  const featured = shuffle(rest.filter((c) => c.featured), rand);
  const library = shuffle(rest.filter((c) => !c.featured), rand);

  const tail: Exercise[] = [];
  while (featured.length || library.length) {
    const takeFeatured = featured.length > 0 && (library.length === 0 || rand() < FEATURED_SHARE);
    tail.push((takeFeatured ? featured : library).shift()!);
  }
  const ordered = [...inBlock, ...tail];
  if (!opts.prefer) return ordered;
  return [...ordered.filter(opts.prefer), ...ordered.filter((e) => !opts.prefer!(e))];
}

/** Pick one exercise for a slot key, skipping ids already used this session. */
export function pick(
  candidates: Exercise[],
  opts: {
    key: string;
    date: string;
    attempt: number;
    used: Set<string>;
    block: BlockPicks | null;
    prefer?: (e: Exercise) => boolean;
  },
): Exercise | null {
  const ordered = orderCandidates(
    candidates.filter((c) => !opts.used.has(c.id)),
    {
      seed: `${opts.date}:${opts.key}`,
      blockIds: opts.block?.picks[opts.key],
      prefer: opts.prefer,
    },
  );
  if (ordered.length === 0) return null;
  const chosen = ordered[opts.attempt % ordered.length];
  opts.used.add(chosen.id);
  return chosen;
}

/** Start a new block when there isn't one or it's older than BLOCK_DAYS. */
export function currentBlock(block: BlockPicks | null, today: string): BlockPicks {
  if (!block || diffDays(block.startedOn, today) >= BLOCK_DAYS || block.startedOn > today) {
    return { startedOn: today, picks: {} };
  }
  return block;
}

/** After a completed session, remember its picks per slot key (up to PICKS_PER_SLOT). */
export function addToBlock(
  block: BlockPicks | null,
  today: string,
  items: { key: string; exerciseId: string }[],
): BlockPicks {
  const b = currentBlock(block, today);
  const picks = { ...b.picks };
  for (const { key, exerciseId } of items) {
    const list = picks[key] ?? [];
    if (!list.includes(exerciseId) && list.length < PICKS_PER_SLOT) picks[key] = [...list, exerciseId];
  }
  return { startedOn: b.startedOn, picks };
}

export function blockEnds(block: BlockPicks): string {
  return addDays(block.startedOn, BLOCK_DAYS);
}
