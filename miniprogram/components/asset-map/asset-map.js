Component({
  properties: {
    map: { type: Object, value: null },
    interactive: { type: Boolean, value: false },
    selectedId: { type: String, value: '' }
  },
  methods: {
    selectBranch(event) {
      if (!this.data.interactive) return
      const id = event.currentTarget.dataset.id
      const branches = this.data.map && this.data.map.branches
      if (!id || !Array.isArray(branches) || !branches.some(branch => branch.id === id)) return
      this.triggerEvent('select', { id })
    }
  }
})
