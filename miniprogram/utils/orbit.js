/**
 * 首页商业星球 —— 行星系统轨道参数（原生小程序与浏览器预览共用）
 *
 * 2026-10-24 第三版：按“自然行星系统”重做。
 * - 五条近似共面的轨道，行星按等角距分布，同向公转、内圈快外圈慢；
 * - 每颗行星有极小的偏心率和轨道倾角（≤6% / ≤1.4°），像自然天体而不是刻度盘；
 * - 颜色改用自然行星色系（岩石灰、锈红、海蓝、气态米、冰蓝），不再用霓虹色；
 * - 同轨道共享角速度，队形稳定；参数确定性生成，重建/降级后画面一致。
 *
 * 同时被 WeChat CommonJS 和浏览器 ESM 使用，文件末尾按两种环境导出；不要改成 export。
 */
const universeOrbit = (() => {
  const TAU = Math.PI * 2
  const BAND_COUNT = 5
  const PLANETS_PER_BAND = 20
  const TRAIL_POINTS = 14

  // 整个行星系统共用一块轻微倾斜的轨道面：像从斜上方看一个自然的行星系统。
  const SYSTEM_TILT = [0.46, -0.03]

  const DEFAULT_OPTIONS = {
    bands: BAND_COUNT,
    radiusBase: 2.30,
    radiusStep: 0.44,
    baseSpeed: 0.115,
    speedScale: 1,
    perBand: PLANETS_PER_BAND
  }

  const BAND_STAGGER = 2.4

  // 自然行星色：内圈岩石灰、锈红，中圈海蓝，外圈气态米色与冰蓝。
  const RING_COLORS = ['#9a8f82', '#b4835c', '#5f86ad', '#b9a27a', '#9fb4c4']

  function hash(seed) {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453123
    return value - Math.floor(value)
  }

  function bandRadius(band, options = {}) {
    const config = { ...DEFAULT_OPTIONS, ...options }
    return config.radiusBase + (band % config.bands) * config.radiusStep
  }

  function bandSpeed(band, options = {}) {
    const config = { ...DEFAULT_OPTIONS, ...options }
    return config.baseSpeed * config.speedScale * Math.pow(config.radiusBase / bandRadius(band, config), 1.5)
  }

  // 自然行星尺寸：内圈岩石行星小，外圈气态行星大；同轨道尺寸一致，队形干净。
  function planetSize(band, index) {
    return Math.max(0.05, 0.052 + band * 0.012)
  }

  // 自然行星颜色：以轨道色为底，只做 ±6% 的明暗差异，避免同一轨道像复制粘贴。
  function planetColor(band, index) {
    const base = RING_COLORS[band % RING_COLORS.length]
    const brightness = 1.0 + hash(index * 5.13 + band) * 0.2
    const value = parseInt(base.slice(1), 16)
    const channel = shift => Math.max(0, Math.min(255, Math.round(((value >> shift) & 0xff) * brightness)))
    return '#' + [channel(16), channel(8), channel(0)].map(channelValue => channelValue.toString(16).padStart(2, '0')).join('')
  }

  function createOrbiter(index, options = {}) {
    const config = { ...DEFAULT_OPTIONS, ...options }
    const band = index % config.bands
    const slot = Math.floor(index / config.bands)
    const perBand = Math.max(1, config.perBand)
    const step = TAU / perBand
    return {
      index,
      band,
      slot,
      radius: bandRadius(band, config),
      speed: bandSpeed(band, config),
      // 等角距 + 轨道间小幅错位，整体仍是一个规整的行星系统。
      phase: slot * step + band * step * BAND_STAGGER,
      // 自然天体不是正圆：很小的偏心率，方向一致。
      eccentricity: 0.015 + hash(index * 4.7 + 1) * 0.045,
      periapsis: hash(index * 8.3 + 2) * TAU,
      // 极小的轨道倾角（约 ±1.4°），让轨道有自然的立体层次。
      inclination: (hash(index * 2.13 + 3) - 0.5) * 0.05,
      spinSpeed: 0.006 + hash(index * 3.17 + 1) * 0.012,
      // 自转轴倾角，行星看起来像自然天体。
      spinTilt: (hash(index * 7.31 + 2) - 0.5) * 1.4
    }
  }

  function createOrbiters(count, options = {}) {
    const config = { ...DEFAULT_OPTIONS, ...options }
    if (!options.perBand) config.perBand = Math.max(1, Math.ceil(count / config.bands))
    const orbiters = []
    for (let index = 0; index < count; index += 1) orbiters.push(createOrbiter(index, config))
    return orbiters
  }

  /**
   * 计算某个时刻行星在轨道面局部坐标中的位置：
   * 椭圆轨道 + 近日点方位角 + 小幅轨道倾角，和真实天体的运动方式一致。
   */
  function positionAt(orbiter, time, out) {
    const theta = orbiter.phase + orbiter.speed * time
    const eccentricity = orbiter.eccentricity || 0
    const radius = orbiter.radius * (1 - eccentricity * eccentricity) / (1 + eccentricity * Math.cos(theta))
    const planeX = Math.cos(theta) * radius
    const planeZ = Math.sin(theta) * radius
    const periapsis = orbiter.periapsis || 0
    const cosP = Math.cos(periapsis)
    const sinP = Math.sin(periapsis)
    const x = planeX * cosP - planeZ * sinP
    const z0 = planeX * sinP + planeZ * cosP
    const inclination = orbiter.inclination || 0
    const y = z0 * Math.sin(inclination)
    const z = z0 * Math.cos(inclination)
    if (out) {
      out.x = x
      out.y = y
      out.z = z
      return out
    }
    return { x, y, z }
  }

  // 轨道参考环（LineLoop 用）。自然视角下轨道线很淡，只是帮助读出方向。
  function ringPoints(radius, segments = 180) {
    const points = []
    for (let index = 0; index < segments; index += 1) {
      const angle = index / segments * TAU
      points.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
    }
    return points
  }

  return {
    TAU,
    BAND_COUNT,
    PLANETS_PER_BAND,
    TRAIL_POINTS,
    SYSTEM_TILT,
    DEFAULT_OPTIONS,
    BAND_STAGGER,
    RING_COLORS,
    bandRadius,
    bandSpeed,
    planetSize,
    planetColor,
    createOrbiter,
    createOrbiters,
    positionAt,
    ringPoints
  }
})()

// 同一份参数供 WeChat CommonJS 与浏览器预览 ESM 使用。
if (typeof module !== 'undefined' && module.exports) {
  module.exports = universeOrbit
} else {
  globalThis.QingchuangOrbit = universeOrbit
}
