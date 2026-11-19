// Which demo to show for an exercise: an embedded video if its video_url is a
// direct YouTube / Instagram / Vimeo link, otherwise a built-in animation.
// New exercises in the JSON are matched automatically by name, then by slot.

import { isoKind } from "../exercises";
import type { Exercise } from "../types";
import { PATTERNS, type Pattern } from "./patterns";

/** First match wins, so more specific patterns come first. Matched against "id name", lowercased. */
const RULES: [RegExp, string][] = [
  // Specific moves that the broad rules below would get wrong.
  [/razor-curl|ghd-hamstring-curl|ghd-lean|nordic/, "nordic"],
  [/back-extension|reverse-hyper(?!-hf)/, "back-extension"],
  [/heel-elevated-goblet-squat/, "squat"],
  [/clean-deadlift/, "hinge"],
  [/touch-the-ceiling/, "jump"],
  [/single-leg-deceleration/, "drop-jump"],
  [/big-toe|short-foot|foot-tso|foot-plank|toe-abduction|toe-adduction/, "foot-work"],
  // Plyos
  [/drop-jump|depth-jump|drop jump/, "drop-jump"],
  [/split-squat-oscillation|split-exchange|ffess-oscillation/, "split-pogo"],
  [/copenhagen|side-plank|adductor|adduction/, "copenhagen"],
  [/skater|slalom|slant-board-hop|side-to-side|shuffle|carioca|(?<![a-z])lateral-(lunge|bound|hop)/, "lateral-bound"],
  [/monster|band-walk|abduct|clam|hip-hike|lateral-walk|cossack/, "band-walk"],
  // Hamstrings and hinges
  [/single-leg.*rdl|single leg.*rdl|(^|\s)sl-.*rdl|landmine-single-leg|hip-airplane/, "sl-rdl"],
  [/hamstring-curl|ham-curl|physioball|slider-hamstring|hamstring-slider|hamstring-impulse|hamstring-tantrum|walkout|hamstring-oscillation/, "ham-curl"],
  [/bridge|thrust|hip-lift|hamstring-iso|hamstring-overcoming/, "bridge"],
  // Hip mobility
  [/90-90|external-rotation|internal-rotation/, "hip-switch"],
  [/figure-4|pigeon/, "figure-4"],
  [/hurdler|cars(\s|$)|hip-circle/, "hip-car"],
  [/hip-flexor|knee-drive|march|psoas|-hf|hf-|knee-up|sit-up/, "knee-drive"],
  // Balance, throws, carries
  [/balance|bosu/, "balance"],
  [/slam|scoop-toss|jackhammer|wall-ball/, "slam"],
  [/carry|toe-walk|sled/, "carry"],
  [/pogo|ankle-hop|jump-rope|oscillation/, "pogo"],
  [/skip/, "skip"],
  [/hop|bound/, "hop"],
  [/jump|clean|snatch|jerk|throw/, "jump"],
  // Lower-leg strength
  [/tib|dorsi|heel-walk|toe-raise/, "tib-raise"],
  [/soleus|seated|bent-knee|squatted/, "soleus-raise"],
  [/single-leg.*calf|sl-calf|runner-stance|sprint-angle-single-leg/, "sl-calf"],
  // Single-leg strength
  [/step-up|step up/, "step-up"],
  [/bulgarian|bss/, "bss"],
  [/lunge/, "lunge"],
  [/split|spanish|single-leg-squat|pistol/, "split-squat"],
  [/rdl|deadlift|hinge|good-?morning|swing|kneeling-hip-extension|pull-through/, "hinge"],
  [/calf|achilles|toe|foot|ankle|arch|heel/, "calf-raise"],
  [/squat|leg-press|belt|wall-sit/, "squat"],
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
};

/** Upper-body moves only match upper-body animations. Matched against the id. */
const UPPER_RULES: [RegExp, string][] = [
  [/curl/, "curl"],
  [/triceps-extension/, "triceps-extension"],
  [/lateral-raise|pull-apart/, "lateral-raise"],
  [/^(pull-up|pull-up-eccentric-only|chin-up|cable-lat-pull-down|band-lat-pull-down|deadhang|scap-pull-up)$/, "pull-down"],
  [/carry/, "carry"],
  [/iyt|atyt|^wy$|w-on-bench|field-goal|snow-angel/, "prone-raise"],
  [/back-extension/, "back-extension"],
  [/slam|scoop|jackhammer/, "slam"],
  [/scap-push-up|serratus|plank|crawl/, "plank"],
  [/push-up|bench-press|med-ball-bench/, "push-up"],
  [/press/, "press"],
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
