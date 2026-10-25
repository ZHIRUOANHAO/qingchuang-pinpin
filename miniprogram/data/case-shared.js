const palette = [0xd9bb72, 0x62c7d9, 0x9b87e8, 0x65c799, 0xd98f72, 0xc7a8dc]

function difficultyValue(label = '') {
  if (label.startsWith('入门')) return 2
  if (label.startsWith('中高')) return 3
  return 5
}

function shortTitle(name) {
  return name.split('：')[0].slice(0, 12)
}

function planetForIndex(index) {
  return {
    color: palette[index % palette.length],
    orbit: 2.8 + (index % 6) * .35,
    size: index < 3 ? .26 : .18
  }
}

module.exports = { difficultyValue, shortTitle, planetForIndex }
