Component({
  properties: {
    enabled: { type: Boolean, value: false },
    unitId: { type: String, value: '' },
    placement: { type: String, value: '' },
    adType: { type: String, value: 'banner' }
  },
  methods: {
    onLoad(event) { this.triggerEvent('load', { placement: this.data.placement, detail: event.detail }) },
    onError(event) { this.triggerEvent('error', { placement: this.data.placement, detail: event.detail }) },
    onClose(event) { this.triggerEvent('close', { placement: this.data.placement, detail: event.detail }) }
  }
})
