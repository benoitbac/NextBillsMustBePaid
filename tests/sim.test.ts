import { describe, expect, it } from 'vitest'
import { BILLS, CHARGE, FIELD, FIELD_RULES, HAMMERS, PERKS, STAMINA, TICK } from '../src/core/balance'
import { createRun, effectiveHammer, legacyOf, step, summarize, upcomingBills } from '../src/core/sim'
import type { Input, RunState, SimEvent } from '../src/core/types'

function play(
  s: RunState,
  seconds: number,
  at: (s: RunState) => Input[] = () => [],
): SimEvent[] {
  const out: SimEvent[] = []
  const ticks = Math.round(seconds / TICK)
  for (let i = 0; i < ticks && s.over === null; i++) {
    out.push(...step(s, TICK, at(s)))
  }
  return out
}

/** Frappe la premiere tirelire vivante, decalee de `offset` unites. */
function aimFirst(offset = 0) {
  return (s: RunState): Input[] => {
    if (s.t < s.readyAt || s.pressedAt !== null) return []
    const p = s.piggies[0]
    if (!p) return []
    return [{ kind: 'press', x: p.x + offset, y: p.y }, { kind: 'release' }]
  }
}

function fingerprint(s: RunState): string {
  return JSON.stringify([
    s.t.toFixed(6),
    s.cash.toFixed(6),
    s.stamina.toFixed(6),
    s.swings,
    s.breaks,
    s.piggies.map((p) => [p.id, p.kind, p.hp.toFixed(4), p.x.toFixed(6), p.y.toFixed(6)]),
    s.bills.map((b) => [b.id, b.amount, b.dueAt.toFixed(6), b.paidAt, b.seized]),
  ])
}

describe('determinisme', () => {
  it('rejoue a l’identique a graine et entrees egales', () => {
    const a = createRun(12345)
    const b = createRun(12345)
    play(a, 45, aimFirst())
    play(b, 45, aimFirst())
    expect(fingerprint(a)).toBe(fingerprint(b))
    expect(a.swings).toBeGreaterThan(50)
    expect(a.breaks).toBeGreaterThan(3)
  })

  // Controle negatif. La premiere version de ce test visait du sol vide dans
  // les deux cas : les deux runs etaient identiques a bon droit, et le test
  // aurait valide une simulation qui ignore purement et simplement la visee.
  // Il faut donc que la visee decalee touche vraiment autre chose.
  it('diverge des que la visee change', () => {
    const a = createRun(999)
    const b = createRun(999)
    play(a, 30, aimFirst(0))
    play(b, 30, aimFirst(3.5))
    expect(a.breaks).toBeGreaterThan(0)
    expect(b.breaks).not.toBe(a.breaks)
    expect(fingerprint(a)).not.toBe(fingerprint(b))
  })

  it('donne des parties differentes a graines differentes', () => {
    const a = createRun(1)
    const b = createRun(2)
    expect(fingerprint(a)).not.toBe(fingerprint(b))
  })
})

describe('le compromis tap / charge', () => {
  it('la charge est plus econome en stamina, le tap plus rapide — pour les quatre marteaux', () => {
    for (const h of HAMMERS) {
      const tapPerStamina = h.damage / h.tapCost
      const fullDamage = h.damage * (1 + CHARGE.damageMult)
      const fullCost = h.tapCost * (1 + CHARGE.costMult)
      const chargePerStamina = fullDamage / fullCost

      const tapPerSecond = h.damage / h.cooldown
      const chargePerSecond = fullDamage / (h.chargeTime + h.cooldown)

      expect(chargePerStamina, `${h.id}: la charge doit payer par point de main`).toBeGreaterThan(
        tapPerStamina,
      )
      expect(tapPerSecond, `${h.id}: le tap doit payer a la seconde`).toBeGreaterThan(chargePerSecond)
    }
  })

  it('chiffre l’ecart pour le marteau de poche', () => {
    const h = HAMMERS[0]!
    const full = h.damage * (1 + CHARGE.damageMult)
    const cost = h.tapCost * (1 + CHARGE.costMult)
    // +19 % par point de main, -17 % au debit : les deux valeurs annoncees
    // dans balance.ts. Si l'equilibrage bouge, ce test le dit.
    expect(full / cost / (h.damage / h.tapCost)).toBeCloseTo(1.19, 2)
    expect(full / (h.chargeTime + h.cooldown) / (h.damage / h.cooldown)).toBeCloseTo(0.83, 2)
  })

  it('une AoE chargee touche plusieurs tirelires, un tap une seule', () => {
    const s = createRun(4242)
    s.piggies = [0, 0.8, 1.6].map((dx, i) => ({
      id: 100 + i,
      kind: 'classique' as const,
      hp: 1000,
      hpMax: 1000,
      x: dx,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 0.62,
      spawnedAt: 0,
      fleesAt: null,
    }))
    s.aimX = 0
    s.aimY = 0

    const tap = step(s, TICK, [{ kind: 'press', x: 0, y: 0 }, { kind: 'release' }])
    expect(tap.filter((e) => e.kind === 'hit')).toHaveLength(1)

    s.readyAt = 0
    step(s, TICK, [{ kind: 'press', x: 0, y: 0 }])
    play(s, 1.2)
    const charged = step(s, TICK, [{ kind: 'release' }])
    expect(charged.filter((e) => e.kind === 'hit').length).toBeGreaterThanOrEqual(3)
  })
})

describe('les factures', () => {
  it('sont annoncees trois d’avance, toujours', () => {
    const s = createRun(77)
    expect(upcomingBills(s)).toHaveLength(3)
    play(s, 40, aimFirst())
    expect(upcomingBills(s).length).toBeGreaterThanOrEqual(3)
  })

  it('trois saisies terminent la run, et pas une de plus', () => {
    const s = createRun(31)
    play(s, 400)
    expect(s.over).toBe('seized')
    expect(s.seizures).toBe(BILLS.maxSeizures)
    expect(s.staminaLost).toBeCloseTo(STAMINA.base * BILLS.seizureStaminaLoss * BILLS.maxSeizures, 5)
  })

  it('payer ouvre un tirage de trois perks distincts', () => {
    const s = createRun(55)
    s.cash = 10_000
    const bill = upcomingBills(s)[0]!
    const events = step(s, TICK, [{ kind: 'pay', billId: bill.id }])
    const draft = events.find((e) => e.kind === 'draft')
    expect(draft).toBeDefined()
    expect(s.draft).toHaveLength(3)
    expect(new Set(s.draft).size).toBe(3)
    for (const id of s.draft) expect(PERKS.some((p) => p.id === id)).toBe(true)
  })

  it('un perk pris modifie reellement le marteau', () => {
    const s = createRun(56)
    s.cash = 10_000
    step(s, TICK, [{ kind: 'pay', billId: upcomingBills(s)[0]!.id }])
    const before = effectiveHammer(s)
    s.draft = ['poigne']
    step(s, TICK, [{ kind: 'perk', perkId: 'poigne' }])
    expect(effectiveHammer(s).damage).toBeCloseTo(before.damage * 1.28, 6)
    expect(s.draft).toHaveLength(0)
  })

  it('ne laisse pas prendre un perk hors tirage', () => {
    const s = createRun(57)
    const before = effectiveHammer(s).damage
    step(s, TICK, [{ kind: 'perk', perkId: 'poigne' }])
    expect(effectiveHammer(s).damage).toBe(before)
  })
})

describe('le terrain', () => {
  it('ne fait jamais apparaitre une tirelire hors du tapis', () => {
    const s = createRun(808)
    for (let i = 0; i < 12; i++) {
      play(s, 12, aimFirst())
      for (const p of s.piggies) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(FIELD.halfWidth - p.radius + 1e-6)
        expect(Math.abs(p.y)).toBeLessThanOrEqual(FIELD.halfDepth - p.radius + 1e-6)
      }
      if (s.over) break
    }
  })

  it('ne depasse jamais le plafond de tirelires vivantes', () => {
    const s = createRun(909)
    for (let i = 0; i < 3000 && s.over === null; i++) {
      step(s, TICK)
      expect(s.piggies.length).toBeLessThanOrEqual(FIELD_RULES.maxAlive)
    }
  })

  it('un piege coute du cash sans jamais le rendre negatif', () => {
    const s = createRun(1234)
    s.cash = 10
    s.piggies = [
      {
        id: 1,
        kind: 'piege',
        hp: 1,
        hpMax: 8,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 0.55,
        spawnedAt: 0,
        fleesAt: null,
      },
    ]
    const events = step(s, TICK, [{ kind: 'press', x: 0, y: 0 }, { kind: 'release' }])
    const broke = events.find((e) => e.kind === 'break')
    expect(broke).toBeDefined()
    expect(s.cash).toBe(0)
  })
})

describe('le legacy', () => {
  it('recompense la faillite declaree deux fois plus que l’epuisement', () => {
    const s = createRun(5)
    s.totalPaid = 900
    s.t = 100
    // Le plancher s'applique aux deux valeurs : on compare a une unite pres
    // plutot que d'ecrire une egalite que l'arrondi rend fausse une fois sur deux.
    const declared = legacyOf(s, 'declared')
    const exhausted = legacyOf(s, 'exhausted')
    expect(declared).toBeGreaterThanOrEqual(2 * exhausted)
    expect(declared - 2 * exhausted).toBeLessThanOrEqual(1)
  })

  it('bonifie chaque facture payee d’avance', () => {
    const s = createRun(6)
    s.totalPaid = 900
    s.t = 10
    const flat = legacyOf(s, 'declared')
    s.bills = [{ id: 1, label: 'Loyer', amount: 100, dueAt: 40, paidAt: 5, seized: false }]
    expect(legacyOf(s, 'declared')).toBeGreaterThan(flat)
  })

  it('resume une run terminee sans perdre de compteur', () => {
    const s = createRun(11)
    play(s, 400)
    const sum = summarize(s)
    expect(sum.reason).toBe(s.over)
    expect(sum.swings).toBe(s.swings)
    expect(sum.duration).toBeCloseTo(s.t, 6)
    expect(sum.legacy).toBe(legacyOf(s, s.over!))
  })
})
