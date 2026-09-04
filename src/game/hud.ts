import { BILLS, HAMMERS, PERKS, STAMINA } from '../core/balance'
import { legacyOf, perk, staminaMax, upcomingBills } from '../core/sim'
import type { RunState, RunSummary } from '../core/types'

const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (html !== undefined) n.innerHTML = html
  return n
}

export interface HudHandlers {
  onPay: (billId: number) => void
  onDeclare: () => void
  onPerk: (perkId: string) => void
  onStart: (hammerId: string) => void
}

export class Hud {
  readonly root = el('div', 'hud')

  private readonly cashValue = el('span')
  private readonly gauge = el('div', 'gauge')
  private readonly gaugeFill = el('div', 'gauge-fill')
  private readonly gaugeLost = el('div', 'gauge-lost')
  private readonly gaugeText = el('span')
  private readonly pips: HTMLElement[] = []
  private readonly billList = el('div')
  private readonly perkStrip = el('div', 'perks')
  private readonly declareBtn = el('button', 'declare')
  private readonly overlay = el('div', 'overlay')
  private readonly floats = el('div')

  private billNodes = new Map<number, { root: HTMLElement; bar: HTMLElement; amount: HTMLElement }>()

  private readonly h: HudHandlers

  constructor(host: HTMLElement, handlers: HudHandlers) {
    this.h = handlers
    const top = el('div', 'top')
    const cash = el('div', 'cash')
    cash.append(this.cashValue, el('small', undefined, 'EN POCHE'))

    const label = el('div', 'gauge-label')
    label.append(el('span', undefined, 'MAIN'), this.gaugeText)
    const track = el('div', 'gauge-track')
    track.append(this.gaugeFill, this.gaugeLost)
    this.gauge.append(label, track)

    const seiz = el('div', 'seizures')
    seiz.append(el('span', undefined, 'SAISIES'))
    for (let i = 0; i < BILLS.maxSeizures; i++) {
      const pip = el('span', 'pip')
      this.pips.push(pip)
      seiz.append(pip)
    }

    top.append(cash, this.gauge, seiz)

    const bills = el('div', 'bills')
    bills.append(el('div', 'bills-title', 'ECHEANCIER'), this.billList)
    this.billList.style.display = 'flex'
    this.billList.style.flexDirection = 'column'
    this.billList.style.gap = '8px'

    this.declareBtn.innerHTML = 'DECLARER FAILLITE<small>rendement : <b>0</b> legacy</small>'
    this.declareBtn.addEventListener('click', () => this.h.onDeclare())

    const bottom = el('div', 'bottom')
    bottom.append(this.perkStrip, this.declareBtn)

    this.root.append(top, bills, bottom, this.floats, this.overlay)
    host.append(this.root)
  }

  // ---- boucle ----

  sync(s: RunState): void {
    this.cashValue.textContent = money.format(Math.floor(s.cash))

    const max = staminaMax(s)
    const pct = Math.max(0, (s.stamina / STAMINA.base) * 100)
    const lostPct = (s.staminaLost / STAMINA.base) * 100
    this.gaugeFill.style.width = `${pct}%`
    this.gaugeLost.style.width = `${lostPct}%`
    this.gauge.classList.toggle('low', s.stamina / Math.max(1, max) < 0.25)
    this.gaugeText.textContent = `${Math.ceil(s.stamina)} / ${Math.round(max)}`

    this.pips.forEach((p, i) => p.classList.toggle('on', i < s.seizures))

    this.syncBills(s)

    const counts = new Map<string, number>()
    for (const id of s.perks) counts.set(id, (counts.get(id) ?? 0) + 1)
    if (this.perkStrip.childElementCount !== counts.size) {
      this.perkStrip.replaceChildren()
      for (const [id, n] of counts) {
        const spec = perk(id)
        if (!spec) continue
        this.perkStrip.append(
          el('span', 'perk-chip', `<b>${spec.name}</b>${n > 1 ? ` ×${n}` : ''}`),
        )
      }
    }

    const gain = legacyOf(s, 'declared')
    const b = this.declareBtn.querySelector('b')
    if (b) b.textContent = String(gain)
  }

  private syncBills(s: RunState): void {
    const list = upcomingBills(s).slice(0, 3)
    const ids = new Set(list.map((b) => b.id))
    for (const [id, node] of this.billNodes) {
      if (!ids.has(id)) {
        node.root.remove()
        this.billNodes.delete(id)
      }
    }
    for (const bill of list) {
      let node = this.billNodes.get(bill.id)
      if (!node) {
        const root = el('div', 'bill')
        const head = el('div', 'bill-head')
        const amount = el('span', 'bill-amount', money.format(bill.amount))
        head.append(el('span', 'bill-label', bill.label), amount)
        const bar = el('span')
        const barBox = el('div', 'bill-bar')
        barBox.append(bar)
        root.append(head, barBox, el('div', 'bill-hint', 'clic pour payer'))
        root.addEventListener('click', () => this.h.onPay(bill.id))
        this.billList.append(root)
        node = { root, bar, amount }
        this.billNodes.set(bill.id, node)
      }
      const left = bill.dueAt - s.t
      const window = 24
      node.bar.style.width = `${Math.max(0, Math.min(100, (left / window) * 100))}%`
      node.root.classList.toggle('urgent', left < 6)
      node.root.classList.toggle('soon', left >= 6 && left < 13)
      node.root.classList.toggle('payable', s.cash >= bill.amount)
    }
    // L'echeancier se lit de haut en bas : la plus proche d'abord.
    for (const bill of list) {
      const node = this.billNodes.get(bill.id)
      if (node) this.billList.append(node.root)
    }
  }

  // ---- retours immediats ----

  float(x: number, y: number, text: string, color: string): void {
    const n = el('div', 'float', text)
    n.style.left = `${x}px`
    n.style.top = `${y}px`
    n.style.color = color
    this.floats.append(n)
    setTimeout(() => n.remove(), 950)
  }

  toast(text: string): void {
    const n = el('div', 'toast', text)
    this.floats.append(n)
    setTimeout(() => n.remove(), 2500)
  }

  // ---- overlays ----

  hideOverlay(): void {
    this.overlay.classList.add('hidden')
    this.overlay.replaceChildren()
  }

  private showOverlay(...nodes: (HTMLElement | string)[]): void {
    this.overlay.classList.remove('hidden')
    this.overlay.replaceChildren(...nodes)
  }

  showStart(totalLegacy: number, best: number): void {
    const cards = el('div', 'cards')
    for (const h of HAMMERS) {
      const card = el('div', 'card')
      card.append(
        el('b', undefined, h.name),
        el('span', undefined, h.blurb),
        el(
          'em',
          undefined,
          `${h.damage} dgts · tap ${h.tapCost} sta · charge ${h.chargeTime.toFixed(2)}s · rayon ${h.radiusMax}`,
        ),
      )
      card.addEventListener('click', () => this.h.onStart(h.id))
      cards.append(card)
    }
    this.showOverlay(
      el('h1', undefined, 'OVERDRAFT'),
      el('h2', undefined, 'LES FACTURES, ELLES, N’ATTENDENT PAS'),
      el(
        'p',
        undefined,
        'Maintiens pour charger, relache pour frapper. Un tap coute peu de main et sort vite ; ' +
          'une charge pleine coute plus cher mais rend plus par point de main, et ratisse large. ' +
          'Chaque facture payee ouvre un choix de trois perks. ' +
          'Quand tu declares faillite, tu gardes le legacy — si tu attends l’epuisement, tu n’en gardes que la moitie.',
      ),
      cards,
      el(
        'p',
        undefined,
        totalLegacy > 0
          ? `Legacy accumule : <b style="color:var(--gold)">${totalLegacy}</b> · meilleure run : <b>${best}</b>`
          : 'Choisis un marteau pour commencer.',
      ),
    )
  }

  showDraft(options: readonly string[]): void {
    const cards = el('div', 'cards')
    for (const id of options) {
      const spec = PERKS.find((p) => p.id === id)
      if (!spec) continue
      const card = el('div', 'card')
      card.append(el('b', undefined, spec.name), el('span', undefined, spec.text))
      card.addEventListener('click', () => this.h.onPerk(id))
      cards.append(card)
    }
    this.showOverlay(
      el('h2', undefined, 'FACTURE PAYEE — PRENDS QUELQUE CHOSE'),
      cards,
      el('p', undefined, 'Le temps ne passe pas pendant que tu choisis.'),
    )
  }

  showEnd(sum: RunSummary, totalLegacy: number, isBest: boolean): void {
    const why =
      sum.reason === 'declared'
        ? 'Tu as pose le marteau au bon moment.'
        : sum.reason === 'seized'
          ? 'Trois saisies. L’huissier a pris le reste.'
          : 'La main a lache. Moitie de legacy seulement.'

    const stats = el('div', 'stats')
    const cell = (v: string, k: string, cls?: string) => {
      const d = el('div', cls)
      d.append(el('b', undefined, v), el('span', undefined, k))
      return d
    }
    stats.append(
      cell(String(sum.billsPaid), 'FACTURES'),
      cell(`${Math.round(sum.duration)}s`, 'DUREE'),
      cell(String(sum.breaks), 'TIRELIRES'),
      cell(String(sum.legacy), 'LEGACY', 'legacy'),
    )

    const again = el('button', 'primary', 'RECOMMENCER')
    again.addEventListener('click', () => this.h.onStart(''))

    this.showOverlay(
      el('h1', undefined, sum.reason === 'declared' ? 'FAILLITE' : 'FIN DE RUN'),
      el('h2', undefined, why),
      stats,
      el(
        'p',
        undefined,
        `Legacy total : <b style="color:var(--gold)">${totalLegacy}</b>${isBest ? ' · nouveau record' : ''}`,
      ),
      again,
    )
  }
}
