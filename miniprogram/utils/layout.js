function customTopInset(system = {}, capsule = {}) {
  const status = Number.isFinite(system.statusBarHeight) ? Math.max(0, system.statusBarHeight) : 24
  const bottom = Number.isFinite(capsule.bottom) && capsule.bottom > status && capsule.bottom < status + 100 ? capsule.bottom : status + 40
  return Math.max(status + 44, bottom + 8)
}

module.exports = { customTopInset }
