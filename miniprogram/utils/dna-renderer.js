// The same geometry factory runs in scoped mini-program Three.js and the web preview.
function createDnaRenderer(theme) {
  function stageForNode(node = {}) {
    const id = theme.stages[node.stage] ? node.stage : (theme.nodeStages[node.type || node.id] || theme.defaultStage)
    return { id, ...theme.stages[id] }
  }

  function describeNode(node, side = 'A') {
    const stage = stageForNode(node)
    return { ...node, color: stage.color, stage: stage.id, stageLabel: stage.label, visualChain: side, visualChainLabel: theme.chains[side].label }
  }

  function rungColor(color) {
    const channel = (hex, index) => parseInt(hex.slice(index, index + 2), 16)
    return '#' + [1, 3, 5].map(index => Math.round(channel(color, index) * (1 - theme.rung.neutralMix) + channel(theme.rung.neutral, index) * theme.rung.neutralMix).toString(16).padStart(2, '0')).join('')
  }

  function colorForThree(THREE, hex) {
    const color = new THREE.Color(hex)
    // r108 does not automatically linearize CSS colors like current Three.js.
    if (!THREE.ColorManagement) color.convertSRGBToLinear()
    return color
  }

  function buildDna(THREE, nodes = []) {
    const colorOf = hex => colorForThree(THREE, hex)
    const group = new THREE.Group()
    const clickable = []
    const bubbles = []
    const height = Math.max(0, nodes.length - 1) * theme.geometry.rowSpacing
    const pointAt = (progress, side) => {
      const angle = progress * Math.max(0, nodes.length - 1) * theme.geometry.angleStep + (side === 'B' ? Math.PI : 0)
      return new THREE.Vector3(Math.cos(angle) * theme.geometry.radius, (progress - .5) * height, Math.sin(angle) * theme.geometry.radius)
    }

    if (nodes.length > 1) {
      ;['A', 'B'].forEach(side => {
        const points = Array.from({ length: nodes.length * 24 + 1 }, (_, i) => pointAt(i / (nodes.length * 24), side))
        const color = colorOf(theme.chains[side].color)
        const mesh = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), nodes.length * 24, theme.skeleton.radius, 8, false),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: theme.skeleton.emissiveIntensity, roughness: theme.skeleton.roughness, metalness: theme.skeleton.metalness, transparent: true, opacity: theme.skeleton.opacity })
        )
        mesh.userData = { role: 'skeleton', side }
        group.add(mesh)
      })
    }

    nodes.forEach((node, index) => {
      const progress = nodes.length > 1 ? index / (nodes.length - 1) : .5
      const a = pointAt(progress, 'A')
      const b = pointAt(progress, 'B')
      const stage = stageForNode(node)
      const direction = b.clone().sub(a)
      const rung = new THREE.Mesh(
        new THREE.CylinderGeometry(theme.rung.radius, theme.rung.radius, direction.length(), 8),
        new THREE.MeshBasicMaterial({ color: colorOf(rungColor(stage.color)), transparent: true, opacity: theme.rung.opacity, depthWrite: false })
      )
      rung.position.copy(a.clone().add(b).multiplyScalar(.5))
      rung.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
      rung.userData = { role: 'rung', nodeId: node.id, stage: stage.id }
      group.add(rung)

      ;[['A', a], ['B', b]].forEach(([side, position]) => {
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(theme.bubble.radius, 28, 20),
          new THREE.MeshPhongMaterial({ color: colorOf(stage.color), emissive: colorOf(stage.color), emissiveIntensity: theme.bubble.emissiveIntensity, specular: colorOf(theme.bubble.specular), shininess: theme.bubble.shininess })
        )
        sphere.position.copy(position)
        sphere.userData = { role: 'bubble', id: node.id, title: node.name, node: describeNode(node, side), index, side, stage: stage.id }
        const glint = new THREE.Mesh(new THREE.SphereGeometry(.058, 12, 8), new THREE.MeshBasicMaterial({ color: colorOf(theme.bubble.highlight), transparent: true, opacity: theme.bubble.highlightOpacity, depthWrite: false }))
        glint.position.set(-.075, .09, .208)
        glint.scale.set(1, .6, .2)
        sphere.add(glint)
        const glow = new THREE.Mesh(new THREE.SphereGeometry(theme.bubble.radius * 1.23, 18, 12), new THREE.MeshBasicMaterial({ color: colorOf(stage.color), transparent: true, opacity: theme.bubble.glowOpacity, blending: THREE.AdditiveBlending, depthWrite: false }))
        glow.position.copy(position)
        const outward = new THREE.Vector3(position.x, .12, position.z).normalize()
        const end = position.clone().add(outward.multiplyScalar(theme.leader.length))
        const leader = new THREE.Line(new THREE.BufferGeometry().setFromPoints([position, end]), new THREE.LineBasicMaterial({ color: colorOf(stage.color), transparent: true, opacity: theme.leader.opacity, depthWrite: false }))
        leader.visible = false
        leader.userData = { role: 'leader', nodeId: node.id, side }
        group.add(sphere, glow, leader)
        clickable.push(sphere)
        bubbles.push({ sphere, glow, leader })
      })
    })

    function select(id, side = 'A') {
      bubbles.forEach(({ sphere, glow, leader }) => {
        const active = sphere.userData.id === id && sphere.userData.side === side
        sphere.scale.setScalar(active ? theme.bubble.selectedScale : 1)
        glow.scale.setScalar(active ? theme.bubble.selectedScale : 1)
        glow.material.opacity = active ? theme.bubble.selectedGlowOpacity : theme.bubble.glowOpacity
        leader.visible = active
      })
    }

    return { group, clickable, select, pointAt, height }
  }

  function drawFallbackDna(ctx, width, height, nodes, selectedId, selectedSide = 'A') {
    const points = []
    const radius = theme.fallback.bubbleRadius
    const margin = radius * 3.6
    const halfWave = Math.min(width * .23, 78)
    const pointAt = (progress, side) => {
      const wave = Math.cos(progress * Math.max(0, nodes.length - 1) * theme.geometry.angleStep) * halfWave
      return { x: width / 2 + (side === 'A' ? wave : -wave), y: margin + progress * (height - margin * 2) }
    }
    ctx.save()
    ctx.lineCap = 'round'
    if (nodes.length > 1) {
      ;['A', 'B'].forEach(side => {
        ctx.beginPath()
        for (let i = 0; i <= 100; i++) {
          const p = pointAt(i / 100, side)
          if (i === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        }
        ctx.globalAlpha = theme.skeleton.opacity
        ctx.strokeStyle = theme.chains[side].color
        ctx.lineWidth = theme.fallback.strandWidth
        ctx.stroke()
      })
    }
    nodes.forEach((node, index) => {
      const p = nodes.length > 1 ? index / (nodes.length - 1) : .5
      const a = pointAt(p, 'A')
      const b = pointAt(p, 'B')
      const stage = stageForNode(node)
      ctx.globalAlpha = theme.rung.opacity
      ctx.lineWidth = theme.fallback.rungWidth
      ctx.strokeStyle = rungColor(stage.color)
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      ;[['A', a], ['B', b]].forEach(([side, point]) => {
        const active = node.id === selectedId && side === selectedSide
        const size = radius * (active ? theme.bubble.selectedScale : 1)
        if (active) {
          const offset = point.x < width / 2 ? -radius * 3 : radius * 3
          ctx.strokeStyle = stage.color
          ctx.globalAlpha = theme.leader.opacity
          ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.lineTo(point.x + offset, point.y - 4); ctx.stroke()
        }
        ctx.globalAlpha = 1
        const gradient = ctx.createRadialGradient(point.x - size * .3, point.y - size * .4, 0, point.x, point.y, size)
        gradient.addColorStop(0, theme.bubble.highlight)
        gradient.addColorStop(.28, stage.color)
        gradient.addColorStop(1, stage.color)
        ctx.fillStyle = gradient
        ctx.shadowColor = stage.color
        ctx.shadowBlur = active ? 10 : 3
        ctx.beginPath(); ctx.arc(point.x, point.y, size, 0, Math.PI * 2); ctx.fill()
        ctx.shadowBlur = 0
        points.push({ ...point, item: describeNode(node, side), side })
      })
    })
    ctx.restore()
    return points
  }

  return { theme, buildDna, drawFallbackDna, stageForNode, describeNode, rungColor, colorForThree }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = createDnaRenderer(require('../config/dna-theme'))
} else {
  globalThis.QingchuangDnaRenderer = createDnaRenderer
}
