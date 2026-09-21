Component({
  lifetimes: {
    ready() { this.draw() }
  },
  pageLifetimes: {
    show() { if (this.canvas) this.drawFrame() },
    hide() { this.stop() }
  },
  methods: {
    draw() {
      this.createSelectorQuery().select('#galaxy').fields({ node: true, size: true }).exec(res => {
        const info = res[0]
        if (!info || !info.node) return
        const canvas = info.node
        const ctx = canvas.getContext('2d')
        let windowInfo = {}
        try { windowInfo = wx.getWindowInfo() } catch (error) {}
        const dpr = Math.min(windowInfo.pixelRatio || 1, 2)
        canvas.width = info.width * dpr
        canvas.height = info.height * dpr
        ctx.scale(dpr, dpr)
        this.canvas = canvas
        this.ctx = ctx
        this.width = info.width
        this.height = info.height
        this.stars = Array.from({ length: 72 }, (_, index) => ({
          x: ((index * 83) % 997) / 997 * info.width,
          y: ((index * 151) % 991) / 991 * info.height,
          r: index % 17 === 0 ? 1.2 : .55,
          a: .18 + (index % 7) * .07,
          phase: index * .37
        }))
        this.startAt = Date.now()
        this.drawFrame()
      })
    },
    drawFrame() {
      if (!this.canvas || this.frame) return
      const loop = () => {
        const ctx = this.ctx
        const t = (Date.now() - this.startAt) / 1000
        ctx.clearRect(0, 0, this.width, this.height)
        const glow = ctx.createRadialGradient(this.width * .5, this.height * .28, 0, this.width * .5, this.height * .28, this.width * .75)
        glow.addColorStop(0, 'rgba(34, 48, 83, .26)')
        glow.addColorStop(.48, 'rgba(16, 22, 43, .12)')
        glow.addColorStop(1, 'rgba(5, 8, 18, 0)')
        ctx.fillStyle = glow
        ctx.fillRect(0, 0, this.width, this.height)
        this.stars.forEach(star => {
          const alpha = star.a * (.72 + Math.sin(t * .45 + star.phase) * .28)
          ctx.beginPath()
          ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(210, 220, 240, ${alpha})`
          ctx.fill()
        })
        this.frame = this.canvas.requestAnimationFrame(() => { this.frame = null; loop() })
      }
      loop()
    },
    stop() {
      if (this.canvas && this.frame) this.canvas.cancelAnimationFrame(this.frame)
      this.frame = null
    }
  }
})
