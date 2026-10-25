const { theme } = require('../../utils/dna-renderer')

Component({
  properties: {
    items: { type: Array, value: [] },
    score: { type: Number, value: 0 },
    hasScore: { type: Boolean, value: true },
    selectedId: { type: String, value: '' },
    covered: { type: Boolean, value: false },
    reducedMotion: { type: Boolean, value: false }
  },
  data: { theme, stages: Object.values(theme.stages) },
  methods: {
    selectNode(event) { this.triggerEvent('select', event.detail) },
    resetView() { const scene = this.selectComponent('#scene'); if (scene) scene.resetView() },
    zoomIn() { const scene = this.selectComponent('#scene'); if (scene) scene.zoomView(-.8) },
    zoomOut() { const scene = this.selectComponent('#scene'); if (scene) scene.zoomView(.8) }
  }
})
