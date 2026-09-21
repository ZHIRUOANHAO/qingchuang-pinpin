const { customTopInset } = require('../../utils/layout')

Component({
  data: { height: 88 },
  lifetimes: { attached() { this.measure() } },
  pageLifetimes: { show() { this.measure() }, resize() { this.measure() } },
  methods: {
    measure() {
      let system = {}; let capsule = {}
      try { system = wx.getWindowInfo() } catch (error) {}
      try { capsule = wx.getMenuButtonBoundingClientRect() } catch (error) {}
      this.setData({ height: customTopInset(system, capsule) })
    }
  }
})
