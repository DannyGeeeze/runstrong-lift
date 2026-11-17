// Which demo to show for an exercise: an embedded video if its video_url is a
// direct YouTube / Instagram / Vimeo link, otherwise a built-in animation.
// New exercises in the JSON are matched automatically by name, then by slot.

import { isoKind } from "../exercises";
import type { Exercise } from "../types";
import { PATTERNS, type Pattern } from "./patterns";

/** First match wins, so more specific patterns come first. */
const RULES: [RegExp, string][] = [
  [/dead-bug|hollow/, "dead-bug"],
  [/bird-dog/, "bird-dog"],
  [/greatest-stretch|couch-stretch/, "split-squat"],
  [/drop-jump|depth-jump|drop jump/, "drop-jump"],
  [/nordic/, "nordic"],
  [/copenhagen|side-plank|adductor|adduction/, "copenhagen"],
  [/skater|lateral|slalom|side-to-side|shuffle|carioca|lateral-bound/, "lateral-bound"],
  [/monster|band-walk|abduct|clam|hip-hike|lateral-walk/, "band-walk"],
  [/bridge|thrust|ham-curl|hamstring|slider|physioball|leg-curl/, "bridge"],
  [/pogo|ankle-hop|jump-rope|oscillation/, "pogo"],
  [/skip/, "skip"],
  [/hop|bound/, "hop"],
  [/jump|clean|snatch|jerk|throw/, "jump"],
  [/tib|dorsi|heel-walk|toe-raise/, "tib-raise"],
  [/hip-flexor|knee-drive|march|psoas|-hf|hf-|knee-up/, "knee-drive"],
  [/split|lunge|step|bulgarian|bss|spanish|single-leg-squat|pistol/, "split-squat"],
  [/rdl|deadlift|hinge|good-morning|swing|back-extension|reverse-hyper|pull-through/, "hinge"],
  [/calf|achilles|soleus|toe|foot|ankle|arch|heel|balance|bosu/, "calf-raise"],
  [/squat|leg-press|belt|wall-sit/, "squat"],
  [/front-plank|shoulder-tap|^plank/, "plank"],
  [/row|press|push|pull-up|chin|curl|fly|raise|plank|carry/, "row"],
];

const BY_SLOT: Record<string, string> = {
  A1: "pogo",
  A2: "lateral-bound",
  B1: "squat",
  POWER: "jump",
  C1: "hinge",
  C2: "calf-raise",
  D1: "knee-drive",
  D2: "band-walk",
  ISO: "split-squat",
  MOBILITY: "knee-drive",
  UPPER: "row",
  CORE: "plank",
};

/** Upper-body moves only match upper-body animations. */
const UPPER_RULES: [RegExp, string][] = [
  [/^(?!scap).*(push-up|bench-press|med-ball-bench)/, "push-up"],
  [/^(?!.*rotation).*press/, "press"],
  [/plank|crawl/, "plank"],
];

export function patternFor(e: Exercise): Pattern {
  const text = `${e.id} ${e.name}`.toLowerCase();
  if (e.slot === "UPPER") {
    for (const [re, id] of UPPER_RULES) if (re.test(e.id)) return PATTERNS[id];
    return PATTERNS.row;
  }
  for (const [re, id] of RULES) if (re.test(text)) return PATTERNS[id];
  return PATTERNS[BY_SLOT[e.slot] ?? "squat"];
}

/** Isometric exercises show the held position instead of the loop. */
export function isHold(e: Exercise): boolean {
  return isoKind(e) !== null;
}

export interface Embed {
  src: string;
  /** Width / height. */
  aspect: number;
}

/** Turn a direct video link into an in-app embed. Category pages and other links return null. */
export function embedFor(url: string | undefined): Embed | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtube.com" || host === "youtu.be") {
    const short = u.pathname.match(/^\/shorts\/([\w-]{6,})/);
    const id =
      host === "youtu.be" ? u.pathname.slice(1) : short?.[1] ?? u.searchParams.get("v") ?? u.pathname.match(/^\/embed\/([\w-]+)/)?.[1];
    if (!id || !/^[\w-]{6,}$/.test(id)) return null;
    return { src: `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`, aspect: short ? 9 / 16 : 16 / 9 };
  }
  if (host === "instagram.com") {
    const m = u.pathname.match(/^\/(p|reel|reels|tv)\/([\w-]+)/);
    if (!m) return null;
    return { src: `https://www.instagram.com/${m[1] === "reels" ? "reel" : m[1]}/${m[2]}/embed`, aspect: 9 / 16 };
  }
  if (host === "vimeo.com") {
    const id = u.pathname.match(/^\/(\d+)/)?.[1];
    return id ? { src: `https://player.vimeo.com/video/${id}`, aspect: 16 / 9 } : null;
  }
  return null;
}
