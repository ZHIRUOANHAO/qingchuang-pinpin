Component({
  properties: { tone: { type: String, value: 'gold' } },
  lifetimes: { ready() { this.draw() } },
  methods: {
    draw() {
      this.createSelectorQuery().select('#mini').fields({ node: true, size: true }).exec(res => {
        const item = res[0]
        if (!item || !item.node) return
        const canvas = item.node
        const ctx = canvas.getContext('2d')
        let windowInfo = {}
        try { windowInfo = wx.getWindowInfo() } catch (error) {}
        const dpr = Math.min(windowInfo.pixelRatio || 1, 2)
        canvas.width = item.width * dpr; canvas.height = item.height * dpr; ctx.scale(dpr, dpr)
        const colors = this.data.tone === 'violet' ? ['#9b87e8', '#62c7d9'] : ['#d9bb72', '#9b87e8']
        for (let i = 0; i < 10; i += 1) {
          const x = 5 + i * (item.width - 10) / 9
          const y1 = item.height / 2 + Math.sin(i * .9) * item.height * .28
          const y2 = item.height / 2 - Math.sin(i * .9) * item.height * .28
          ctx.strokeStyle = 'rgba(177,194,226,.18)'; ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke()
          ctx.fillStyle = colors[0]; ctx.beginPath(); ctx.arc(x, y1, 2.1, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = colors[1]; ctx.beginPath(); ctx.arc(x, y2, 2.1, 0, Math.PI * 2); ctx.fill()
        }
      })
    }
  }
})
