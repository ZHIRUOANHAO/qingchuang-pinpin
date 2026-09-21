function money(value) {
  return `¥${Number(value || 0).toFixed(value % 1 ? 1 : 0)}`
}

function riskLabel(value) {
  if (value >= 70) return '高风险'
  if (value >= 40) return '需留意'
  return '风险可控'
}

function difficultyLabel(value) {
  const labels = ['入门', '较低', '中等', '较高', '专业']
  return labels[Math.max(0, Math.min(4, Number(value) - 1))]
}

function dateTime(timestamp = Date.now()) {
  const date = new Date(timestamp)
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

module.exports = { money, riskLabel, difficultyLabel, dateTime }

