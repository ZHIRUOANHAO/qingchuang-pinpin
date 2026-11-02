const STORAGE_KEY = 'onboardingQuickstartV1'
const GUIDE_URL = '/onboarding/pages/guide/guide'
let dismissedInSession = false

function shouldOffer() {
  if (dismissedInSession) return false
  try {
    const value = wx.getStorageSync(STORAGE_KEY)
    return !(value && value.version === 1 && ['skipped', 'opened', 'completed'].includes(value.status))
  } catch (error) {
    return true
  }
}

function dismiss(status = 'skipped') {
  dismissedInSession = true
  try { wx.setStorageSync(STORAGE_KEY, { version: 1, status, updatedAt: Date.now() }) } catch (error) {}
}

module.exports = { STORAGE_KEY, GUIDE_URL, shouldOffer, dismiss }
