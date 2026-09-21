const enabled = false

const slots = {
  homeFeed: { placement: 'home_after_recommendation', unitId: '', adType: 'banner' },
  casesFeed: { placement: 'cases_after_first_page', unitId: '', adType: 'banner' },
  aiResult: { placement: 'ai_after_result', unitId: '', adType: 'banner' },
  profileCenter: { placement: 'profile_after_assets', unitId: '', adType: 'banner' }
}

function getSlot(name) {
  const slot = slots[name] || { placement: name, unitId: '', adType: 'banner' }
  return { ...slot, enabled: enabled && Boolean(slot.unitId) }
}

module.exports = { enabled, slots, getSlot }
