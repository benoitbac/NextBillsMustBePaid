import { CHARGE, PIGGIES, STAMINA, baseMods, type Mods } from './balance'
import {
  chargeOf,
  effectiveHammer,
  perk,
  staminaMax,
  swingCost,
  swingDamage,
  swingRadius,
  upcomingBills,
} from './sim'
import type { HammerSpec } from './balance'
import type { Input, Piggy, RunState } from './types'

/**
 * Politiques de frappe. Elles existent pour une raison precise : verifier
 * qu'aucune ne domine les autres. Si `charge` battait `tap` partout, le
 * choix a chaque coup serait decoratif — et tout le design tomberait.
 */
export type Policy = 'tap' | 'charge' | 'adaptive'

export interface BotConfig {
  policy: Policy
  /** Stamina-equivalent d'une seconde de jeu : les factures tombent a l'heure. */
  timeWeight: number
  /** Fraction de stamina max sous laquelle le bot declare la banqueroute. */
  declareAt: number
  /** Paliers de charge explores par la politique adaptative. */
  chargeSteps: readonly number[]
}

/**
 * Combien de stamina vaut une seconde, marteau par marteau.
 * Ces valeurs ne sont pas choisies : elles sortent de `npm run sim -- --sweep`,
 * qui montre un optimum net et different pour chacun. Les refaire apres tout
 * changement d'equilibrage fait partie du changement.
 */
export const TIME_WEIGHT: Readonly<Record<string, number>> = {
  poche: 8,
  ciseau: 8,
  masse: 4,
  batte: 2,
}

export const DEFAULT_BOT: BotConfig = {
  policy: 'adaptive',
  timeWeight: 4,
  declareAt: 0.08,
  chargeSteps: [0, 0.25, 0.5, 0.75, 1],
}

interface Plan {
  x: number
  y: number
  charge: number
  score: number
}

/** Valeur d'un point de degat sur cette tirelire, en unites de cash. */
function damageValue(p: Piggy, mods: Mods): number {
  const spec = PIGGIES[p.kind]
  return (spec.payout * mods.payout - spec.cashPenalty) / spec.hp
}

function rate(
  s: RunState,
  h: HammerSpec,
  x: number,
  y: number,
  charge: number,
  cfg: BotConfig,
  mods: Mods,
): number {
  const radius = swingRadius(h, charge)
  const base = swingDamage(h, charge) * (1 + h.critChance * (h.critMult - 1))
  const cost = swingCost(h, charge)
  const duration = h.chargeTime * charge + h.cooldown

  let value = 0
  for (const p of s.piggies) {
    const d = Math.hypot(p.x - x, p.y - y) - p.radius
    if (d > radius) continue
    const falloff = radius > 0 ? 1 - ((1 - CHARGE.edgeFalloff) * Math.max(0, d)) / radius : 1
    const dmg = base * falloff
    value += Math.min(dmg, p.hp) * damageValue(p, mods)
    if (dmg >= p.hp) value += PIGGIES[p.kind].refund * mods.refund * 0.8
  }
  const w = cfg.timeWeight ?? TIME_WEIGHT[s.hammerId] ?? 4
  return value / (cost + w * duration)
}

function bestPlan(s: RunState, cfg: BotConfig, mods = s.mods): Plan | null {
  const steps = cfg.policy === 'tap' ? [0] : cfg.policy === 'charge' ? [1] : cfg.chargeSteps
  // Le marteau effectif est calcule une fois : le recalculer dans rate()
  // recopiait tout l'etat de run des centaines de fois par tick.
  const h = mods === s.mods ? effectiveHammer(s) : effectiveHammer({ ...s, mods })
  let best: Plan | null = null
  for (const p of s.piggies) {
    for (const c of steps) {
      const score = rate(s, h, p.x, p.y, c, cfg, mods)
      if (best === null || score > best.score) best = { x: p.x, y: p.y, charge: c, score }
    }
  }
  return best
}

/**
 * Choix de perk : debit x budget, deflate par ce que coutent les factures.
 * Grossier, mais c'est la meme grandeur pour les trois options — donc le
 * classement, lui, veut dire quelque chose.
 */
function bestPerk(s: RunState, cfg: BotConfig): string | null {
  let bestId: string | null = null
  let bestUtil = -Infinity
  for (const id of s.draft) {
    const spec = perk(id)
    if (!spec) continue
    const mods: Mods = { ...baseMods(), ...s.mods }
    spec.apply(mods)
    const plan = bestPlan(s, { ...cfg, policy: 'adaptive' }, mods)
    const budget = STAMINA.base + mods.staminaMaxBonus - s.staminaLost
    const util = ((plan?.score ?? 0) * budget) / mods.billAmount
    if (util > bestUtil) {
      bestUtil = util
      bestId = id
    }
  }
  return bestId
}

export interface BotMemory {
  target: Plan | null
}

export function createBotMemory(): BotMemory {
  return { target: null }
}

/** Inputs a jouer sur ce tick. Aucun effet de bord sur l'etat de run. */
export function botInputs(s: RunState, mem: BotMemory, cfg: BotConfig = DEFAULT_BOT): Input[] {
  const inputs: Input[] = []
  if (s.over !== null) return inputs

  if (s.draft.length > 0) {
    const id = bestPerk(s, cfg)
    if (id) inputs.push({ kind: 'perk', perkId: id })
  }

  for (const b of upcomingBills(s)) {
    if (s.cash >= b.amount) inputs.push({ kind: 'pay', billId: b.id })
  }

  if (s.stamina <= staminaMax(s) * cfg.declareAt) {
    inputs.push({ kind: 'declare' })
    return inputs
  }

  const h = effectiveHammer(s)
  if (s.pressedAt === null) {
    if (s.t < s.readyAt) return inputs
    const plan = bestPlan(s, cfg)
    if (plan === null || plan.score <= 0) return inputs
    mem.target = plan
    inputs.push({ kind: 'press', x: plan.x, y: plan.y })
    if (plan.charge === 0) inputs.push({ kind: 'release' })
    return inputs
  }

  const want = mem.target?.charge ?? 0
  if (chargeOf(s) >= want || s.t - s.pressedAt >= h.chargeTime) {
    inputs.push({ kind: 'release' })
  }
  return inputs
}
