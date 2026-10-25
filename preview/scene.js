import * as THREE from 'three';
import { theme, buildDna } from './dna-theme.js';
import '../miniprogram/utils/orbit.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// 与原生小程序共用同一份飞行轨迹参数（miniprogram/utils/orbit.js）。
const orbitMath = globalThis.QingchuangOrbit;
const PREVIEW_ORBIT = { radiusBase: 2.05, radiusStep: .5275, speedScale: 1.08 };

function makeRenderer(canvas, options = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = options.exposure || 1.15;
  return renderer;
}

function addPointerRotation(canvas, target, options = {}) {
  let dragging = false;
  let moved = false;
  let travel = 0;
  let lastX = 0;
  let lastY = 0;
  const speed = options.speed || 0.006;

  const down = (event) => {
    dragging = true;
    moved = false;
    travel = 0;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
    canvas.classList.add('is-dragging');
    options.onDragStart?.();
  };
  const move = (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    travel += Math.hypot(dx, dy);
    if (travel > 4) moved = true;
    target.rotation.y += dx * speed;
    target.rotation.x = THREE.MathUtils.clamp(target.rotation.x + dy * speed, -0.75, 0.75);
    lastX = event.clientX;
    lastY = event.clientY;
  };
  const up = (event) => {
    if (!dragging) return;
    dragging = false;
    canvas.releasePointerCapture?.(event.pointerId);
    canvas.classList.remove('is-dragging');
    options.onDragEnd?.();
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  return {
    wasMoved: () => moved,
    isDragging: () => dragging,
    destroy() {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    },
  };
}

function addStars(scene, count, radius, seed = 7, options = {}) {
  let value = seed;
  const random = () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
  const points = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = options.color ? [new THREE.Color(options.color)] : [new THREE.Color('#d9bb72'), new THREE.Color('#aab4c7'), new THREE.Color('#62c7d9')];
  for (let i = 0; i < count; i += 1) {
    const r = radius * (0.4 + random() * 0.6);
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    points[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    points[i * 3 + 1] = r * Math.cos(phi);
    points[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const color = palette[Math.floor(random() * palette.length)];
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({ size: options.size || 0.026, vertexColors: true, transparent: true, opacity: options.opacity || 0.72 });
  scene.add(new THREE.Points(geometry, material));
}

function createResizeHandler(canvas, camera, renderer, onResize = () => {}) {
  const resize = () => {
    const width = Math.max(canvas.clientWidth, 1);
    const height = Math.max(canvas.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    onResize();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  return () => observer.disconnect();
}

function disposeScene(scene, renderer) {
  scene.traverse((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      material?.map?.dispose?.();
      material?.dispose?.();
    });
  });
  renderer.dispose();
}

// 无贴图的行星表面：球面顶点灰度噪声，材质颜色 + 顶点色叠出自然的云/陆斑驳。
function createMottledSphereGeometry(segments, rings, seed) {
  const geometry = new THREE.SphereGeometry(1, segments, rings);
  const position = geometry.attributes.position;
  const source = position.array;
  const colors = [];
  for (let index = 0; index < position.count; index += 1) {
    const x = source[index * 3];
    const y = source[index * 3 + 1];
    const z = source[index * 3 + 2];
    const wave = Math.sin(x * 3.1 + seed) * Math.cos(y * 2.3 + z * 1.7)
      + .5 * Math.sin(x * 6.7 - y * 4.9 + z * 5.3 + seed)
      + .28 * Math.cos(x * 11.3 + z * 9.1 - y * 7.7);
    const patch = .5 + .5 * Math.sin(wave * 3.4);
    const shade = .58 + .42 * patch;
    const land = .5 + .5 * Math.sin(wave * 5.1 + 1.3);
    colors.push(shade * (.9 + .1 * land), shade * (.96 + .06 * land), shade);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function glowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,242,210,.95)');
  gradient.addColorStop(.16, 'rgba(240,214,150,.55)');
  gradient.addColorStop(.44, 'rgba(120,190,215,.14)');
  gradient.addColorStop(1, 'rgba(90,150,200,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function createUniverse(canvas, cases = [], onPlanetSelect) {
  canvas.dataset.caseCount = String(cases.length);
  canvas.dataset.freeCaseCount = String(cases.filter((item) => !item.locked).length);
  const renderer = makeRenderer(canvas, { exposure: 1.18 });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(41, 1, 0.1, 100);
  addStars(scene, 600, 24, 7, { size: .019, opacity: .5 });

  // 自然光照：环境光 + 偏冷远景主光 + 位于中心的暖色“恒星”，
  // 行星朝中心一侧被照亮、背侧自然变暗。
  scene.add(new THREE.AmbientLight('#a9bcd8', .6));
  const key = new THREE.DirectionalLight('#f2f7ff', 2.2);
  key.position.set(3, 5, 7);
  scene.add(key);
  const sun = new THREE.PointLight('#ffdfb4', 3.2, 0, 2);
  sun.position.set(0, 0, 0);
  scene.add(sun);
  const fill = new THREE.PointLight('#7fa3e8', 1.2, 0, 2);
  fill.position.set(-4, 1, 4);
  scene.add(fill);

  const system = new THREE.Group();
  const initialRotation = new THREE.Euler(-0.1, -0.18, -0.04);
  system.rotation.copy(initialRotation);
  scene.add(system);
  const core = new THREE.Group();
  system.add(core);
  // 恢复最初的品牌星球：低多边形球 + 金色线框 + 金色细环。
  const planet = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.18, 6),
    new THREE.MeshPhysicalMaterial({ color: '#263653', metalness: .38, roughness: .36, clearcoat: .6, clearcoatRoughness: .58 }),
  );
  planet.userData.caseId = 'core';
  core.add(planet);
  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.205, 2),
    new THREE.MeshBasicMaterial({ color: '#e4c982', wireframe: true, transparent: true, opacity: .24 }),
  );
  core.add(wire);
  // 只在大气层边缘发光的 rim shader，避免整颗球外面出现一圈发灰的透明圆环。
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.36, 48, 48),
    new THREE.ShaderMaterial({
      uniforms: { tint: { value: new THREE.Color('#7fd0f0') }, opacity: { value: .6 } },
      vertexShader: 'varying vec3 vNormal; varying vec3 vView; void main(){ vec4 p = modelViewMatrix * vec4(position, 1.0); vNormal = normalize(normalMatrix * normal); vView = normalize(-p.xyz); gl_Position = projectionMatrix * p; }',
      fragmentShader: 'uniform vec3 tint; uniform float opacity; varying vec3 vNormal; varying vec3 vView; void main(){ float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 3.0); gl_FragColor = vec4(tint, opacity * rim); }',
      transparent: true,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  core.add(atmosphere);
  const coreRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.62, .014, 8, 180),
    new THREE.MeshBasicMaterial({ color: '#d9bb72', transparent: true, opacity: .65 }),
  );
  coreRing.rotation.x = 1.18;
  coreRing.rotation.z = .22;
  core.add(coreRing);

  const bandColors = orbitMath.RING_COLORS || ['#e0b055', '#3aa6c9', '#7a63d8', '#4cae78', '#8f9cb3'];
  // 五条同心轨道共面：一块倾斜的轨道面里只放干净的同心圆环，
  // 不再让五块倾斜面互相穿插，这是此前“散乱”的主要来源。
  const plane = new THREE.Group();
  plane.rotation.x = orbitMath.SYSTEM_TILT[0];
  plane.rotation.z = orbitMath.SYSTEM_TILT[1];
  system.add(plane);
  for (let band = 0; band < orbitMath.BAND_COUNT; band += 1) {
    const radius = orbitMath.bandRadius(band, PREVIEW_ORBIT);
    const flat = orbitMath.ringPoints(radius, 180);
    const guidePoints = [];
    for (let index = 0; index < flat.length; index += 3) guidePoints.push(new THREE.Vector3(flat[index], flat[index + 1], flat[index + 2]));
    // 自然视角里轨道是“看不见”的，只留极淡的参考线读出方向。
    const guide = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(guidePoints),
      new THREE.LineBasicMaterial({ color: '#6f7f96', transparent: true, opacity: Math.max(.08, .16 - band * .015), depthWrite: false }),
    );
    plane.add(guide);
  }

  const dustPositions = [];
  const dustColors = [];
  for (let index = 0; index < 96; index += 1) {
    const angle = index * 2.39996 + Math.sin(index * 1.7) * .6;
    const radius = 1.9 + (index * 37 % 100) / 100 * 2.35;
    dustPositions.push(Math.cos(angle) * radius, Math.sin(index * 2.3) * .045, Math.sin(angle) * radius);
    const warm = index % 3 === 0;
    dustColors.push(warm ? 1 : .72, warm ? .86 : .82, warm ? .6 : 1);
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute('color', new THREE.Float32BufferAttribute(dustColors, 3));
  const dustRing = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ size: .012, vertexColors: true, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  plane.add(dustRing);

  const clickable = [planet];
  const satelliteGeometry = createMottledSphereGeometry(24, 16, 1.7);
  const satellites = [];
  const point = { x: 0, y: 0, z: 0 };
  const orbiters = orbitMath.createOrbiters(cases.length, PREVIEW_ORBIT);
  cases.forEach((item, index) => {
    const traits = orbiters[index];
    // 自然行星色：颜色跟着轨道走（岩石灰/锈红/海蓝/气态米/冰蓝）。
    const color = orbitMath.planetColor ? orbitMath.planetColor(traits.band, index) : (item.planet?.color || '#9b87e8');
    // 尺寸由轨道决定：内圈岩石行星较小，外圈气态行星较大，同轨道统一。
    const size = orbitMath.planetSize(traits.band, index);
    const mesh = new THREE.Mesh(
      satelliteGeometry,
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: .12,
        metalness: .02,
        roughness: .78,
        vertexColors: true,
      }),
    );
    mesh.scale.setScalar(size);
    if (typeof traits.spinTilt === 'number') mesh.rotation.z = traits.spinTilt;
    orbitMath.positionAt(traits, 0, point);
    mesh.position.set(point.x, point.y, point.z);
    mesh.userData = { caseId: item.id, access: item.access, title: item.title };
    plane.add(mesh);
    clickable.push(mesh);
    satellites.push({ mesh, traits, size });
  });

  let userPaused = reduceMotion;
  let resumeDelay = 0;
  let motionSpeed = 1;
  const drag = addPointerRotation(canvas, system, {
    speed: .0042,
    onDragStart() { motionSpeed = 0; },
    onDragEnd() { resumeDelay = .8; },
  });
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = .12;
  const pointer = new THREE.Vector2();
  const tooltip = document.createElement('div');
  tooltip.className = 'universe-tip';
  tooltip.hidden = true;
  document.body.append(tooltip);
  const pick = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(clickable, false)[0];
    if (hit) return hit.object;
    // Screen-space tolerance keeps the small planets selectable on touch screens.
    let nearest = null;
    let distance = event.pointerType === 'touch' ? 16 : 10;
    const center = new THREE.Vector3();
    for (const mesh of clickable.slice(1)) {
      mesh.getWorldPosition(center);
      const world = center.clone();
      center.project(camera);
      if (center.z < -1 || center.z > 1) continue;
      const pixels = Math.hypot((center.x - pointer.x) * rect.width / 2, (center.y - pointer.y) * rect.height / 2);
      if (pixels >= distance) continue;
      // Do not open a planet concealed behind the central sphere.
      raycaster.setFromCamera(new THREE.Vector2(center.x, center.y), camera);
      const obstruction = raycaster.intersectObject(planet, false)[0];
      if (obstruction && obstruction.distance < camera.position.distanceTo(world) - .2) continue;
      nearest = mesh;
      distance = pixels;
    }
    return nearest;
  };
  const click = (event) => {
    if (drag.wasMoved()) return;
    const hit = pick(event);
    if (hit) onPlanetSelect?.(hit.userData.caseId);
  };
  const hideTip = () => { tooltip.hidden = true; };
  const hover = (event) => {
    if (drag.isDragging() || event.pointerType === 'touch') return hideTip();
    const hit = pick(event);
    if (!hit) return hideTip();
    tooltip.textContent = hit === planet ? '主体星球 · 打开全部案例' : `${hit.userData.title} · 免费全文`;
    tooltip.hidden = false;
    tooltip.style.left = `${Math.max(8, Math.min(event.clientX + 14, innerWidth - tooltip.offsetWidth - 8))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(event.clientY + 14, innerHeight - tooltip.offsetHeight - 8))}px`;
  };
  canvas.addEventListener('click', click);
  canvas.addEventListener('pointermove', hover);
  canvas.addEventListener('pointerdown', hideTip);
  canvas.addEventListener('pointerleave', hideTip);

  const fit = () => {
    const vertical = camera.fov * Math.PI / 360;
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    const distance = 4.35 / Math.sin(Math.min(vertical, horizontal)) * 1.06;
    camera.position.set(0, 0, distance);
    system.position.set(0, 0, 0);
  };
  let needsRender = true;
  const invalidate = () => { needsRender = true; };
  canvas.addEventListener('pointermove', invalidate);
  const stopResize = createResizeHandler(canvas, camera, renderer, () => { fit(); invalidate(); });
  let frame = 0;
  let previous = performance.now();
  let flightTime = 0;
  const updateSatellites = (time) => {
    for (const satellite of satellites) {
      orbitMath.positionAt(satellite.traits, time, point);
      satellite.mesh.position.set(point.x, point.y, point.z);
      // 真实透视本身已产生近大远小，不再人为缩放。
    }
  };
  updateSatellites(0);
  const syncMotionState = () => {
    const state = reduceMotion ? 'reduced' : userPaused ? 'paused' : drag.isDragging() ? 'dragging' : resumeDelay > 0 ? 'settling' : 'running';
    if (canvas.dataset.motionState !== state) canvas.dataset.motionState = state;
  };
  const visibilityChanged = () => {
    // 后台时间不推进公转，也不跳过松手后的缓冲。
    previous = performance.now();
    hideTip();
  };
  document.addEventListener('visibilitychange', visibilityChanged);
  syncMotionState();
  const animate = (now) => {
    const delta = Math.max(0, Math.min(now - previous, 50));
    previous = now;
    if (!reduceMotion && !userPaused && !document.hidden && !drag.isDragging()) {
      if (resumeDelay > 0) {
        resumeDelay = Math.max(0, resumeDelay - delta / 1000);
      } else {
        const decay = Math.exp(-delta / 450);
        const motionDelta = delta - (1 - motionSpeed) * (1 - decay) * 450;
        motionSpeed = 1 - (1 - motionSpeed) * decay;
        planet.rotation.y += motionDelta * .00028;
        wire.rotation.y += motionDelta * .0001;
        flightTime += motionDelta / 1000;
        updateSatellites(flightTime);
      }
    }
    syncMotionState();
    // Paused and reduced-motion views render only after a drag, resize or control action.
    if (!document.hidden && (needsRender || (!reduceMotion && !userPaused))) {
      renderer.render(scene, camera);
      needsRender = false;
    }
    frame = requestAnimationFrame(animate);
  };
  frame = requestAnimationFrame(animate);

  const destroy = () => {
    cancelAnimationFrame(frame);
    stopResize();
    drag.destroy();
    canvas.removeEventListener('click', click);
    canvas.removeEventListener('pointermove', hover);
    canvas.removeEventListener('pointerdown', hideTip);
    canvas.removeEventListener('pointerleave', hideTip);
    canvas.removeEventListener('pointermove', invalidate);
    document.removeEventListener('visibilitychange', visibilityChanged);
    tooltip.remove();
    satelliteGeometry.dispose();
    disposeScene(scene, renderer);
  };
  destroy.setPaused = (paused) => {
    userPaused = reduceMotion || Boolean(paused);
    motionSpeed = 0;
    if (!userPaused) resumeDelay = 0;
    syncMotionState();
    invalidate();
    return userPaused;
  };
  destroy.isPaused = () => userPaused || reduceMotion;
  destroy.resetView = () => {
    system.rotation.copy(initialRotation);
    fit();
    hideTip();
    invalidate();
  };
  return destroy;
}

export function createDnaScene(canvas, nodes, onNodeSelect) {
  const renderer = makeRenderer(canvas);
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, .1, 9);
  addStars(scene, 180, 20, 12, { size: .018, opacity: theme.stars.opacity, color: theme.stars.color });
  scene.add(new THREE.AmbientLight(theme.lighting.ambient, theme.lighting.ambientIntensity));
  const key = new THREE.DirectionalLight(theme.lighting.key, theme.lighting.keyIntensity);
  key.position.set(-3, 5, 7);
  const fill = new THREE.DirectionalLight(theme.lighting.fill, theme.lighting.fillIntensity);
  fill.position.set(4, -2, 4);
  scene.add(key, fill);

  const visual = buildDna(THREE, nodes);
  const dna = visual.group;
  dna.rotation.set(.08, 0, -.12);
  dna.scale.setScalar(.9);
  scene.add(dna);
  let selectedId = '';
  let defaultZoom = 9;
  const fit = () => {
    const tangent = Math.tan(camera.fov * Math.PI / 360);
    defaultZoom = Math.max(6.8, (visual.height / 2 + .5) * .9 / tangent * theme.geometry.framePadding, 1.8 / (tangent * camera.aspect) * 1.1);
    camera.position.set(0, theme.geometry.cameraOffsetY, defaultZoom);
  };
  const setSelected = (id, side = 'A') => {
    selectedId = id || '';
    visual.select(selectedId, side);
  };
  const drag = addPointerRotation(canvas, dna, { speed: .007 });
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const click = (event) => {
    if (drag.wasMoved()) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(visual.clickable, false)[0];
    if (hit?.object.userData.node) {
      setSelected(hit.object.userData.id, hit.object.userData.side);
      onNodeSelect(hit.object.userData.node);
    }
  };
  const wheel = (event) => {
    event.preventDefault();
    camera.position.z = THREE.MathUtils.clamp(camera.position.z + event.deltaY * .008, defaultZoom * .65, defaultZoom * 1.8);
  };
  canvas.addEventListener('click', click);
  canvas.addEventListener('wheel', wheel, { passive: false });
  const stopResize = createResizeHandler(canvas, camera, renderer, fit);
  let frame = 0;
  const animate = () => {
    if (!reduceMotion && !selectedId && !drag.isDragging()) dna.rotation.y += .0015;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  };
  frame = requestAnimationFrame(animate);

  return {
    setSelected,
    zoom(amount) {
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + amount, defaultZoom * .65, defaultZoom * 1.8);
    },
    reset() {
      dna.rotation.set(.08, 0, -.12);
      camera.position.z = defaultZoom;
    },
    destroy() {
      cancelAnimationFrame(frame);
      stopResize();
      drag.destroy();
      canvas.removeEventListener('click', click);
      canvas.removeEventListener('wheel', wheel);
      disposeScene(scene, renderer);
    },
  };
}
