const rungs = Array.from({ length: 10 }, (_, index) => {
  const wave = Math.sin(index * .9) * 28
  const first = 50 + wave
  const second = 50 - wave
  return {
    id: index,
    left: 5 + index * 10,
    first,
    second,
    bridgeTop: Math.min(first, second),
    bridgeHeight: Math.abs(first - second)
  }
})

Component({
  properties: { tone: { type: String, value: 'gold' } },
  data: { rungs }
})
