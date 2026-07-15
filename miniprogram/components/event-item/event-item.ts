Component({
  properties: {
    title: { type: String, value: '' },
    platform: { type: String, value: '' },
    platformLabel: { type: String, value: '' },
    sentiment: { type: String, value: 'neutral' },
    sentimentLabel: { type: String, value: '中性' },
    author: { type: String, value: '' },
    time: { type: String, value: '' },
    eventId: { type: Number, value: 0 },
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', { id: this.data.eventId })
    },
  },
})
