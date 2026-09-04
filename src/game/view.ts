import * as THREE from 'three'
import { FIELD, type PiggyKind } from '../core/balance'
import type { Piggy, RunState } from '../core/types'

const SKIN: Record<PiggyKind, { body: number; trim: number; rough: number; metal: number }> = {
  classique: { body: 0xf2789a, trim: 0xffc2d4, rough: 0.55, metal: 0 },
  ballon: { body: 0x7dd3fc, trim: 0xdff3ff, rough: 0.25, metal: 0 },
  chene: { body: 0xa97142, trim: 0x6f4522, rough: 0.85, metal: 0 },
  grelot: { body: 0xfbbf24, trim: 0xfff0c2, rough: 0.35, metal: 0.35 },
  jackpot: { body: 0xffd45e, trim: 0xfff6d8, rough: 0.2, metal: 0.85 },
  piege: { body: 0x8b1d2c, trim: 0x2b0d12, rough: 0.7, metal: 0.1 },
}

interface Visual {
  group: THREE.Group
  /** Position au sol de la tirelire : ce que la simulation, elle, connait. */
  ground: { x: number; y: number }
  body: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>
  /** Instant du dernier coup encaisse, pour le flash et le recul. */
  hitAt: number
  spin: number
}

interface Shard {
  mesh: THREE.Mesh
  vx: number
  vy: number
  vz: number
  spin: THREE.Vector3
  life: number
}

const SHARD_POOL = 220
const UP = new THREE.Vector3(0, 1, 0)

export class View {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera

  private readonly visuals = new Map<number, Visual>()
  private readonly shards: Shard[] = []
  private readonly ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  private readonly aimDot: THREE.Mesh
  private readonly plane = new THREE.Plane(UP, 0)
  private readonly ray = new THREE.Raycaster()
  private readonly ndc = new THREE.Vector2()
  private readonly hitPoint = new THREE.Vector3()

  private shake = 0
  private clock = 0
  private readonly host: HTMLElement

  constructor(host: HTMLElement) {
    this.host = host
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    host.appendChild(this.renderer.domElement)

    this.scene.background = new THREE.Color(0x0b0c10)
    this.scene.fog = new THREE.Fog(0x0b0c10, 22, 40)

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120)
    this.camera.position.set(0, 12.4, 10.6)
    this.camera.lookAt(0, 0, -0.4)

    this.scene.add(new THREE.HemisphereLight(0x9fb6ff, 0x1a1420, 0.85))
    const key = new THREE.DirectionalLight(0xfff1d6, 2.1)
    key.position.set(6, 13, 7)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -12
    key.shadow.camera.right = 12
    key.shadow.camera.top = 9
    key.shadow.camera.bottom = -9
    key.shadow.bias = -0.0012
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0x6f8cff, 0.8)
    rim.position.set(-8, 5, -8)
    this.scene.add(rim)

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 34),
      new THREE.MeshStandardMaterial({ color: 0x14161f, roughness: 0.95, metalness: 0 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)

    // Le tapis delimite le terrain : sans bord visible, on ne sait pas ou une
    // tirelire peut apparaitre, et viser devient de la devinette.
    const mat = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD.halfWidth * 2 + 1.2, FIELD.halfDepth * 2 + 1.2),
      new THREE.MeshStandardMaterial({ color: 0x1c2030, roughness: 0.85 }),
    )
    mat.rotation.x = -Math.PI / 2
    mat.position.y = 0.01
    mat.receiveShadow = true
    this.scene.add(mat)

    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(
        new THREE.PlaneGeometry(FIELD.halfWidth * 2 + 1.2, FIELD.halfDepth * 2 + 1.2),
      ),
      new THREE.LineBasicMaterial({ color: 0x3a4260 }),
    )
    edge.rotation.x = -Math.PI / 2
    edge.position.y = 0.02
    this.scene.add(edge)

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 1, 64),
      new THREE.MeshBasicMaterial({ color: 0xffd45e, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    )
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.y = 0.05
    this.scene.add(this.ring)

    this.aimDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
    )
    this.aimDot.rotation.x = -Math.PI / 2
    this.aimDot.position.y = 0.04
    this.scene.add(this.aimDot)

    const shardGeo = new THREE.TetrahedronGeometry(0.13)
    for (let i = 0; i < SHARD_POOL; i++) {
      const m = new THREE.Mesh(shardGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }))
      m.visible = false
      m.castShadow = true
      this.scene.add(m)
      this.shards.push({ mesh: m, vx: 0, vy: 0, vz: 0, spin: new THREE.Vector3(), life: 0 })
    }

    this.resize()
    addEventListener('resize', () => this.resize())
  }

  resize(): void {
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / Math.max(1, h)
    this.camera.updateProjectionMatrix()
  }

  /**
   * Ecran -> coordonnee de simulation.
   *
   * Le corps d'une tirelire est dessine ~0,6 unite au-dessus de sa position
   * au sol : viser le plan du sol sous le curseur ratait la tirelire sur
   * laquelle le joueur venait de cliquer, d'autant plus surement que le
   * marteau a un rayon nul. On teste donc d'abord les maillages, et on ne
   * retombe sur le sol que quand le curseur ne designe aucune tirelire.
   */
  pick(clientX: number, clientY: number): { x: number; y: number } | null {
    const r = this.renderer.domElement.getBoundingClientRect()
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
    this.ray.setFromCamera(this.ndc, this.camera)

    let nearest: { d: number; g: { x: number; y: number } } | null = null
    for (const v of this.visuals.values()) {
      const hits = this.ray.intersectObject(v.group, true)
      const hit = hits[0]
      if (hit && (nearest === null || hit.distance < nearest.d)) {
        nearest = { d: hit.distance, g: v.ground }
      }
    }
    if (nearest) return { x: nearest.g.x, y: nearest.g.y }

    if (!this.ray.ray.intersectPlane(this.plane, this.hitPoint)) return null
    return { x: this.hitPoint.x, y: this.hitPoint.z }
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, 0.7, y).project(this.camera)
    const r = this.renderer.domElement.getBoundingClientRect()
    return { x: ((v.x + 1) / 2) * r.width + r.left, y: ((1 - v.y) / 2) * r.height + r.top }
  }

  private build(p: Piggy): Visual {
    const skin = SKIN[p.kind]
    const group = new THREE.Group()

    const bodyMat = new THREE.MeshStandardMaterial({
      color: skin.body,
      roughness: skin.rough,
      metalness: skin.metal,
      emissive: p.kind === 'jackpot' ? 0x5a3d00 : 0x000000,
    })
    const body = new THREE.Mesh(new THREE.SphereGeometry(p.radius, 28, 20), bodyMat)
    body.scale.set(1.18, 0.92, 1)
    body.castShadow = true
    group.add(body)

    const trim = new THREE.MeshStandardMaterial({ color: skin.trim, roughness: 0.5, metalness: skin.metal })
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(p.radius * 0.34, p.radius * 0.34, p.radius * 0.3, 18), trim)
    snout.rotation.x = Math.PI / 2
    snout.position.set(0, 0, p.radius * 0.98)
    snout.castShadow = true
    group.add(snout)

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(p.radius * 0.24, p.radius * 0.42, 4), trim)
      ear.position.set(side * p.radius * 0.42, p.radius * 0.72, p.radius * 0.24)
      ear.castShadow = true
      group.add(ear)
    }

    // La fente : c'est une tirelire, ca doit se voir en un coup d'oeil.
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(p.radius * 0.62, 0.03, p.radius * 0.16),
      new THREE.MeshStandardMaterial({ color: 0x1b1b22, roughness: 0.9 }),
    )
    slot.position.y = p.radius * 0.88
    group.add(slot)

    if (p.kind === 'piege') {
      // Les pieges portent leurs pointes : la lecture du terrain doit etre
      // instantanee, sinon l'AoE devient une punition arbitraire.
      const spikeMat = new THREE.MeshStandardMaterial({ color: 0x2b0d12, roughness: 0.6 })
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 5), spikeMat)
        spike.position.set(Math.cos(a) * p.radius * 0.85, p.radius * 0.5, Math.sin(a) * p.radius * 0.85)
        spike.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5)
        spike.castShadow = true
        group.add(spike)
      }
    }

    if (p.kind === 'jackpot') {
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(p.radius * 1.25, p.radius * 1.45, 40),
        new THREE.MeshBasicMaterial({ color: 0xffd45e, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
      )
      halo.rotation.x = -Math.PI / 2
      halo.position.y = 0.05
      group.add(halo)
    }

    group.position.set(p.x, p.radius * 0.92, p.y)
    this.scene.add(group)
    return { group, body, ground: { x: p.x, y: p.y }, hitAt: -9, spin: Math.random() * Math.PI * 2 }
  }

  private takeShard(): Shard | null {
    for (const s of this.shards) if (s.life <= 0) return s
    return null
  }

  burst(x: number, y: number, kind: PiggyKind, count: number, power: number): void {
    const color = SKIN[kind].body
    for (let i = 0; i < count; i++) {
      const s = this.takeShard()
      if (!s) return
      const a = Math.random() * Math.PI * 2
      const speed = (1.6 + Math.random() * 3.4) * power
      s.vx = Math.cos(a) * speed
      s.vz = Math.sin(a) * speed
      s.vy = 3.2 + Math.random() * 4.6 * power
      s.spin.set(Math.random() * 9 - 4.5, Math.random() * 9 - 4.5, Math.random() * 9 - 4.5)
      s.life = 0.85 + Math.random() * 0.5
      s.mesh.position.set(x, 0.55, y)
      s.mesh.scale.setScalar(0.7 + Math.random() * 0.9)
      s.mesh.visible = true
      ;(s.mesh.material as THREE.MeshStandardMaterial).color.setHex(color)
    }
  }

  markHit(piggyId: number): void {
    const v = this.visuals.get(piggyId)
    if (v) v.hitAt = this.clock
  }

  kick(amount: number): void {
    this.shake = Math.min(0.5, this.shake + amount)
  }

  render(s: RunState, charge: number, radius: number, dt: number): void {
    this.clock += dt

    const seen = new Set<number>()
    for (const p of s.piggies) {
      seen.add(p.id)
      let v = this.visuals.get(p.id)
      if (!v) {
        v = this.build(p)
        this.visuals.set(p.id, v)
        v.group.scale.setScalar(0.01)
      }
      v.group.position.x = p.x
      v.group.position.z = p.y
      v.ground.x = p.x
      v.ground.y = p.y
      // Apparition : la tirelire grossit en un sixieme de seconde plutot que
      // de surgir — sinon on ne voit pas d'ou vient une nouvelle cible.
      v.group.scale.setScalar(Math.min(1, v.group.scale.x + dt * 7))

      // La sante se lit sur la silhouette : elle s'aplatit et fonce en cassant.
      const hurt = 1 - p.hp / p.hpMax
      v.body.scale.set(1.18 + hurt * 0.16, 0.92 - hurt * 0.22, 1 + hurt * 0.06)
      const since = this.clock - v.hitAt
      const flash = since < 0.09 ? 1 - since / 0.09 : 0
      v.body.material.emissive.setRGB(flash * 0.9, flash * 0.75, flash * 0.55)
      v.group.position.y = p.radius * 0.92 + Math.sin(this.clock * 2.1 + v.spin) * 0.035 + flash * 0.16

      if (p.fleesAt !== null) {
        const left = (p.fleesAt - s.t) / 9
        v.group.rotation.y = Math.sin(this.clock * 9) * 0.22 * (1 - left)
      }
    }
    for (const [id, v] of this.visuals) {
      if (seen.has(id)) continue
      this.scene.remove(v.group)
      v.group.traverse((o: THREE.Object3D) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose()
      })
      this.visuals.delete(id)
    }

    // Curseur et anneau de charge.
    this.aimDot.position.set(s.aimX, 0.04, s.aimY)
    const showRing = charge > 0.02 || radius > 0.05
    this.ring.visible = showRing
    if (showRing) {
      const r = Math.max(0.18, radius)
      this.ring.scale.setScalar(r)
      this.ring.position.set(s.aimX, 0.05, s.aimY)
      this.ring.material.opacity = 0.28 + charge * 0.62
      this.ring.material.color.setHSL(0.13 - charge * 0.13, 0.95, 0.5 + charge * 0.12)
    }

    for (const sh of this.shards) {
      if (sh.life <= 0) continue
      sh.life -= dt
      if (sh.life <= 0) {
        sh.mesh.visible = false
        continue
      }
      sh.vy -= 22 * dt
      sh.mesh.position.x += sh.vx * dt
      sh.mesh.position.y += sh.vy * dt
      sh.mesh.position.z += sh.vz * dt
      if (sh.mesh.position.y < 0.1) {
        sh.mesh.position.y = 0.1
        sh.vy *= -0.36
        sh.vx *= 0.7
        sh.vz *= 0.7
      }
      sh.mesh.rotation.x += sh.spin.x * dt
      sh.mesh.rotation.y += sh.spin.y * dt
      sh.mesh.rotation.z += sh.spin.z * dt
    }

    if (this.shake > 0.001) {
      this.shake *= Math.pow(0.0015, dt)
      this.camera.position.x = (Math.random() - 0.5) * this.shake
      this.camera.position.y = 12.4 + (Math.random() - 0.5) * this.shake
      this.camera.lookAt(0, 0, -0.4)
    }

    this.renderer.render(this.scene, this.camera)
  }
}
