import './style.css'
import { PIGGIES, TICK } from '../core/balance'
import { chargeOf, createRun, effectiveHammer, step, summarize, swingRadius } from '../core/sim'
import type { Input, RunState, SimEvent } from '../core/types'
import { Hud } from './hud'
import { View } from './view'

const STORE = 'overdraft.meta.v1'

interface Meta {
  legacy: number
  best: number
  runs: number
  lastHammer: string
}

function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(STORE)
    if (raw) return { legacy: 0, best: 0, runs: 0, lastHammer: 'poche', ...JSON.parse(raw) }
  } catch {
    // Un stockage refuse (navigation privee, site data bloque) ne doit pas
    // empecher de jouer : on repart d'un meta vierge.
  }
  return { legacy: 0, best: 0, runs: 0, lastHammer: 'poche' }
}

function saveMeta(m: Meta): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(m))
  } catch {
    /* idem */
  }
}

const host = document.getElementById('app')
if (!host) throw new Error('#app introuvable')

const view = new View(host)
let meta = loadMeta()
let run: RunState | null = null
let paused = true
let pending: Input[] = []
let acc = 0
let last = performance.now()

const hud = new Hud(host, {
  onPay: (billId) => pending.push({ kind: 'pay', billId }),
  onDeclare: () => pending.push({ kind: 'declare' }),
  onPerk: (perkId) => {
    pending.push({ kind: 'perk', perkId })
    paused = false
    hud.hideOverlay()
  },
  onStart: (hammerId) => start(hammerId || meta.lastHammer),
})

function start(hammerId: string): void {
  meta.lastHammer = hammerId
  saveMeta(meta)
  run = createRun((Math.random() * 2 ** 31) >>> 0, hammerId)
  pending = []
  acc = 0
  paused = false
  hud.hideOverlay()
}

// ---- entrees ----

const canvas = view.renderer.domElement

function aimAt(e: PointerEvent): { x: number; y: number } | null {
  return view.pick(e.clientX, e.clientY)
}

canvas.addEventListener('pointermove', (e) => {
  const p = aimAt(e)
  if (p && run && !paused) pending.push({ kind: 'aim', x: p.x, y: p.y })
})

canvas.addEventListener('pointerdown', (e) => {
  const p = aimAt(e)
  if (!p || !run || paused) return
  canvas.setPointerCapture(e.pointerId)
  pending.push({ kind: 'press', x: p.x, y: p.y })
})

addEventListener('pointerup', () => {
  if (run && !paused) pending.push({ kind: 'release' })
})

addEventListener('keydown', (e) => {
  if (!run || paused) return
  if (e.code === 'Space') {
    e.preventDefault()
    pending.push({ kind: 'press', x: run.aimX, y: run.aimY })
  }
  // 1-3 : payer la n-ieme echeance sans lacher la souris.
  const n = Number(e.key)
  if (n >= 1 && n <= 3) {
    const bills = run.bills.filter((b) => b.paidAt === null && !b.seized).sort((a, b) => a.dueAt - b.dueAt)
    const bill = bills[n - 1]
    if (bill) pending.push({ kind: 'pay', billId: bill.id })
  }
})

addEventListener('keyup', (e) => {
  if (e.code === 'Space' && run && !paused) pending.push({ kind: 'release' })
})

// ---- boucle ----

function frame(now: number): void {
  requestAnimationFrame(frame)
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now

  if (run) {
    if (!paused) {
      acc += dt
      // Le garde-fou evite la spirale de la mort apres un onglet en arriere-plan :
      // on jette le temps en trop plutot que de rattraper 30 s de simulation.
      let guard = 0
      while (acc >= TICK && guard++ < 240 && run.over === null && !paused) {
        acc -= TICK
        const inputs = pending
        pending = []
        drain(run, step(run, TICK, inputs))
      }
      if (guard >= 240) acc = 0
    }
    hud.sync(run)
    const h = effectiveHammer(run)
    const c = chargeOf(run)
    view.render(run, c, swingRadius(h, c), dt)
  } else {
    view.render(emptyState(), 0, 0, dt)
  }
}

let empty: RunState | null = null
function emptyState(): RunState {
  empty ??= createRun(7)
  return empty
}

function drain(s: RunState, events: readonly SimEvent[]): void {
  for (const e of events) {
    switch (e.kind) {
      case 'swing':
        if (e.charge > 0.35) view.kick(0.04 + e.charge * 0.12)
        break
      case 'hit': {
        view.markHit(e.piggyId)
        if (e.crit) {
          const p = view.worldToScreen(e.x, e.y)
          hud.float(p.x, p.y, 'CRIT', '#ffd45e')
        }
        break
      }
      case 'break': {
        view.burst(e.x, e.y, e.piggyKind, e.piggyKind === 'chene' ? 22 : 14, e.piggyKind === 'chene' ? 1.3 : 1)
        view.kick(PIGGIES[e.piggyKind].hp > 90 ? 0.16 : 0.05)
        const p = view.worldToScreen(e.x, e.y)
        if (e.penalty > 0) hud.float(p.x, p.y, `-${e.penalty}`, '#fb7185')
        else hud.float(p.x, p.y, `+${Math.round(e.payout)}`, e.piggyKind === 'jackpot' ? '#ffd45e' : '#34d399')
        break
      }
      case 'billPaid':
        hud.toast(`${Math.round(e.amount)} payes`)
        break
      case 'draft':
        paused = true
        hud.showDraft(e.options)
        break
      case 'seizure':
        hud.toast(`SAISIE — main -${Math.round(e.staminaLost)}`)
        view.kick(0.3)
        break
      case 'over': {
        const sum = summarize(s)
        const isBest = sum.legacy > meta.best
        meta = { ...meta, legacy: meta.legacy + sum.legacy, best: Math.max(meta.best, sum.legacy), runs: meta.runs + 1 }
        saveMeta(meta)
        paused = true
        hud.showEnd(sum, meta.legacy, isBest)
        break
      }
      default:
        break
    }
  }
}

if (import.meta.env.DEV) {
  // Poignee de debug : inspecter la camera et l'etat de run depuis la console
  // sans avoir a instrumenter le jeu a chaque fois.
  ;(globalThis as unknown as Record<string, unknown>)['__overdraft'] = {
    view,
    get run() {
      return run
    },
    start,
    /**
     * Avance la simulation de `seconds` sans dependre de requestAnimationFrame,
     * qui est gele des que l'onglet passe en arriere-plan. Sert a verifier le
     * cablage entrees -> simulation depuis la console ou un test.
     */
    pump(seconds: number) {
      if (!run) return null
      const ticks = Math.round(seconds / TICK)
      for (let i = 0; i < ticks && run.over === null; i++) {
        const inputs = pending
        pending = []
        drain(run, step(run, TICK, inputs))
      }
      return run
    },
  }
}

hud.showStart(meta.legacy, meta.best)
requestAnimationFrame(frame)
