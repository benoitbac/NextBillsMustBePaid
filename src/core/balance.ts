/**
 * Tout l'equilibrage vit ici, et nulle part ailleurs.
 * Une constante dispersee dans la logique est une constante qu'on ne
 * retrouve pas quand la simulation dit qu'elle est fausse.
 */

export const FIELD = {
  halfWidth: 7.5,
  halfDepth: 4.0,
} as const

export const TICK = 1 / 120

export type PiggyKind = 'classique' | 'ballon' | 'chene' | 'grelot' | 'jackpot' | 'piege'

export interface PiggySpec {
  readonly kind: PiggyKind
  readonly hp: number
  readonly payout: number
  /** Poids de tirage dans la table de spawn. */
  readonly weight: number
  readonly radius: number
  /** Stamina rendue a la casse — le "second souffle". */
  readonly refund: number
  /** Vitesse de derive (0 = immobile). */
  readonly drift: number
  /** Duree de vie avant fuite, en secondes (null = reste). */
  readonly ttl: number | null
  /** Cash perdu comptant quand elle casse (les pieges). */
  readonly cashPenalty: number
}

export const PIGGIES: Readonly<Record<PiggyKind, PiggySpec>> = {
  classique: { kind: 'classique', hp: 26, payout: 16, weight: 42, radius: 0.62, refund: 1.75, drift: 0, ttl: null, cashPenalty: 0 },
  ballon: { kind: 'ballon', hp: 9, payout: 8, weight: 17, radius: 0.5, refund: 1.1, drift: 1.5, ttl: null, cashPenalty: 0 },
  chene: { kind: 'chene', hp: 150, payout: 120, weight: 13, radius: 0.85, refund: 4.6, drift: 0, ttl: null, cashPenalty: 0 },
  grelot: { kind: 'grelot', hp: 14, payout: 6, weight: 13, radius: 0.5, refund: 6.7, drift: 0, ttl: null, cashPenalty: 0 },
  jackpot: { kind: 'jackpot', hp: 95, payout: 520, weight: 6, radius: 0.7, refund: 3.2, drift: 0.6, ttl: 9.0, cashPenalty: 0 },
  piege: { kind: 'piege', hp: 8, payout: 0, weight: 9, radius: 0.55, refund: 0, drift: 0, ttl: null, cashPenalty: 90 },
}

export const FIELD_RULES = {
  maxAlive: 11,
  /** Delai avant qu'un emplacement libere ne repeuple. */
  respawnDelay: 0.42,
  /** Distance minimale entre deux centres au spawn. */
  minSpacing: 1.05,
  spawnAttempts: 24,
  /**
   * Le champ se peuple en grappes, pas uniformement : sans grappes,
   * une AoE ne trouve jamais trois cibles et la charge n'a aucun sens.
   * C'est aussi ce qui rend le terrain lisible — on vise un amas, pas un point.
   */
  clusterChance: 0.62,
  clusterMin: 1.0,
  clusterMax: 2.1,
} as const

export interface HammerSpec {
  readonly id: string
  readonly name: string
  readonly damage: number
  /** Cout stamina d'un tap (charge nulle). */
  readonly tapCost: number
  /** Secondes de maintien pour atteindre la charge pleine. */
  readonly chargeTime: number
  /** Temps mort apres un coup. */
  readonly cooldown: number
  readonly critChance: number
  readonly critMult: number
  /** Rayon a charge nulle / a charge pleine. */
  readonly radiusMin: number
  readonly radiusMax: number
  readonly blurb: string
}

/**
 * LE compromis central, et la raison d'etre du jeu.
 *
 * Deux ressources sont contraignantes, pas une : la stamina termine la run,
 * l'horloge amene les factures. La charge est econome en stamina et couteuse
 * en temps ; le tap l'inverse. Avec le marteau de poche :
 *
 *   tap           6 dmg / 1.0 stamina = 6.0 dmg/stamina  |  6/0.17s  = 35 dmg/s
 *   charge pleine 30 dmg / 4.2 stamina = 7.1 dmg/stamina  |  30/1.02s = 29 dmg/s
 *
 * Soit +19 % d'efficacite par point de stamina contre -17 % de debit.
 *
 * Donc : on charge quand la stamina est le mur, on tape quand une facture
 * arrive. Aucune des deux ne domine — c'est verifie par tests/economy.test.ts
 * et par le balayage `--sweep` du simulateur, pas suppose.
 */
export const CHARGE = {
  damageMult: 4,
  costMult: 3.2,
  /** Degats au bord du rayon, en fraction du centre. */
  edgeFalloff: 0.5,
} as const

export const HAMMERS: readonly HammerSpec[] = [
  {
    id: 'poche',
    name: 'Marteau de poche',
    damage: 6,
    tapCost: 1.0,
    chargeTime: 0.85,
    cooldown: 0.17,
    critChance: 0.06,
    critMult: 2.0,
    radiusMin: 0.0,
    radiusMax: 1.7,
    blurb: 'Polyvalent. Ne fait rien de travers, ne fait rien de remarquable.',
  },
  {
    id: 'ciseau',
    name: 'Ciseau de precision',
    damage: 4,
    tapCost: 0.75,
    chargeTime: 1.1,
    cooldown: 0.1,
    critChance: 0.24,
    critMult: 3.0,
    radiusMin: 0.0,
    radiusMax: 0.6,
    blurb: 'Cadence et critiques. Sa charge n’a presque pas de rayon : il ne pardonne pas les grappes.',
  },
  {
    id: 'masse',
    name: 'Masse de chantier',
    damage: 11,
    tapCost: 2.4,
    chargeTime: 1.5,
    cooldown: 0.33,
    critChance: 0.03,
    critMult: 2.0,
    radiusMin: 0.25,
    radiusMax: 2.25,
    blurb: 'Lente et large. Chaque coup compte, y compris ceux qui touchent un piege.',
  },
  {
    id: 'batte',
    name: 'Batte cloutee',
    damage: 9,
    tapCost: 1.5,
    chargeTime: 1.0,
    cooldown: 0.24,
    critChance: 0.12,
    critMult: 2.4,
    radiusMin: 0.15,
    radiusMax: 2.05,
    blurb: 'Le milieu assume : assez large pour grouper, assez vif pour finir.',
  },
]

export const STAMINA = {
  base: 100,
  /** Plancher de stamina max sous lequel la saisie est totale. */
  seizedFloor: 26,
} as const

/**
 * Les factures sont un calendrier, pas une surprise : le joueur les voit
 * venir et decide quoi casser en consequence. Une facture aleatoire non
 * annoncee supprime la decision au lieu de la creer.
 */
export const BILLS = {
  firstDueAt: 24,
  baseInterval: 21,
  /** L'echeancier se resserre facture apres facture. */
  intervalDecay: 0.96,
  minInterval: 11,
  baseAmount: 55,
  amountGrowth: 1.34,
  /**
   * Trois saisies et la run s'arrete. Un compteur qui se remplit se lit
   * d'un coup d'oeil ; une dette a interets composes se subit sans se lire,
   * et transforme une mauvaise minute en run deja perdue sans le dire.
   */
  maxSeizures: 3,
  /** Stamina max perdue a chaque saisie, en fraction de la base. */
  seizureStaminaLoss: 0.14,
  labels: [
    'Loyer', 'Electricite', 'Internet', 'Eau', 'Mutuelle', 'Telephone',
    'Assurance', 'Chauffage', 'Credit auto', 'Impots', 'Copropriete', 'Cantine',
    'Ordures', 'Redevance', 'Gaz', 'Peages',
  ],
} as const

/**
 * L'escalade a l'interieur d'une run.
 *
 * Sans elle, les factures croissent et pas les revenus : la run n'est pas
 * une montee, c'est une pente. Chaque facture payee ouvre un tirage de trois
 * perks dont on garde un — c'est la ou la variance entre deux runs se cree,
 * et c'est ce qui manque a l'original apres la quatrieme heure.
 */
export interface PerkSpec {
  readonly id: string
  readonly name: string
  readonly text: string
  readonly weight: number
  /** Nombre maximal d'exemplaires dans une run (0 = illimite). */
  readonly max: number
  readonly apply: (m: Mods) => void
}

export interface Mods {
  damage: number
  payout: number
  refund: number
  staminaMaxBonus: number
  critBonus: number
  radius: number
  cooldown: number
  chargeTime: number
  tapCost: number
  billAmount: number
  seizureLoss: number
}

export function baseMods(): Mods {
  return {
    damage: 1,
    payout: 1,
    refund: 1,
    staminaMaxBonus: 0,
    critBonus: 0,
    radius: 1,
    cooldown: 1,
    chargeTime: 1,
    tapCost: 1,
    billAmount: 1,
    seizureLoss: 1,
  }
}

export const PERKS: readonly PerkSpec[] = [
  { id: 'poigne', name: 'Poigne', text: 'Degats +28 %', weight: 10, max: 0, apply: (m) => { m.damage *= 1.28 } },
  { id: 'cafeine', name: 'Cafeine', text: 'Temps mort -14 %', weight: 10, max: 5, apply: (m) => { m.cooldown *= 0.86 } },
  { id: 'gym', name: 'Salle de sport', text: 'Stamina max +20', weight: 10, max: 0, apply: (m) => { m.staminaMaxBonus += 20 } },
  { id: 'souffle', name: 'Second souffle', text: 'Stamina rendue a la casse +50 %', weight: 8, max: 0, apply: (m) => { m.refund *= 1.5 } },
  { id: 'oeil', name: 'Coup d’oeil', text: 'Chance de critique +9 pts', weight: 8, max: 4, apply: (m) => { m.critBonus += 0.09 } },
  { id: 'tete', name: 'Grosse tete', text: 'Rayon de charge +30 %', weight: 8, max: 4, apply: (m) => { m.radius *= 1.3 } },
  { id: 'usurier', name: 'Usurier', text: 'Butin +32 %', weight: 10, max: 0, apply: (m) => { m.payout *= 1.32 } },
  { id: 'poignet', name: 'Poignet souple', text: 'Charge 22 % plus rapide', weight: 8, max: 4, apply: (m) => { m.chargeTime *= 0.78 } },
  { id: 'econome', name: 'Econome', text: 'Cout des taps -16 %', weight: 8, max: 4, apply: (m) => { m.tapCost *= 0.84 } },
  { id: 'renego', name: 'Renegociation', text: 'Toutes les factures a venir -14 %', weight: 6, max: 4, apply: (m) => { m.billAmount *= 0.86 } },
  { id: 'assurance', name: 'Assurance', text: 'Saisies deux fois moins lourdes', weight: 5, max: 2, apply: (m) => { m.seizureLoss *= 0.5 } },
]

export const DRAFT_SIZE = 3

export const LEGACY = {
  scale: 4,
  exponent: 0.62,
  divisor: 100,
  /** Bonus par facture payee d'avance au moment ou l'on declare. */
  aheadBonus: 0.25,
  /** Une run qui s'eteint faute de stamina ne rend que la moitie. */
  exhaustedRatio: 0.5,
} as const
