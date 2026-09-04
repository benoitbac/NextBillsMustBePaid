import {
  BILLS,
  CHARGE,
  DRAFT_SIZE,
  FIELD,
  FIELD_RULES,
  HAMMERS,
  LEGACY,
  PERKS,
  PIGGIES,
  STAMINA,
  baseMods,
  type HammerSpec,
  type PerkSpec,
  type PiggySpec,
} from './balance'
import { chance, cloneRng, makeRng, next, pickWeighted, range } from './rng'
import type { Bill, Input, OverReason, Piggy, RunState, RunSummary, SimEvent } from './types'

const KINDS = Object.values(PIGGIES)

export function hammer(id: string): HammerSpec {
  return HAMMERS.find((h) => h.id === id) ?? HAMMERS[0]!
}

export function perk(id: string): PerkSpec | undefined {
  return PERKS.find((p) => p.id === id)
}

/** Le marteau tel qu'il frappe reellement : specs de base x perks de la run. */
export function effectiveHammer(s: RunState): HammerSpec {
  const h = hammer(s.hammerId)
  const m = s.mods
  return {
    ...h,
    damage: h.damage * m.damage,
    tapCost: h.tapCost * m.tapCost,
    chargeTime: h.chargeTime * m.chargeTime,
    cooldown: h.cooldown * m.cooldown,
    critChance: Math.min(0.85, h.critChance + m.critBonus),
    radiusMin: h.radiusMin * m.radius,
    radiusMax: h.radiusMax * m.radius,
  }
}

export function staminaMax(s: RunState): number {
  return STAMINA.base + s.mods.staminaMaxBonus - s.staminaLost
}

export function createRun(seed: number, hammerId = HAMMERS[0]!.id): RunState {
  const s: RunState = {
    seed,
    rng: makeRng(seed),
    t: 0,
    hammerId,
    stamina: STAMINA.base,
    staminaLost: 0,
    cash: 0,
    unpaid: 0,
    mods: baseMods(),
    perks: [],
    draft: [],
    piggies: [],
    nextPiggyId: 1,
    respawnAt: 0,
    bills: [],
    nextBillId: 1,
    nextBillDueAt: BILLS.firstDueAt,
    billIndex: 0,
    pressedAt: null,
    aimX: 0,
    aimY: 0,
    readyAt: 0,
    totalPaid: 0,
    billsPaid: 0,
    seizures: 0,
    swings: 0,
    breaks: 0,
    staminaSpent: 0,
    overkill: 0,
    over: null,
  }
  for (let i = 0; i < FIELD_RULES.maxAlive; i++) spawnPiggy(s)
  scheduleBills(s)
  return s
}

/** Copie profonde : explorer une variante sans polluer l'etat courant. */
export function cloneRun(s: RunState): RunState {
  return {
    ...s,
    rng: cloneRng(s.rng),
    mods: { ...s.mods },
    perks: [...s.perks],
    draft: [...s.draft],
    piggies: s.piggies.map((p) => ({ ...p })),
    bills: s.bills.map((b) => ({ ...b })),
  }
}

function spawnPiggy(s: RunState): Piggy | null {
  const spec: PiggySpec = pickWeighted(s.rng, KINDS, (k) => k.weight)
  const anchor =
    s.piggies.length > 0 && chance(s.rng, FIELD_RULES.clusterChance)
      ? s.piggies[Math.floor(next(s.rng) * s.piggies.length)]!
      : null

  let x = 0
  let y = 0
  let placed = false
  for (let i = 0; i < FIELD_RULES.spawnAttempts; i++) {
    if (anchor) {
      const a = next(s.rng) * Math.PI * 2
      const r = range(s.rng, FIELD_RULES.clusterMin, FIELD_RULES.clusterMax)
      x = anchor.x + Math.cos(a) * r
      y = anchor.y + Math.sin(a) * r
    } else {
      x = range(s.rng, -FIELD.halfWidth + spec.radius, FIELD.halfWidth - spec.radius)
      y = range(s.rng, -FIELD.halfDepth + spec.radius, FIELD.halfDepth - spec.radius)
    }
    if (
      x < -FIELD.halfWidth + spec.radius ||
      x > FIELD.halfWidth - spec.radius ||
      y < -FIELD.halfDepth + spec.radius ||
      y > FIELD.halfDepth - spec.radius
    ) {
      continue
    }
    let ok = true
    for (const p of s.piggies) {
      const dx = p.x - x
      const dy = p.y - y
      const min = FIELD_RULES.minSpacing * 0.6 + p.radius + spec.radius
      if (dx * dx + dy * dy < min * min) {
        ok = false
        break
      }
    }
    if (ok) {
      placed = true
      break
    }
  }
  if (!placed) return null

  const angle = next(s.rng) * Math.PI * 2
  const p: Piggy = {
    id: s.nextPiggyId++,
    kind: spec.kind,
    hp: spec.hp,
    hpMax: spec.hp,
    x,
    y,
    radius: spec.radius,
    vx: Math.cos(angle) * spec.drift,
    vy: Math.sin(angle) * spec.drift,
    spawnedAt: s.t,
    fleesAt: spec.ttl === null ? null : s.t + spec.ttl,
  }
  s.piggies.push(p)
  return p
}

/** Maintient trois echeances visibles d'avance : le calendrier est l'interface. */
function scheduleBills(s: RunState): void {
  const upcoming = s.bills.filter((b) => b.paidAt === null && !b.seized).length
  for (let n = upcoming; n < 3; n++) {
    const i = s.billIndex
    s.bills.push({
      id: s.nextBillId++,
      label: BILLS.labels[i % BILLS.labels.length]!,
      amount: Math.round(BILLS.baseAmount * Math.pow(BILLS.amountGrowth, i) * s.mods.billAmount),
      dueAt: s.nextBillDueAt,
      paidAt: null,
      seized: false,
    })
    s.billIndex++
    const interval = Math.max(
      BILLS.minInterval,
      BILLS.baseInterval * Math.pow(BILLS.intervalDecay, s.billIndex),
    )
    s.nextBillDueAt += interval
  }
}

export function chargeOf(s: RunState): number {
  if (s.pressedAt === null) return 0
  return Math.min(1, (s.t - s.pressedAt) / effectiveHammer(s).chargeTime)
}

export function swingCost(h: HammerSpec, charge: number): number {
  return h.tapCost * (1 + CHARGE.costMult * charge)
}

export function swingDamage(h: HammerSpec, charge: number): number {
  return h.damage * (1 + CHARGE.damageMult * charge)
}

export function swingRadius(h: HammerSpec, charge: number): number {
  return h.radiusMin + (h.radiusMax - h.radiusMin) * charge
}

function resolveSwing(s: RunState, out: SimEvent[]): void {
  const h = effectiveHammer(s)
  const c = chargeOf(s)
  const cost = swingCost(h, c)
  const radius = swingRadius(h, c)
  const crit = chance(s.rng, h.critChance)
  const base = swingDamage(h, c) * (crit ? h.critMult : 1)
  const x = s.aimX
  const y = s.aimY

  s.stamina -= cost
  s.staminaSpent += cost
  s.swings++
  s.readyAt = s.t + h.cooldown
  out.push({ kind: 'swing', x, y, charge: c, radius, cost })

  const dead: number[] = []
  for (const p of s.piggies) {
    const d = Math.hypot(p.x - x, p.y - y) - p.radius
    if (d > radius) continue
    const falloff = radius > 0 ? 1 - ((1 - CHARGE.edgeFalloff) * Math.max(0, d)) / radius : 1
    const dmg = base * falloff
    s.overkill += Math.max(0, dmg - p.hp)
    p.hp -= dmg
    out.push({ kind: 'hit', piggyId: p.id, x: p.x, y: p.y, damage: dmg, crit })
    if (p.hp <= 0) dead.push(p.id)
  }

  const cap = staminaMax(s)
  for (const id of dead) {
    const idx = s.piggies.findIndex((p) => p.id === id)
    if (idx < 0) continue
    const p = s.piggies[idx]!
    const spec = PIGGIES[p.kind]
    const payout = spec.payout * s.mods.payout
    const refund = spec.refund * s.mods.refund
    s.cash += payout
    s.stamina = Math.min(cap, s.stamina + refund)
    s.cash = Math.max(0, s.cash - spec.cashPenalty)
    s.breaks++
    s.piggies.splice(idx, 1)
    out.push({
      kind: 'break',
      piggyId: p.id,
      piggyKind: p.kind,
      x: p.x,
      y: p.y,
      payout,
      refund,
      penalty: spec.cashPenalty,
    })
  }

  if (s.stamina <= 0) {
    s.stamina = 0
    out.push({ kind: 'exhausted' })
    finish(s, 'exhausted', out)
  }
}

/** Tire DRAFT_SIZE perks distincts, en respectant les plafonds par perk. */
function rollDraft(s: RunState): string[] {
  const pool = PERKS.filter((p) => {
    if (p.max === 0) return true
    return s.perks.filter((id) => id === p.id).length < p.max
  })
  const picked: string[] = []
  const remaining = [...pool]
  while (picked.length < DRAFT_SIZE && remaining.length > 0) {
    const chosen = pickWeighted(s.rng, remaining, (p) => p.weight)
    picked.push(chosen.id)
    remaining.splice(remaining.indexOf(chosen), 1)
  }
  return picked
}

function payBill(s: RunState, billId: number, out: SimEvent[]): void {
  const b = s.bills.find((x) => x.id === billId)
  if (!b || b.paidAt !== null || b.seized) return
  if (s.cash < b.amount) return
  s.cash -= b.amount
  b.paidAt = s.t
  s.totalPaid += b.amount
  s.billsPaid++
  out.push({ kind: 'billPaid', billId: b.id, amount: b.amount })
  if (s.draft.length === 0) {
    s.draft = rollDraft(s)
    out.push({ kind: 'draft', options: [...s.draft] })
  }
  scheduleBills(s)
}

function takePerk(s: RunState, perkId: string, out: SimEvent[]): void {
  if (!s.draft.includes(perkId)) return
  const spec = perk(perkId)
  if (!spec) return
  const before = staminaMax(s)
  spec.apply(s.mods)
  s.perks.push(perkId)
  s.draft = []
  // Un gain de stamina max profite immediatement, sans remplir la jauge.
  s.stamina += Math.max(0, staminaMax(s) - before)
  out.push({ kind: 'perk', perkId })
}

export function legacyOf(s: RunState, reason: OverReason): number {
  const basis = Math.max(0, s.totalPaid)
  let raw = LEGACY.scale * Math.pow(basis / LEGACY.divisor, LEGACY.exponent)
  if (reason === 'declared') {
    const ahead = s.bills.filter((b) => b.paidAt !== null && b.dueAt > s.t).length
    raw *= 1 + LEGACY.aheadBonus * ahead
  } else {
    raw *= LEGACY.exhaustedRatio
  }
  return Math.floor(raw)
}

function finish(s: RunState, reason: OverReason, out: SimEvent[]): void {
  if (s.over !== null) return
  s.over = reason
  out.push({ kind: 'over', reason, legacy: legacyOf(s, reason) })
}

export function step(s: RunState, dt: number, inputs: readonly Input[] = []): SimEvent[] {
  const out: SimEvent[] = []
  if (s.over !== null) return out

  for (const inp of inputs) {
    switch (inp.kind) {
      case 'aim':
        s.aimX = inp.x
        s.aimY = inp.y
        break
      case 'press':
        s.aimX = inp.x
        s.aimY = inp.y
        if (s.t >= s.readyAt && s.pressedAt === null) s.pressedAt = s.t
        break
      case 'release':
        if (s.pressedAt !== null) {
          resolveSwing(s, out)
          s.pressedAt = null
        }
        break
      case 'pay':
        payBill(s, inp.billId, out)
        break
      case 'perk':
        takePerk(s, inp.perkId, out)
        break
      case 'declare':
        finish(s, 'declared', out)
        break
    }
    if (s.over !== null) return out
  }

  s.t += dt

  for (const p of s.piggies) {
    if (p.vx === 0 && p.vy === 0) continue
    p.x += p.vx * dt
    p.y += p.vy * dt
    const lx = FIELD.halfWidth - p.radius
    const ly = FIELD.halfDepth - p.radius
    if (p.x < -lx || p.x > lx) {
      p.x = Math.max(-lx, Math.min(lx, p.x))
      p.vx = -p.vx
    }
    if (p.y < -ly || p.y > ly) {
      p.y = Math.max(-ly, Math.min(ly, p.y))
      p.vy = -p.vy
    }
  }

  for (let i = s.piggies.length - 1; i >= 0; i--) {
    const p = s.piggies[i]!
    if (p.fleesAt !== null && s.t >= p.fleesAt) {
      s.piggies.splice(i, 1)
      out.push({ kind: 'flee', piggyId: p.id })
    }
  }

  if (s.piggies.length < FIELD_RULES.maxAlive && s.t >= s.respawnAt) {
    const p = spawnPiggy(s)
    s.respawnAt = s.t + FIELD_RULES.respawnDelay
    if (p) out.push({ kind: 'spawn', piggyId: p.id })
  }

  for (const b of s.bills) {
    if (b.paidAt !== null || b.seized) continue
    if (s.t < b.dueAt) continue
    b.seized = true
    s.unpaid += b.amount
    s.seizures++
    const lost = STAMINA.base * BILLS.seizureStaminaLoss * s.mods.seizureLoss
    s.staminaLost += lost
    s.stamina = Math.min(s.stamina, staminaMax(s))
    out.push({ kind: 'seizure', billId: b.id, staminaLost: lost })
  }
  scheduleBills(s)

  if (s.seizures >= BILLS.maxSeizures || staminaMax(s) <= STAMINA.seizedFloor) {
    finish(s, 'seized', out)
    return out
  }
  if (s.stamina <= 0) {
    s.stamina = 0
    out.push({ kind: 'exhausted' })
    finish(s, 'exhausted', out)
  }
  return out
}

export function summarize(s: RunState): RunSummary {
  const reason = s.over ?? 'declared'
  return {
    reason,
    duration: s.t,
    cash: s.cash,
    unpaid: s.unpaid,
    totalPaid: s.totalPaid,
    billsPaid: s.billsPaid,
    perks: [...s.perks],
    seizures: s.seizures,
    swings: s.swings,
    breaks: s.breaks,
    staminaSpent: s.staminaSpent,
    overkill: s.overkill,
    legacy: legacyOf(s, reason),
  }
}

export function upcomingBills(s: RunState): Bill[] {
  return s.bills
    .filter((b) => b.paidAt === null && !b.seized)
    .sort((a, b) => a.dueAt - b.dueAt)
}
