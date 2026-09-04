/**
 * PRNG sfc32 : deterministe, serialisable, 4 mots d'etat.
 * Choisi contre Math.random (non seedable, donc ni replay ni test)
 * et contre mulberry32 (32 bits d'etat : periode trop courte pour
 * les 10^7 tirages d'une campagne de simulation).
 */
export interface RngState {
  a: number
  b: number
  c: number
  d: number
}

export function makeRng(seed: number): RngState {
  let a = seed >>> 0
  let b = (seed ^ 0x9e3779b9) >>> 0
  let c = (seed ^ 0x85ebca6b) >>> 0
  let d = (seed ^ 0xc2b2ae35) >>> 0
  const s: RngState = { a, b, c, d }
  for (let i = 0; i < 12; i++) next(s)
  return s
}

export function cloneRng(s: RngState): RngState {
  return { a: s.a, b: s.b, c: s.c, d: s.d }
}

export function next(s: RngState): number {
  const t = (s.a + s.b) >>> 0
  s.a = (s.b ^ (s.b >>> 9)) >>> 0
  s.b = (s.c + (s.c << 3)) >>> 0
  s.c = ((s.c << 21) | (s.c >>> 11)) >>> 0
  s.c = (s.c + t) >>> 0
  s.d = (s.d + 1) >>> 0
  const r = (t + s.d) >>> 0
  return r / 4294967296
}

export function range(s: RngState, lo: number, hi: number): number {
  return lo + next(s) * (hi - lo)
}

export function intRange(s: RngState, lo: number, hi: number): number {
  return Math.floor(lo + next(s) * (hi - lo + 1))
}

export function chance(s: RngState, p: number): boolean {
  return next(s) < p
}

export function pickWeighted<T>(s: RngState, items: readonly T[], weight: (t: T) => number): T {
  let total = 0
  for (const it of items) total += weight(it)
  let r = next(s) * total
  for (const it of items) {
    r -= weight(it)
    if (r <= 0) return it
  }
  return items[items.length - 1]!
}
