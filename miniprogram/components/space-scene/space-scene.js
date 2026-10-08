const { theme, buildDna, drawFallbackDna, colorForThree } = require('../../utils/dna-renderer')
let createScopedThreejs
try {
  createScopedThreejs = require('threejs-miniprogram').createScopedThreejs
} catch (error) {
  createScopedThreejs = null
}

Component({
  properties: {
    mode: { type: String, value: 'universe' },
    items: { type: Array, value: [] },
    selectedId: { type: String, value: '' },
    covered: { type: Boolean, value: false },
    reducedMotion: { type: Boolean, value: false }
  },
  data: { loading: true, fallback: false, snapshot: '' },
  lifetimes: {
    ready() { this.initialize() },
    detached() { this.dispose() }
  },
  pageLifetimes: {
    show() { this.running = true; if (this.glRenderer) this.animate() },
    hide() { this.running = false }
  },
  observers: {
    'mode,items': function () {
      if (this.readyOnce) this.rebuild()
    },
    selectedId: function (id) {
      this.applyDnaSelection(id)
    },
    covered: function (covered) { this.updateCovered(covered) }
  },
  methods: {
    initialize() {
      let device = {}
      try { device = wx.getDeviceInfo() } catch (error) {}
      const fallback = !createScopedThreejs || this.data.reducedMotion || (device.benchmarkLevel > 0 && device.benchmarkLevel < 8)
      this.setData({ fallback }, () => fallback ? this.initializeFallback() : this.initializeWebGL())
    },

    initializeWebGL() {
      this.createSelectorQuery().select('#webgl').node().exec(res => {
        const canvas = res[0] && res[0].node
        if (!canvas) { this.setData({ fallback: true }, () => this.initializeFallback()); return }
        try {
          const THREE = createScopedThreejs(canvas)
          let device = {}; let windowInfo = {}
          try { device = wx.getDeviceInfo() } catch (error) {}
          try { windowInfo = wx.getWindowInfo() } catch (error) {}
          const rectQuery = this.createSelectorQuery().select('.scene-shell').boundingClientRect()
          rectQuery.exec(bounds => {
            try {
              const rect = bounds[0]
              const width = rect.width || windowInfo.windowWidth || 375
              const height = rect.height || 360
              this.THREE = THREE
              this.canvas = canvas
              this.width = width
              this.height = height
              this.scene = new THREE.Scene()
              this.camera = new THREE.PerspectiveCamera(this.data.mode === 'dna' ? 40 : 42, width / height, .1, 100)
              this.camera.position.set(0, .1, this.data.mode === 'dna' ? 7.7 : 9)
              this.glRenderer = new THREE.WebGLRenderer({ canvas, antialias: Number(device.benchmarkLevel || 0) >= 15, alpha: true })
              this.glRenderer.gammaOutput = true
              this.glRenderer.gammaFactor = 2.2
              this.glRenderer.physicallyCorrectLights = true
              this.glRenderer.setPixelRatio(Math.min(windowInfo.pixelRatio || 1, 2))
              this.glRenderer.setSize(width, height)
              this.glRenderer.setClearColor(0x000000, 0)
              this.raycaster = new THREE.Raycaster()
              this.pointer = new THREE.Vector2()
              this.root = new THREE.Group()
              this.scene.add(this.root)
              this.addLights()
              this.addStars()
              this.rebuild()
              this.running = true
              this.readyOnce = true
              this.setData({ loading: false })
              this.animate()
            } catch (error) {
              this.dispose()
              this.setData({ fallback: true, loading: true }, () => this.initializeFallback())
            }
          })
        } catch (error) {
          this.dispose()
          this.setData({ fallback: true, loading: true }, () => this.initializeFallback())
        }
      })
    },

    addLights() {
      const THREE = this.THREE
      const isDna = this.data.mode === 'dna'
      if (isDna) {
        this.scene.add(new THREE.AmbientLight(colorForThree(THREE, theme.lighting.ambient), theme.lighting.ambientIntensity))
        const key = new THREE.DirectionalLight(colorForThree(THREE, theme.lighting.key), theme.lighting.keyIntensity)
        key.position.set(-3, 5, 7)
        const fill = new THREE.DirectionalLight(colorForThree(THREE, theme.lighting.fill), theme.lighting.fillIntensity)
        fill.position.set(4, -2, 4)
        this.scene.add(key, fill)
        return
      }
      this.scene.add(new THREE.AmbientLight(colorForThree(THREE, '#8d98b5'), 1.2))
      const key = new THREE.DirectionalLight(colorForThree(THREE, '#f1d28c'), 3.2)
      key.position.set(4, 5, 6)
      this.scene.add(key)
      const rim = new THREE.PointLight(colorForThree(THREE, '#755ce5'), 16, 18)
      rim.position.set(-4, -1, 3)
      this.scene.add(rim)
    },

    addStars() {
      const THREE = this.THREE
      const positions = []
      const isDna = this.data.mode === 'dna'
      const count = isDna ? 150 : 260
      for (let index = 0; index < count; index += 1) {
        const seed = index * 12.9898
        positions.push(
          (Math.sin(seed) * 9.7) % 9.7,
          (Math.sin(seed * 1.71) * 7.2) % 7.2,
          -2 - Math.abs((Math.sin(seed * 2.33) * 12) % 12)
        )
      }
      const geometry = new THREE.BufferGeometry()
      // The official mini-program adapter uses Three.js r108.
      geometry.addAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      const material = new THREE.PointsMaterial({ color: isDna ? colorForThree(THREE, theme.stars.color) : 0xb9c4dd, size: isDna ? .018 : .025, transparent: true, opacity: isDna ? theme.stars.opacity : .65 })
      this.stars = new THREE.Points(geometry, material)
      this.scene.add(this.stars)
    },

    clearRoot() {
      if (!this.root) return
      while (this.root.children.length) {
        const child = this.root.children[0]
        this.root.remove(child)
        child.traverse(item => {
          if (item.geometry) item.geometry.dispose()
          if (item.material) {
            if (Array.isArray(item.material)) item.material.forEach(material => material.dispose())
            else item.material.dispose()
          }
        })
      }
      this.clickable = []
      this.orbiters = []
      this.dnaVisual = null
    },

    rebuild() {
      if (this.fallbackCtx) { this.drawFallback(); return }
      if (!this.THREE) return
      this.clearRoot()
      if (this.data.mode === 'dna') this.buildDna()
      else this.buildUniverse()
    },

    buildUniverse() {
      const THREE = this.THREE
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.55, 3),
        new THREE.MeshStandardMaterial({ color: colorForThree(THREE, '#23304a'), metalness: .34, roughness: .44 })
      )
      core.userData = { id: 'core', title: '轻创拼拼' }
      this.root.add(core)

      const wire = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.575, 2),
        new THREE.MeshBasicMaterial({ color: colorForThree(THREE, '#d9bb72'), wireframe: true, transparent: true, opacity: .17 })
      )
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.7, 32, 32),
        new THREE.MeshBasicMaterial({ color: colorForThree(THREE, '#62c7d9'), transparent: true, opacity: .055, side: THREE.BackSide })
      )
      this.root.add(wire, atmosphere)

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(2.15, 2.19, 120),
        new THREE.MeshBasicMaterial({ color: colorForThree(THREE, '#d9bb72'), transparent: true, opacity: .5, side: THREE.DoubleSide })
      )
      ring.rotation.x = Math.PI / 2.45
      ring.rotation.z = .16
      this.root.add(ring)

      const items = this.data.items || []
      this.orbiters = []
      this.clickable = [core]
      items.forEach((item, index) => {
        const band = index % 5
        const angle = Math.floor(index / 5) / Math.max(Math.ceil((items.length - band) / 5), 1) * Math.PI * 2 + band * .43
        const radius = 2.35 + band * .42
        const size = index < 3 ? .12 : .075
        const material = new THREE.MeshStandardMaterial({
          color: colorForThree(THREE, item.planet && item.planet.color || '#9b87e8'),
          emissive: colorForThree(THREE, item.planet && item.planet.color || '#9b87e8'),
          emissiveIntensity: index < 3 ? .6 : .4,
          metalness: .4,
          roughness: .34
        })
        const planet = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 12), material)
        planet.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * (.38 + band * .045), Math.sin(angle) * radius * .3)
        planet.userData = { id: item.id, title: item.title, index }
        this.root.add(planet)
        this.clickable.push(planet)
        this.orbiters.push({ mesh: planet, angle, radius, baseY: planet.position.y, speed: .035 + band * .008 })

        if (index >= 20) return
        const linePoints = [new THREE.Vector3(0, 0, 0), planet.position.clone()]
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(linePoints),
          new THREE.LineBasicMaterial({ color: 0x7784a4, transparent: true, opacity: .14 })
        )
        line.userData.planet = planet
        line.userData.target = planet.position.clone()
        this.root.add(line)
      })
      const tangent = Math.tan(this.camera.fov * Math.PI / 360)
      // One hundred catalog planets sample the full orbit more densely than the old
      // eight-item demo, so reserve enough horizontal frame for the true extrema.
      this.universeDefaultZoom = 4.3 / Math.sin(Math.min(Math.atan(tangent), Math.atan(tangent * this.camera.aspect))) * 1.04
      this.camera.position.set(0, .1, this.universeDefaultZoom)
    },

    buildDna() {
      this.dnaVisual = buildDna(this.THREE, this.data.items || [])
      this.dnaGroup = this.dnaVisual.group
      this.dnaGroup.rotation.set(.08, 0, -.12)
      this.dnaGroup.scale.setScalar(.9)
      this.root.add(this.dnaGroup)
      this.clickable = this.dnaVisual.clickable
      const tangent = Math.tan(this.camera.fov * Math.PI / 360)
      this.dnaDefaultZoom = Math.max(6.8, (this.dnaVisual.height / 2 + .5) * .9 / tangent * theme.geometry.contentFramePadding, 1.8 / (tangent * this.camera.aspect) * 1.1)
      this.camera.position.set(0, theme.geometry.cameraOffsetY, this.dnaDefaultZoom)
      this.applyDnaSelection(this.data.selectedId)
    },

    applyDnaSelection(id, side) {
      this.dnaSelectedId = id || ''
      if (side) this.dnaSelectedSide = side
      if (this.dnaVisual) this.dnaVisual.select(this.dnaSelectedId, this.dnaSelectedSide || 'A')
      if (this.fallbackCtx) this.drawFallback()
    },

    updateCovered(covered) {
      if (!covered) { this.setData({ snapshot: '' }); this.animate(); return }
      // Native canvases can cover ordinary views in the WeChat simulator.
      // Keep the exact selected frame as an image while the reading sheet is open.
      let snapshot = ''
      try {
        this.applyDnaSelection(this.data.selectedId)
        if (this.glRenderer) this.glRenderer.render(this.scene, this.camera)
        const canvas = this.canvas || this.fallbackCanvas
        if (canvas && canvas.toDataURL) snapshot = canvas.toDataURL('image/png')
      } catch (error) {}
      this.setData({ snapshot })
    },

    animate() {
      if (!this.glRenderer || !this.canvas || this.framePending || !this.running || this.data.covered) return
      const render = () => {
        if (!this.glRenderer || !this.running || this.data.covered) { this.framePending = null; return }
        const nodeSelected = this.data.mode === 'dna' && this.dnaSelectedId
        if (!this.touching && !this.data.reducedMotion && !nodeSelected) this.root.rotation.y += this.data.mode === 'dna' ? .0028 : .0017
        if (this.orbiters && !this.data.reducedMotion && !this.touching) this.orbiters.forEach((orbiter, index) => {
          orbiter.mesh.position.y = orbiter.baseY
          orbiter.mesh.rotation.y += .006
          orbiter.mesh.rotation.x += .002
        })
        if (this.stars && !this.data.reducedMotion) this.stars.rotation.y += .0002
        this.glRenderer.render(this.scene, this.camera)
        this.framePending = this.canvas.requestAnimationFrame(render)
      }
      this.framePending = this.canvas.requestAnimationFrame(render)
    },

    onTouchStart(event) {
      const touches = event.touches || []
      this.touching = true
      if (touches.length === 1 && !this.pinching) { this.gestureMoved = false; this.gestureTravel = 0; this.gestureAxis = null }
      this.touchStart = touches[0] ? { x: touches[0].x, y: touches[0].y } : null
      this.lastTouch = this.touchStart
      if (touches.length === 2) {
        this.pinching = true
        this.gestureMoved = true
        this.pinchStart = this.distance(touches[0], touches[1])
      }
    },
    onTouchMove(event) {
      if (!this.root) return
      const touches = event.touches || []
      if (touches.length === 2) {
        this.pinching = true
        this.gestureMoved = true
        const distance = this.distance(touches[0], touches[1])
        if (this.pinchStart) {
          this.zoomView(-(distance - this.pinchStart) * .012)
        }
        this.pinchStart = distance
        return
      }
      const point = touches[0]
      if (!point || !this.lastTouch) return
      const deltaX = point.x - this.lastTouch.x
      const deltaY = point.y - this.lastTouch.y
      this.gestureTravel = (this.gestureTravel || 0) + Math.hypot(deltaX, deltaY)
      if (this.gestureTravel > 12) this.gestureMoved = true
      if (this.data.mode === 'dna') {
        // dna 页面由页面级滚动承载：第一帧定方向，竖向手势让给页面滚动，横向手势才旋转模型。
        // 不做这个锁定的话，上下滑页面时模型会跟着乱转，两个手势互相打架。
        if (!this.gestureAxis && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
          this.gestureAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y'
        }
        if (this.gestureAxis === 'y') { this.lastTouch = { x: point.x, y: point.y }; return }
      }
      this.root.rotation.y += deltaX * .012
      this.root.rotation.x = Math.max(-.7, Math.min(.7, this.root.rotation.x + deltaY * .008))
      this.lastTouch = { x: point.x, y: point.y }
    },
    onTouchEnd(event) {
      this.touching = Boolean(event.touches && event.touches.length)
      if (this.pinching) {
        this.touchStart = null; this.lastTouch = null; this.pinchStart = null; this.gestureAxis = null
        if (!this.touching) this.pinching = false
        return
      }
      const changed = event.changedTouches && event.changedTouches[0]
      if (!changed || !this.touchStart) return
      const moved = Math.hypot(changed.x - this.touchStart.x, changed.y - this.touchStart.y)
      if (!this.gestureMoved && moved < 12) this.pick(changed.x, changed.y)
      this.touchStart = null; this.lastTouch = null; this.pinchStart = null; this.gestureAxis = null
    },
    onTouchCancel() { this.touching = false; this.pinching = false; this.gestureMoved = false; this.gestureTravel = 0; this.touchStart = null; this.lastTouch = null; this.pinchStart = null; this.gestureAxis = null },
    onFallbackStart() { this.fallbackMoved = false },
    onFallbackMove() { this.fallbackMoved = true },
    distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) },

    zoomView(amount) {
      if (!this.camera) return
      const minZoom = this.data.mode === 'dna' ? this.dnaDefaultZoom * .65 : this.universeDefaultZoom * .7
      const maxZoom = this.data.mode === 'dna' ? this.dnaDefaultZoom * 1.8 : this.universeDefaultZoom * 1.5
      this.camera.position.z = Math.max(minZoom, Math.min(maxZoom, this.camera.position.z + amount))
    },

    resetView() {
      if (!this.camera || !this.root) return
      this.root.rotation.set(0, 0, 0)
      this.camera.position.set(0, this.data.mode === 'dna' ? theme.geometry.cameraOffsetY : .1, this.data.mode === 'dna' ? this.dnaDefaultZoom : this.universeDefaultZoom)
      if (this.dnaGroup) this.dnaGroup.rotation.set(.08, 0, -.12)
    },

    pick(x, y) {
      if (!this.raycaster || !this.clickable.length) return
      this.pointer.x = x / this.width * 2 - 1
      this.pointer.y = -(y / this.height) * 2 + 1
      this.raycaster.setFromCamera(this.pointer, this.camera)
      const hits = this.raycaster.intersectObjects(this.clickable, false)
      if (hits.length) {
        const data = hits[0].object.userData
        if (this.data.mode === 'dna') this.applyDnaSelection(data.id, data.side)
        this.triggerEvent('select', data)
      }
    },

    initializeFallback() {
      this.createSelectorQuery().select('#fallback').fields({ node: true, size: true }).exec(res => {
        const item = res[0]
        if (!item || !item.node) return
        const canvas = item.node
        const ctx = canvas.getContext('2d')
        let windowInfo = {}
        try { windowInfo = wx.getWindowInfo() } catch (error) {}
        const dpr = Math.min(windowInfo.pixelRatio || 1, 2)
        canvas.width = item.width * dpr; canvas.height = item.height * dpr; ctx.scale(dpr, dpr)
        this.fallbackCanvas = canvas; this.fallbackCtx = ctx; this.width = item.width; this.height = item.height
        this.drawFallback()
        this.readyOnce = true
        this.setData({ loading: false })
      })
    },
    drawFallback() {
      const ctx = this.fallbackCtx
      if (!ctx) return
      ctx.clearRect(0, 0, this.width, this.height)
      if (this.data.mode === 'dna') this.drawFallbackDna(ctx)
      else this.drawFallbackUniverse(ctx)
    },
    drawFallbackUniverse(ctx) {
      const cx = this.width / 2; const cy = this.height / 2
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(this.width, this.height) * .38)
      glow.addColorStop(0, '#5b5134'); glow.addColorStop(.35, '#1a2744'); glow.addColorStop(1, 'rgba(5,8,18,0)')
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, Math.min(this.width, this.height) * .22, 0, Math.PI * 2); ctx.fill()
      this.fallbackPoints = (this.data.items || []).map((item, index, list) => {
        const band = index % 5
        const angle = Math.floor(index / 5) / Math.max(Math.ceil((list.length - band) / 5), 1) * Math.PI * 2 + band * .43
        const radius = Math.min(this.width, this.height) * (.26 + band * .048)
        const x = cx + Math.cos(angle) * radius; const y = cy + Math.sin(angle) * radius * .82
        if (index < 20) { ctx.strokeStyle = 'rgba(177,194,226,.12)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke() }
        ctx.fillStyle = index % 3 === 0 ? '#d9bb72' : index % 3 === 1 ? '#9b87e8' : '#62c7d9'
        ctx.globalAlpha = 1
        ctx.beginPath(); ctx.arc(x, y, index < 3 ? 3.5 : 2.4, 0, Math.PI * 2); ctx.fill()
        return { x, y, item }
      })
      this.fallbackPoints.push({ x: cx, y: cy, item: { id: 'core', title: '案例库' } })
    },
    drawFallbackDna(ctx) {
      const selectedId = this.dnaSelectedId === undefined ? this.data.selectedId : this.dnaSelectedId
      this.fallbackPoints = drawFallbackDna(ctx, this.width, this.height, this.data.items || [], selectedId, this.dnaSelectedSide || 'A')
    },
    onFallbackTap(event) {
      if (this.fallbackMoved) { this.fallbackMoved = false; return }
      const touch = event.changedTouches && event.changedTouches[0]
      if (!touch || !this.fallbackPoints) return
      let nearest = null; let distance = Infinity
      this.fallbackPoints.forEach(point => {
        const current = Math.hypot(touch.x - point.x, touch.y - point.y)
        if (current < distance) { distance = current; nearest = point }
      })
      if (nearest && distance < 28) {
        if (this.data.mode === 'dna') this.applyDnaSelection(nearest.item.id, nearest.side)
        this.triggerEvent('select', nearest.item.id ? { id: nearest.item.id, node: nearest.item, title: nearest.item.title || nearest.item.name } : {})
      }
    },

    dispose() {
      this.running = false
      if (this.canvas && this.framePending) this.canvas.cancelAnimationFrame(this.framePending)
      this.framePending = null
      this.clearRoot()
      if (this.stars) { this.stars.geometry.dispose(); this.stars.material.dispose() }
      if (this.glRenderer) this.glRenderer.dispose()
      this.glRenderer = null; this.scene = null; this.camera = null; this.THREE = null
    }
  }
})
