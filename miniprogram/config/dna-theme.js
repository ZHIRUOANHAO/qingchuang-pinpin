const dnaTheme = {
  "version": "0.2",
  "chains": {
    "A": { "label": "A · 公域增长链", "color": "#A4B1BB" },
    "B": { "label": "B · 私域经营链", "color": "#B8B1A5" }
  },
  "stages": {
    "validation": { "label": "验证", "color": "#FFF3DA" },
    "coldStart": { "label": "冷启动", "color": "#9BD5F3" },
    "monetization": { "label": "变现跑通", "color": "#A8E5C5" },
    "operations": { "label": "稳定运营", "color": "#F4EAA1" },
    "compliance": { "label": "风控合规", "color": "#D0BCEE" }
  },
  "nodeStages": {
    "exposure": "coldStart", "traffic": "coldStart",
    "nurture": "validation", "conversion": "validation",
    "transaction": "monetization", "delivery": "monetization",
    "retention": "operations", "referral": "operations", "profit": "operations",
    "risk": "compliance"
  },
  "defaultStage": "validation",
  "skeleton": { "radius": 0.037, "emissiveIntensity": 0.04, "roughness": 0.7, "metalness": 0.02, "opacity": 0.72 },
  "bubble": { "radius": 0.245, "emissiveIntensity": 0.13, "shininess": 90, "specular": "#FFFFFF", "highlight": "#FFFFFF", "highlightOpacity": 0.5, "glowOpacity": 0.035, "selectedGlowOpacity": 0.12, "selectedScale": 1.14 },
  "rung": { "radius": 0.022, "neutral": "#CCD0D2", "neutralMix": 0.55, "opacity": 0.28 },
  "leader": { "opacity": 0.32, "length": 0.6 },
  "lighting": { "ambient": "#FFFFFF", "ambientIntensity": 0.72, "key": "#FFFFFF", "keyIntensity": 0.95, "fill": "#D8E1E9", "fillIntensity": 0.35 },
  "stars": { "color": "#BAC3D0", "opacity": 0.22 },
  "geometry": { "radius": 1.12, "rowSpacing": 0.55, "angleStep": 0.88, "framePadding": 1.4, "contentFramePadding": 1.16, "cameraOffsetY": -0.2 },
  "fallback": { "strandWidth": 2, "rungWidth": 1.3, "bubbleRadius": 8 }
}

// One palette for WeChat CommonJS and the browser preview.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = dnaTheme
} else {
  globalThis.QingchuangDnaTheme = dnaTheme
}
