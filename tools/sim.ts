/**
 * Simulateur headless. Ce qui n'est pas mesure est decoratif : cet outil
 * est ce qui autorise a affirmer quoi que ce soit sur l'equilibrage.
 *
 *   npm run sim                      campagne complete (3 politiques x 4 marteaux)
 *   npm run sim -- --runs 2000       taille d'echantillon
 *   npm run sim -- --json out.json   sortie machine
 *   npm run sim -- --sweep           balaye l'arbitrage temps/stamina du bot
 */
import { writeFileSync } from 'node:fs'
import { HAMMERS, TICK } from '../src/core/balance'
import { DEFAULT_BOT, TIME_WEIGHT, botInputs, createBotMemory, type Policy } from '../src/core/bot'
import { createRun, step, summarize } from '../src/core/sim'
import type { RunSummary } from '../src/core/types'

const POLICIES: readonly Policy[] = ['tap', 'charge', 'adaptive']
const MAX_SECONDS = 600

interface Args {
  runs: number
  seed: number
  json: string | null
  policy: Policy | null
  hammer: string | null
  sweep: boolean
}

/** Poids explores : combien de stamina vaut une seconde de jeu. */
const SWEEP_WEIGHTS = [0.25, 0.5, 1, 2, 4, 8] as const

function parseArgs(argv: readonly string[]): Args {
  const a: Args = { runs: 400, seed: 1, json: null, policy: null, hammer: null, sweep: false }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    const v = argv[i + 1]
    if (k === '--runs' && v) { a.runs = Number(v); i++ }
    else if (k === '--seed' && v) { a.seed = Number(v); i++ }
    else if (k === '--json' && v) { a.json = v; i++ }
    else if (k === '--policy' && v) { a.policy = v as Policy; i++ }
    else if (k === '--hammer' && v) { a.hammer = v; i++ }
    else if (k === '--sweep') { a.sweep = true }
  }
  return a
}

function playOne(seed: number, hammerId: string, policy: Policy, timeWeight?: number): RunSummary {
  const s = createRun(seed, hammerId)
  const mem = createBotMemory()
  const cfg = { ...DEFAULT_BOT, policy, timeWeight: timeWeight ?? TIME_WEIGHT[hammerId] ?? DEFAULT_BOT.timeWeight }
  const maxTicks = Math.ceil(MAX_SECONDS / TICK)
  for (let i = 0; i < maxTicks && s.over === null; i++) {
    step(s, TICK, botInputs(s, mem, cfg))
  }
  return summarize(s)
}

interface Stats {
  n: number
  mean: number
  p10: number
  p50: number
  p90: number
}

function stats(values: readonly number[]): Stats {
  const v = [...values].sort((a, b) => a - b)
  const q = (p: number) => v[Math.min(v.length - 1, Math.max(0, Math.floor(p * v.length)))] ?? 0
  return {
    n: v.length,
    mean: v.reduce((a, b) => a + b, 0) / (v.length || 1),
    p10: q(0.1),
    p50: q(0.5),
    p90: q(0.9),
  }
}

interface Cell {
  hammer: string
  policy: Policy
  legacy: Stats
  duration: Stats
  billsPaid: Stats
  seizures: Stats
  /** Repartition des fins de run : declaree / saisie / epuisee. */
  declaredRate: number
  seizedRate: number
  exhaustedRate: number
  /** Part des degats gaspilles en surcharge. */
  overkillRate: number
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length)
}
function padLeft(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s
}
function fmt(x: number, d = 1): string {
  return x.toFixed(d)
}

/**
 * Balayage de `timeWeight` : le taux de change entre une seconde et un point
 * de stamina. Le fixer au doigt mouille reviendrait a decider a la place du
 * joueur ; le balayer dit ou se trouve reellement l'optimum, marteau par marteau.
 */
function sweep(args: Args): void {
  const hammers = args.hammer ? HAMMERS.filter((h) => h.id === args.hammer) : HAMMERS
  console.log('')
  console.log(`OVERDRAFT — balayage temps/stamina, ${args.runs} runs par case`)
  console.log('')
  console.log(pad('marteau', 10) + SWEEP_WEIGHTS.map((w) => padLeft('w=' + w, 9)).join(''))
  console.log('-'.repeat(10 + SWEEP_WEIGHTS.length * 9))
  for (const h of hammers) {
    const means = SWEEP_WEIGHTS.map((w) => {
      const v: number[] = []
      for (let i = 0; i < args.runs; i++) v.push(playOne(args.seed + i, h.id, 'adaptive', w).legacy)
      return stats(v).p50
    })
    const best = Math.max(...means)
    console.log(
      pad(h.id, 10) +
        means.map((m) => padLeft(fmt(m, 0) + (m === best ? '*' : ' '), 9)).join(''),
    )
  }
  console.log('')
  console.log('* optimum par marteau. Un optimum plat signalerait un arbitrage sans effet.')
  console.log('')
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  if (args.sweep) return sweep(args)
  const hammers = args.hammer ? HAMMERS.filter((h) => h.id === args.hammer) : HAMMERS
  const policies = args.policy ? [args.policy] : POLICIES

  const started = Date.now()
  const cells: Cell[] = []
  for (const h of hammers) {
    for (const policy of policies) {
      const runs: RunSummary[] = []
      for (let i = 0; i < args.runs; i++) {
        runs.push(playOne(args.seed + i, h.id, policy))
      }
      cells.push({
        hammer: h.id,
        policy,
        legacy: stats(runs.map((r) => r.legacy)),
        duration: stats(runs.map((r) => r.duration)),
        billsPaid: stats(runs.map((r) => r.billsPaid)),
        seizures: stats(runs.map((r) => r.seizures)),
        declaredRate: runs.filter((r) => r.reason === 'declared').length / runs.length,
        seizedRate: runs.filter((r) => r.reason === 'seized').length / runs.length,
        exhaustedRate: runs.filter((r) => r.reason === 'exhausted').length / runs.length,
        overkillRate:
          runs.reduce((a, r) => a + r.overkill, 0) /
          Math.max(1, runs.reduce((a, r) => a + r.overkill + r.totalPaid, 0)),
      })
    }
  }
  const elapsed = (Date.now() - started) / 1000

  const total = cells.length * args.runs
  console.log('')
  console.log(`OVERDRAFT — campagne de ${total} runs simulees en ${fmt(elapsed, 1)}s`)
  console.log('')
  console.log(
    pad('marteau', 10) + pad('politique', 11) +
    padLeft('median', 8) + padLeft('p10', 7) + padLeft('p90', 7) + padLeft('moy', 8) +
    padLeft('duree', 8) + padLeft('factures', 10) + padLeft('declare', 9) + padLeft('saisie', 8) + padLeft('epuise', 8),
  )
  console.log('-'.repeat(94))
  for (const c of cells) {
    console.log(
      pad(c.hammer, 10) + pad(c.policy, 11) +
      padLeft(fmt(c.legacy.p50, 0), 8) + padLeft(fmt(c.legacy.p10, 0), 7) + padLeft(fmt(c.legacy.p90, 0), 7) +
      padLeft(fmt(c.legacy.mean, 0), 8) +
      padLeft(fmt(c.duration.mean) + 's', 8) + padLeft(fmt(c.billsPaid.mean), 10) +
      padLeft(fmt(c.declaredRate * 100, 0) + '%', 9) +
      padLeft(fmt(c.seizedRate * 100, 0) + '%', 8) +
      padLeft(fmt(c.exhaustedRate * 100, 0) + '%', 8),
    )
  }
  console.log('')

  // La mediane, pas la moyenne : la distribution du legacy est a queue
  // lourde (p90 vaut 20 a 30 fois p10). Une moyenne sur quelques dizaines de
  // runs y mesure surtout la chance d'avoir tire un jackpot.
  for (const h of hammers) {
    const row = cells.filter((c) => c.hammer === h.id)
    const best = row.reduce((a, b) => (b.legacy.p50 > a.legacy.p50 ? b : a))
    const tap = row.find((c) => c.policy === 'tap')
    const charge = row.find((c) => c.policy === 'charge')
    if (tap && charge) {
      const gap = ((tap.legacy.p50 - charge.legacy.p50) / Math.max(1, charge.legacy.p50)) * 100
      console.log(
        `${pad(h.name, 22)} meilleure: ${pad(best.policy, 10)} ` +
        `tap vs charge: ${gap >= 0 ? '+' : ''}${fmt(gap, 0)}%`,
      )
    }
  }
  console.log('')

  if (args.json) {
    writeFileSync(args.json, JSON.stringify({ runs: args.runs, seed: args.seed, cells }, null, 2), 'utf8')
    console.log(`-> ${args.json}`)
  }
}

main()
