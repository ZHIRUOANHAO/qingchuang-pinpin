const { theme, buildDna, drawFallbackDna, colorForThree } = require('../../utils/dna-renderer')
let createScopedThreejs
try {
  createScopedThreejs = require('threejs-miniprogram').createScopedThreejs
} catch (error) {
  createScopedThreejs = null
}

// 首页 100 颗案例星球共用同一套飞行轨迹参数；浏览器测试环境通过
// globalThis.QingchuangOrbit 提供同一份模块。
let flightOrbit = null
try {
  const required = require('../../utils/orbit')
  flightOrbit = required && required.createOrbiters ? required : null
} catch (error) {
  flightOrbit = null
}
if (!flightOrbit && typeof globalThis !== 'undefined') flightOrbit = globalThis.QingchuangOrbit || null

/**
 * 无贴图的行星表面：给球面顶点写一层灰度噪声（云/陆地的明暗斑驳），
 * 材质 color 负责行星色，vertexColors 负责表面纹理。r108 与小程序 WebGL 都支持。
 */
function createMottledSphereGeometry(THREE, segments, rings, seed) {
  // r108 的 SphereGeometry 是旧版 Geometry（没有 attributes）；要顶点色必须用
  // SphereBufferGeometry。部分环境没有该构造函数时退回普通球体，不影响渲染。
  const Sphere = THREE.SphereBufferGeometry || THREE.SphereGeometry
  const geometry = new Sphere(1, segments, rings)
  if (!geometry.attributes || !geometry.attributes.position) return geometry
  const position = geometry.attributes.position
  const source = position.array
  const colors = []
  for (let index = 0; index < position.count; index += 1) {
    const x = source[index * 3]
    const y = source[index * 3 + 1]
    const z = source[index * 3 + 2]
    const wave = Math.sin(x * 3.1 + seed) * Math.cos(y * 2.3 + z * 1.7)
      + .5 * Math.sin(x * 6.7 - y * 4.9 + z * 5.3 + seed)
      + .28 * Math.cos(x * 11.3 + z * 9.1 - y * 7.7)
    const patch = .5 + .5 * Math.sin(wave * 3.4)
    const shade = .58 + .42 * patch
    // 一点点冷暖偏移：亮斑偏青绿（陆地/云），暗区保留海洋深蓝。
    const land = .5 + .5 * Math.sin(wave * 5.1 + 1.3)
    colors.push(shade * (.9 + .1 * land), shade * (.96 + .06 * land), shade)
  }
  geometry.addAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return geometry
}

Component({
  properties: {
    mode: { type: String, value: 'universe' },
    items: { type: Array, value: [] },
    selectedId: { type: String, value: '' },
    covered: { type: Boolean, value: false },
    paused: { type: Boolean, value: false },
    reducedMotion: { type: Boolean, value: false }
  },
  data: { loading: true, fallback: false, snapshot: '' },
  lifetimes: {
    ready() { this.initialize() },
    detached() { this.dispose() }
  },
  pageLifetimes: {
    show() {
      this.running = true
      this.lastFrameTime = null
      this.fallbackLastTime = null
      if (this.glRenderer) this.animate()
      else if (this.fallbackCtx) this.startFallbackAnimation()
    },
    hide() { this.running = false; this.stopFrames() }
  },
  observers: {
    'mode,items': function () {
      if (this.readyOnce) this.rebuild()
    },
    selectedId: function (id) {
      this.applyDnaSelection(id)
    },
    covered: function (covered) { this.updateCovered(covered) },
    'paused,reducedMotion': function () { this.refreshMotion() }
  },
  methods: {
    stopFrames() {
      if (this.canvas && this.framePending != null) this.canvas.cancelAnimationFrame(this.framePending)
      if (this.fallbackCanvas && this.fallbackFrame != null) this.fallbackCanvas.cancelAnimationFrame(this.fallbackFrame)
      this.framePending = null
      this.fallbackFrame = null
      this.lastFrameTime = null
      this.fallbackLastTime = null
    },
    refreshMotion() {
      this.stopFrames()
      if (!this.running || this.data.covered) return
      if (this.fallbackCtx) { this.drawFallback(); this.startFallbackAnimation() }
      else if (this.glRenderer) { this.renderNow(); this.animate() }
    },
    renderNow() { if (this.glRenderer && this.scene && this.camera && !this.data.covered) this.glRenderer.render(this.scene, this.camera) },
    resumeAfterInteraction() {
      this.resumeAt = Date.now() + 800
      this.motionSpeed = 0
      this.lastFrameTime = null
      this.fallbackLastTime = null
      if (this.fallbackCtx) this.startFallbackAnimation()
      else this.animate()
    },
    motionDelta(delta, now) {
      if (this.touching || now < (this.resumeAt || 0)) return 0
      const speed = this.motionSpeed === undefined ? 1 : this.motionSpeed
      const decay = Math.exp(-6 * delta)
      this.motionSpeed = 1 - (1 - speed) * decay
      // Integrating the easing curve makes the travel independent of refresh rate.
      return delta - (1 - speed) * (1 - decay) / 6
    },
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
              this.glInitError = this.glInitError || String(error && (error.stack || error))
              this.dispose()
              this.setData({ fallback: true, loading: true }, () => this.initializeFallback())
            }
          })
        } catch (error) {
          this.glInitError = this.glInitError || String(error && (error.stack || error))
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
      // 自然光照：环境光打底、偏冷的远景主光，加一盏位于中心的暖色“恒星”点光源，
      // 行星朝中心的一侧被照亮、背侧自然变暗，形成真实的明暗分界。
      this.scene.add(new THREE.AmbientLight(colorForThree(THREE, '#a9bcd8'), .52))
      const key = new THREE.DirectionalLight(colorForThree(THREE, '#f2f7ff'), 2.0)
      key.position.set(3, 5, 7)
      this.scene.add(key)
      const sun = new THREE.PointLight(colorForThree(THREE, '#ffdfb4'), 95, 0, 2)
      sun.position.set(0, 0, 0)
      this.scene.add(sun)
      const fill = new THREE.PointLight(colorForThree(THREE, '#7fa3e8'), 20, 0, 2)
      fill.position.set(-4, 1, 4)
      this.scene.add(fill)
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
      this.bands = []
      this.orbitTime = 0
      this.lastFrameTime = 0
      this.universePoint = null
      this.planetWire = null
      this.corePlanet = null
      this.dnaVisual = null
    },

    rebuild() {
      if (this.fallbackCtx) {
        this.fallbackOrbiters = flightOrbit ? flightOrbit.createOrbiters((this.data.items || []).length) : []
        this.fallbackTime = 0
        this.drawFallback()
        this.startFallbackAnimation()
        return
      }
      if (!this.THREE) return
      this.clearRoot()
      if (this.data.mode === 'dna') this.buildDna()
      else this.buildUniverse()
    },

    buildUniverse() {
      const THREE = this.THREE
      const items = this.data.items || []
      const bandCount = flightOrbit ? flightOrbit.BAND_COUNT : 5
      const systemTilt = flightOrbit ? flightOrbit.SYSTEM_TILT : [0.50, -0.06]
      // 轨道颜色与行星颜色共用同一套色板（miniprogram/utils/orbit.js 的 RING_COLORS），
      // 这样每条轨道和它上面的行星是同一个色系。
      const bandColors = (flightOrbit && flightOrbit.RING_COLORS) || ['#e0b055', '#3aa6c9', '#7a63d8', '#4cae78', '#8f9cb3']

      // 中心行星：自然球面 + 大气边缘 + 很淡的柔光，不再用线框或霓虹装饰。
      const coreGeometry = createMottledSphereGeometry(THREE, 64, 44, 4.2)
      const core = new THREE.Mesh(
        coreGeometry,
        new THREE.MeshStandardMaterial({
          color: colorForThree(THREE, '#4a86c4'),
          metalness: .04,
          roughness: .68,
          emissive: colorForThree(THREE, '#1c3f66'),
          emissiveIntensity: .62,
          vertexColors: Boolean(coreGeometry.attributes && coreGeometry.attributes.color)
        })
      )
      core.userData = { id: 'core', title: '轻创拼拼' }
      this.corePlanet = core
      this.planetWire = null
      this.root.add(core)

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 32, 24),
        new THREE.MeshBasicMaterial({ color: colorForThree(THREE, '#8cc6ef'), transparent: true, opacity: .22, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
      )
      this.root.add(atmosphere)

      // 柔和的大气光晕：用加色球壳模拟，低端设备也不需要贴图。
      const glowOuter = new THREE.Mesh(
        new THREE.SphereGeometry(4.2, 24, 20),
        new THREE.MeshBasicMaterial({ color: colorForThree(THREE, '#ffe4b8'), transparent: true, opacity: .11, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
      )
      const glowInner = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 24, 20),
        new THREE.MeshBasicMaterial({ color: colorForThree(THREE, '#fff0d4'), transparent: true, opacity: .12, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
      )
      this.root.add(glowOuter, glowInner)

      // 两道很淡的行星环，只给中心星一点自然轮廓，不再用金色装饰环。
      const ringGroup = new THREE.Group()
      ringGroup.rotation.x = 1.28
      ringGroup.rotation.z = .2
      ;[[1.28, .0032, '#c3cedd', .18], [1.44, .0024, '#aebccd', .1]].forEach(function (definition) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(definition[0], definition[1], 4, 120),
          new THREE.MeshBasicMaterial({ color: colorForThree(THREE, definition[2]), transparent: true, opacity: definition[3], depthWrite: false })
        )
        ringGroup.add(ring)
      })
      this.root.add(ringGroup)

      // 五条同心轨道共面：只有一块倾斜的轨道面，轨道线就是干净的同心情圆。
      const plane = new THREE.Group()
      plane.rotation.x = systemTilt[0]
      plane.rotation.z = systemTilt[1]
      this.root.add(plane)

      this.orbiters = []
      this.bands = []
      this.clickable = [core]
      this.orbitTime = 0
      this.lastFrameTime = 0
      this.universePoint = null
      for (let band = 0; band < bandCount; band += 1) {
        const radius = flightOrbit ? flightOrbit.bandRadius(band) : 2.30 + band * .44
        this.bands.push({ radius, color: bandColors[band] })
        if (!flightOrbit) continue
        // 自然视角里轨道是“看不见”的；只留极淡的参考线，帮助读出每条轨道的方向。
        const geometry = new THREE.BufferGeometry()
        geometry.addAttribute('position', new THREE.Float32BufferAttribute(flightOrbit.ringPoints(radius, 180), 3))
        const guide = new THREE.LineLoop(
          geometry,
          new THREE.LineBasicMaterial({
            color: colorForThree(THREE, '#6f7f96'),
            transparent: true,
            opacity: Math.max(.08, .16 - band * .015),
            depthWrite: false
          })
        )
        plane.add(guide)
      }

      const orbiters = flightOrbit ? flightOrbit.createOrbiters(items.length) : []
      const planetGeometry = createMottledSphereGeometry(THREE, 24, 16, 1.7)
      items.forEach((item, index) => {
        const traits = orbiters[index] || null
        const band = traits ? traits.band : index % bandCount
        const size = traits ? flightOrbit.planetSize(traits.band, index) : .06
        // 自然行星色：颜色跟着轨道走（岩石灰/锈红/海蓝/气态米/冰蓝）。
        const color = flightOrbit && flightOrbit.planetColor
          ? flightOrbit.planetColor(band, index)
          : (item.planet && item.planet.color || '#9b87e8')
        const material = new THREE.MeshStandardMaterial({
          color: colorForThree(THREE, color),
          emissive: colorForThree(THREE, color),
          emissiveIntensity: .22,
          metalness: .02,
          roughness: .78,
          vertexColors: Boolean(planetGeometry.attributes && planetGeometry.attributes.color)
        })
        const planet = new THREE.Mesh(planetGeometry, material)
        planet.scale.setScalar(size)
        if (traits) planet.rotation.z = traits.spinTilt
        const start = traits ? flightOrbit.positionAt(traits, 0) : { x: 2.30 + band * .44, y: 0, z: 0 }
        planet.position.set(start.x, start.y, start.z)
        planet.userData = { id: item.id, title: item.title, index }
        plane.add(planet)
        this.clickable.push(planet)
        this.orbiters.push({ mesh: planet, traits, size, trail: null })
      })
      // 电影感氛围层：缓慢旋转的尘埃带。
      const dustPositions = []
      const dustColors = []
      for (let index = 0; index < 420; index += 1) {
        const angle = index * 2.39996 + Math.sin(index * 1.7) * .6
        const radius = 1.9 + (index * 37 % 100) / 100 * 2.35
        dustPositions.push(Math.cos(angle) * radius, Math.sin(index * 2.3) * .045, Math.sin(angle) * radius)
        const warm = index % 3 === 0
        dustColors.push(warm ? 1 : .72, warm ? .86 : .82, warm ? .6 : 1)
      }
      const dustGeometry = new THREE.BufferGeometry()
      dustGeometry.addAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3))
      dustGeometry.addAttribute('color', new THREE.Float32BufferAttribute(dustColors, 3))
      this.dustRing = new THREE.Points(dustGeometry, new THREE.PointsMaterial({
        size: .024,
        vertexColors: true,
        transparent: true,
        opacity: .72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      }))
      plane.add(this.dustRing)

      // 逆光星芒：几何三角形光扇，放在星球背后缓慢旋转，不依赖贴图。
      const rayPositions = []
      const rayColors = []
      for (let index = 0; index < 56; index += 1) {
        const angle = index / 56 * Math.PI * 2
        const half = .006 + (index % 3) * .006
        const length = 2.4 + (index % 4) * .55
        rayPositions.push(
          0, 0, 0,
          Math.cos(angle - half) * length, Math.sin(angle - half) * length, 0,
          Math.cos(angle + half) * length, Math.sin(angle + half) * length, 0
        )
        const fade = .5 + (index % 2) * .5
        rayColors.push(fade, fade * .87, fade * .65, fade, fade * .87, fade * .65, fade, fade * .87, fade * .65)
      }
      const rayGeometry = new THREE.BufferGeometry()
      rayGeometry.addAttribute('position', new THREE.Float32BufferAttribute(rayPositions, 3))
      rayGeometry.addAttribute('color', new THREE.Float32BufferAttribute(rayColors, 3))
      this.rayGroup = new THREE.Mesh(
        rayGeometry,
        new THREE.MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: .4,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      )
      this.rayGroup.position.z = -.9
      this.root.add(this.rayGroup)

      this.updateUniverse(0)
      const tangent = Math.tan(this.camera.fov * Math.PI / 360)
      // One hundred catalog planets sample the full orbit more densely than the old
      // eight-item demo, so reserve enough horizontal frame for the true extrema.
      this.universeDefaultZoom = 4.2 / Math.sin(Math.min(Math.atan(tangent), Math.atan(tangent * this.camera.aspect))) * 1.04
      // 入场动效：镜头从稍远处推近，行星系统由 0.9 倍放大到 1 倍，星芒渐亮。
      this.introTime = 0
      this.root.scale.setScalar(.9)
      this.camera.position.set(0, .1, this.universeDefaultZoom * 1.05)
      if (this.rayGroup) this.rayGroup.material.opacity = 0
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
      if (this.readyOnce) this.refreshMotion()
    },

    updateCovered(covered) {
      this.stopFrames()
      if (!covered) { this.setData({ snapshot: '' }); this.refreshMotion(); return }
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

    updateUniverse(time) {
      if (!flightOrbit || !this.orbiters || !this.orbiters.length) return
      const point = this.universePoint || (this.universePoint = { x: 0, y: 0, z: 0 })
      for (let index = 0; index < this.orbiters.length; index += 1) {
        const orbiter = this.orbiters[index]
        if (!orbiter.traits) continue
        flightOrbit.positionAt(orbiter.traits, time, point)
        orbiter.mesh.position.set(point.x, point.y, point.z)
        // Perspective already provides depth; changing physical size made planets pulse.
        orbiter.mesh.rotation.y = time * orbiter.traits.spinSpeed * 60
      }
    },

    animate() {
      if (!this.glRenderer || !this.canvas || this.framePending != null || !this.running || this.data.covered || this.touching) return
      if (this.data.paused || this.data.reducedMotion || (this.data.mode === 'dna' && this.dnaSelectedId)) { this.renderNow(); return }
      const render = () => {
        this.framePending = null
        if (!this.glRenderer || !this.running || this.data.covered || this.data.paused || this.data.reducedMotion || this.touching) return
        const nodeSelected = this.data.mode === 'dna' && this.dnaSelectedId
        const now = Date.now()
        const delta = this.lastFrameTime == null ? 0 : Math.max(0, Math.min((now - this.lastFrameTime) / 1000, .05))
        this.lastFrameTime = now
        if (!this.touching && !this.data.reducedMotion && !nodeSelected) {
          const travel = this.motionDelta(delta, now)
          if (this.data.mode === 'dna') this.root.rotation.y += .168 * travel
          if (this.data.mode === 'universe') {
            this.orbitTime = (this.orbitTime || 0) + travel
            this.updateUniverse(this.orbitTime)
            this.introTime = (this.introTime || 0) + travel
            const introProgress = Math.min(1, this.introTime / 1.2)
            const introEase = 1 - Math.pow(1 - introProgress, 3)
            this.root.scale.setScalar(.9 + .1 * introEase)
            this.camera.position.z = this.universeDefaultZoom * (1.05 - .05 * introEase)
            // 镜头推近时的轻微俯仰漂移，让画面像在缓慢环绕。
            this.camera.position.y = .1 + Math.sin(this.orbitTime * .14) * .05
            this.camera.lookAt(0, 0, 0)
            // 星球本体自转。
            if (this.corePlanet) this.corePlanet.rotation.y += .06 * travel
            if (this.dustRing) this.dustRing.rotation.y += .02 * travel
            if (this.rayGroup) {
              this.rayGroup.rotation.z += .006 * travel
              this.rayGroup.material.opacity = .26 * introEase
            }
          }
        }
        if (this.stars && !this.data.reducedMotion) {
          this.stars.rotation.y += .012 * delta
          // 星点轻微呼吸，让静态背景也“活”着。
          this.stars.material.opacity = .72 + .12 * Math.sin((this.orbitTime || 0) * 1.25)
        }
        this.glRenderer.render(this.scene, this.camera)
        if (!nodeSelected) this.framePending = this.canvas.requestAnimationFrame(render)
      }
      this.framePending = this.canvas.requestAnimationFrame(render)
    },

    onTouchStart(event) {
      const touches = event.touches || []
      this.touching = true
      this.stopFrames()
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
      this.renderNow()
    },
    onTouchEnd(event) {
      this.touching = Boolean(event.touches && event.touches.length)
      if (!this.touching) this.resumeAfterInteraction()
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
    onTouchCancel() { this.touching = false; this.pinching = false; this.gestureMoved = false; this.gestureTravel = 0; this.touchStart = null; this.lastTouch = null; this.pinchStart = null; this.gestureAxis = null; this.resumeAfterInteraction() },
    onFallbackStart() { this.fallbackMoved = false; this.touching = true; this.stopFrames() },
    onFallbackMove() { this.fallbackMoved = true },
    onFallbackCancel() { this.fallbackMoved = true; this.touching = false; this.resumeAfterInteraction() },
    distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) },

    zoomView(amount) {
      if (!this.camera) return
      const minZoom = this.data.mode === 'dna' ? this.dnaDefaultZoom * .65 : this.universeDefaultZoom * .7
      const maxZoom = this.data.mode === 'dna' ? this.dnaDefaultZoom * 1.8 : this.universeDefaultZoom * 1.5
      this.camera.position.z = Math.max(minZoom, Math.min(maxZoom, this.camera.position.z + amount))
      this.renderNow()
    },

    resetView() {
      if (this.fallbackCtx) { this.drawFallback(); return }
      if (!this.camera || !this.root) return
      this.root.rotation.set(0, 0, 0)
      this.camera.position.set(0, this.data.mode === 'dna' ? theme.geometry.cameraOffsetY : .1, this.data.mode === 'dna' ? this.dnaDefaultZoom : this.universeDefaultZoom)
      if (this.dnaGroup) this.dnaGroup.rotation.set(.08, 0, -.12)
      this.renderNow()
    },

    pick(x, y) {
      if (!this.raycaster || !this.clickable.length) return
      if (this.scene) this.scene.updateMatrixWorld(true)
      this.pointer.x = x / this.width * 2 - 1
      this.pointer.y = -(y / this.height) * 2 + 1
      this.raycaster.setFromCamera(this.pointer, this.camera)
      const hits = this.raycaster.intersectObjects(this.clickable, false)
      let hit = hits.length ? hits[0].object : null
      // Touch tolerance never selects a case hidden behind the core planet.
      if (!hit && this.data.mode === 'universe' && this.THREE) {
        const world = this.pickWorld || (this.pickWorld = new this.THREE.Vector3())
        const projected = this.pickProjected || (this.pickProjected = new this.THREE.Vector3())
        let nearest = 18
        for (let index = 1; index < this.clickable.length; index += 1) {
          const mesh = this.clickable[index]
          mesh.getWorldPosition(world)
          projected.copy(world).project(this.camera)
          if (projected.z < -1 || projected.z > 1) continue
          const distance = Math.hypot((projected.x + 1) * this.width / 2 - x, (1 - projected.y) * this.height / 2 - y)
          if (distance >= nearest) continue
          this.pointer.set(projected.x, projected.y)
          this.raycaster.setFromCamera(this.pointer, this.camera)
          const obstruction = this.raycaster.intersectObject(this.corePlanet, false)[0]
          if (obstruction && obstruction.distance < this.camera.position.distanceTo(world) - .15) continue
          nearest = distance
          hit = mesh
        }
      }
      if (hit) {
        const data = hit.userData
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
        this.fallbackOrbiters = flightOrbit ? flightOrbit.createOrbiters((this.data.items || []).length) : []
        this.fallbackTime = 0
        this.running = true
        this.drawFallback()
        this.readyOnce = true
        this.setData({ loading: false })
        this.startFallbackAnimation()
      })
    },

    startFallbackAnimation() {
      // 只有首页星球需要连续重绘；DNA 降级视图按需重绘即可，避免空转耗电。
      if (this.data.mode !== 'universe') return
      if (!this.fallbackCanvas || !this.fallbackCtx || !this.running || this.data.covered || this.data.paused || this.data.reducedMotion || this.touching || this.fallbackFrame != null) return
      this.fallbackLastTime = null
      this.fallbackDrawClock = 0
      const frame = timestamp => {
        this.fallbackFrame = null
        if (!this.running || !this.fallbackCtx || this.data.covered || this.data.paused || this.data.reducedMotion || this.touching) return
        const delta = this.fallbackLastTime == null ? 0 : Math.max(0, Math.min((timestamp - this.fallbackLastTime) / 1000, .05))
        this.fallbackLastTime = timestamp
        this.fallbackTime = (this.fallbackTime || 0) + this.motionDelta(delta, Date.now())
        this.fallbackDrawClock = (this.fallbackDrawClock || 0) + delta
        // 低端设备限制在约 30fps，省电优先，仍能看出各自的飞行方向。
        if (this.fallbackDrawClock >= .03) {
          this.fallbackDrawClock = 0
          this.drawFallback()
        }
        this.fallbackFrame = this.fallbackCanvas.requestAnimationFrame(frame)
      }
      this.fallbackFrame = this.fallbackCanvas.requestAnimationFrame(frame)
    },
    drawFallback() {
      const ctx = this.fallbackCtx
      if (!ctx) return
      ctx.clearRect(0, 0, this.width, this.height)
      if (this.data.mode === 'dna') this.drawFallbackDna(ctx)
      else this.drawFallbackUniverse(ctx, this.fallbackTime || 0)
    },
    drawFallbackUniverse(ctx, time = 0) {
      const width = this.width || 320
      const height = this.height || 240
      const cx = width / 2
      const cy = height / 2
      const base = Math.min(width, height)
      const TAU = Math.PI * 2
      ctx.clearRect(0, 0, width, height)

      const items = this.data.items || []
      if (!this.fallbackOrbiters || this.fallbackOrbiters.length !== items.length) {
        this.fallbackOrbiters = flightOrbit ? flightOrbit.createOrbiters(items.length) : []
      }
      const orbiters = this.fallbackOrbiters || []
      const scale = base * (.26 / 2.35)
      // 和 WebGL 版共用同一块倾斜轨道面：所有轨道同心、同向、共面。
      const tilt = flightOrbit ? flightOrbit.SYSTEM_TILT[0] : .50
      const squash = Math.sin(tilt) * .96
      const cssColor = function (value) {
        if (typeof value === 'string') return value
        if (typeof value === 'number') return '#' + ('000000' + value.toString(16)).slice(-6)
        return '#d9bb72'
      }

      // 中心行星的暖光
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * .44)
      glow.addColorStop(0, 'rgba(255,242,210,.85)')
      glow.addColorStop(.14, 'rgba(228,201,130,.38)')
      glow.addColorStop(.4, 'rgba(80,130,180,.12)')
      glow.addColorStop(1, 'rgba(5,8,18,0)')
      ctx.fillStyle = glow
      ctx.beginPath(); ctx.arc(cx, cy, base * .44, 0, TAU); ctx.fill()

      // 五条同心轨道参考环
      const bandCount = flightOrbit ? flightOrbit.BAND_COUNT : 5
      for (let band = 0; band < bandCount; band += 1) {
        const radius = (flightOrbit ? flightOrbit.bandRadius(band) : 2.30 + band * .44) * scale
        // 自然视角里轨道线很淡，只是帮助读出方向。
        ctx.strokeStyle = 'rgba(111,127,150,' + Math.max(.08, .2 - band * .025).toFixed(2) + ')'
        ctx.lineWidth = 1
        // 用 scale + arc 画椭圆，兼容个别低版本 Canvas 2D 没有 ellipse 的情况。
        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(1, squash)
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU)
        ctx.restore()
        ctx.stroke()
      }

      // 中心行星本体：先画被星球挡住的赤道环带，再画球面，环带就不会压在球面上。
      const pr = Math.max(14, 1.22 * scale)
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-.3); ctx.scale(1, .36)
      ;[[1.34, .4], [1.5, .26], [1.66, .16]].forEach(function (definition) {
        ctx.strokeStyle = 'rgba(228,201,130,' + definition[1] + ')'
        ctx.beginPath(); ctx.arc(0, 0, pr * definition[0], 0, TAU); ctx.stroke()
      })
      ctx.restore()
      const body = ctx.createRadialGradient(cx - pr * .34, cy - pr * .38, pr * .08, cx, cy, pr)
      body.addColorStop(0, '#41557a')
      body.addColorStop(.5, '#1d2c46')
      body.addColorStop(1, '#0a1422')
      ctx.fillStyle = body
      ctx.beginPath(); ctx.arc(cx, cy, pr, 0, TAU); ctx.fill()
      ctx.strokeStyle = 'rgba(98,199,217,.22)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(cx, cy, pr * 1.04, 0, TAU); ctx.stroke()
      ctx.save()
      ctx.beginPath(); ctx.arc(cx, cy, pr, 0, TAU); ctx.clip()
      ctx.strokeStyle = 'rgba(228,201,130,.2)'
      for (let latitude = -2; latitude <= 2; latitude += 1) {
        const offset = latitude * pr * .34
        const rx = Math.sqrt(Math.max(0, pr * pr - offset * offset))
        ctx.save(); ctx.translate(cx, cy + offset); ctx.scale(1, .42)
        ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.restore(); ctx.stroke()
      }
      ctx.save(); ctx.translate(cx, cy); ctx.scale(.55, 1)
      ctx.beginPath(); ctx.arc(0, 0, pr, 0, TAU); ctx.restore(); ctx.stroke()
      ctx.restore()

      // 星球按远近排序后再画，近处的更大更亮，远离中心的不抢主体。
      const points = []
      const projected = orbiters.map(function (orbiter, index) {
        const position = flightOrbit ? flightOrbit.positionAt(orbiter, time) : { x: 0, y: 0, z: 0 }
        return {
          index,
          orbiter,
          item: items[index],
          x: cx + position.x * scale,
          y: cy + (position.y * Math.cos(tilt) - position.z * Math.sin(tilt)) * scale,
          depth: position.z
        }
      }).sort(function (a, b) { return a.depth - b.depth })
      projected.forEach(function (entry) {
        const radius = Math.max(1.4, (flightOrbit ? flightOrbit.planetSize(entry.orbiter.band, entry.index) : .06) * scale * 1.15)
        if (entry.depth < 0 && Math.hypot(entry.x - cx, entry.y - cy) < pr + radius) return
        const color = flightOrbit && flightOrbit.planetColor
          ? cssColor(flightOrbit.planetColor(entry.orbiter.band, entry.index))
          : (entry.item && entry.item.planet && entry.item.planet.color ? cssColor(entry.item.planet.color) : '#9a8f82')
        // 自然行星：亮面朝中心星，背侧压暗，2D 降级也保留体积感。
        const shade = ctx.createRadialGradient(entry.x - radius * .45, entry.y - radius * .45, radius * .1, entry.x, entry.y, radius * 1.15)
        shade.addColorStop(0, color)
        shade.addColorStop(.72, color)
        shade.addColorStop(1, 'rgba(8,12,20,.85)')
        ctx.globalAlpha = entry.depth > 0 ? 1 : .8
        ctx.fillStyle = shade
        ctx.beginPath(); ctx.arc(entry.x, entry.y, radius, 0, TAU); ctx.fill()
        ctx.globalAlpha = 1
        points.push({ x: entry.x, y: entry.y, item: entry.item })
      })
      points.push({ x: cx, y: cy, radius: pr, item: { id: 'core', title: '案例库' } })
      this.fallbackPoints = points
    },
    drawFallbackDna(ctx) {
      const selectedId = this.dnaSelectedId === undefined ? this.data.selectedId : this.dnaSelectedId
      this.fallbackPoints = drawFallbackDna(ctx, this.width, this.height, this.data.items || [], selectedId, this.dnaSelectedSide || 'A')
    },
    onFallbackTap(event) {
      this.touching = false
      this.resumeAfterInteraction()
      if (this.fallbackMoved) { this.fallbackMoved = false; return }
      const touch = event.changedTouches && event.changedTouches[0]
      if (!touch || !this.fallbackPoints) return
      let nearest = null; let distance = Infinity
      let coreTarget = null
      this.fallbackPoints.forEach(point => {
        const centerDistance = Math.hypot(touch.x - point.x, touch.y - point.y)
        if (point.item && point.item.id === 'core') {
          if (centerDistance <= Math.max(point.radius || 0, 28)) coreTarget = point
          return
        }
        const current = centerDistance
        if (current < distance) { distance = current; nearest = point }
      })
      if ((!nearest || distance >= 28) && coreTarget) { nearest = coreTarget; distance = 0 }
      if (nearest && distance < 28) {
        if (this.data.mode === 'dna') this.applyDnaSelection(nearest.item.id, nearest.side)
        this.triggerEvent('select', nearest.item.id ? { id: nearest.item.id, node: nearest.item, title: nearest.item.title || nearest.item.name } : {})
      }
    },

    dispose() {
      this.running = false
      this.stopFrames()
      this.fallbackCtx = null
      this.fallbackCanvas = null
      this.clearRoot()
      if (this.stars) { this.stars.geometry.dispose(); this.stars.material.dispose() }
      if (this.glRenderer) this.glRenderer.dispose()
      this.glRenderer = null; this.scene = null; this.camera = null; this.THREE = null
    }
  }
})
