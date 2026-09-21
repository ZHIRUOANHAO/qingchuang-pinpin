Component({
  properties: {
    type: { type: String, value: 'empty' },
    title: { type: String, value: '暂无内容' },
    description: { type: String, value: '' },
    actionText: { type: String, value: '' }
  },
  data: { symbols: { empty: '○', error: '!', network: '↻', denied: '×' } },
  methods: { onAction() { this.triggerEvent('action') } }
})

