import type { Mods, PiggyKind } from './balance'
import type { RngState } from './rng'

export interface Piggy {
  id: number
  kind: PiggyKind
  hp: number
  hpMax: number
  x: number
  y: number
  /** Derive courante, en unites/s. */
  vx: number
  vy: number
  radius: number
  spawnedAt: number
  /** Instant de fuite (jackpot), sinon null. */
  fleesAt: number | null
}

export interface Bill {
  id: number
  label: string
  amount: number
  dueAt: number
  paidAt: number | null
  /** Echue et impayee : passee en dette, avec saisie. */
  seized: boolean
}

export type OverReason = 'exhausted' | 'seized' | 'declared'

export interface RunState {
  seed: number
  rng: RngState
  t: number
  hammerId: string

  stamina: number
  /** Stamina max perdue aux saisies, cumulee. */
  staminaLost: number
  cash: number
  /** Total des factures passees en saisie, sans interets. */
  unpaid: number

  mods: Mods
  perks: string[]
  /** Tirage en attente apres une facture payee (vide sinon). */
  draft: string[]

  piggies: Piggy[]
  nextPiggyId: number
  respawnAt: number

  bills: Bill[]
  nextBillId: number
  nextBillDueAt: number
  billIndex: number

  /** Charge en cours : instant du press, ou null. */
  pressedAt: number | null
  aimX: number
  aimY: number
  /** Prochain instant ou un coup est possible. */
  readyAt: number

  totalPaid: number
  billsPaid: number
  seizures: number
  swings: number
  breaks: number
  staminaSpent: number
  overkill: number

  over: OverReason | null
}

export type Input =
  | { kind: 'press'; x: number; y: number }
  | { kind: 'aim'; x: number; y: number }
  | { kind: 'release' }
  | { kind: 'pay'; billId: number }
  | { kind: 'perk'; perkId: string }
  | { kind: 'declare' }

export type SimEvent =
  | { kind: 'swing'; x: number; y: number; charge: number; radius: number; cost: number }
  | { kind: 'hit'; piggyId: number; x: number; y: number; damage: number; crit: boolean }
  | { kind: 'break'; piggyId: number; piggyKind: PiggyKind; x: number; y: number; payout: number; refund: number; penalty: number }
  | { kind: 'spawn'; piggyId: number }
  | { kind: 'flee'; piggyId: number }
  | { kind: 'billPaid'; billId: number; amount: number }
  | { kind: 'draft'; options: string[] }
  | { kind: 'perk'; perkId: string }
  | { kind: 'seizure'; billId: number; staminaLost: number }
  | { kind: 'exhausted' }
  | { kind: 'over'; reason: OverReason; legacy: number }

export interface RunSummary {
  reason: OverReason
  duration: number
  cash: number
  /** Total des factures passees en saisie, sans interets. */
  unpaid: number
  totalPaid: number
  billsPaid: number
  perks: string[]
  seizures: number
  swings: number
  breaks: number
  staminaSpent: number
  overkill: number
  legacy: number
}
