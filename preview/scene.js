import * as THREE from 'three';
import { theme, buildDna } from './dna-theme.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    dragging = false;
    canvas.releasePointerCapture?.(event.pointerId);
    canvas.classList.remove('is-dragging');
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
    if (Array.isArray(object.material)) object.material.forEach((item) => item.dispose?.());
    else object.material?.dispose?.();
  });
  renderer.dispose();
}

export function createUniverse(canvas, cases = [], onPlanetSelect) {
  canvas.dataset.caseCount = String(cases.length);
  canvas.dataset.freeCaseCount = String(cases.filter((item) => !item.locked).length);
  const renderer = makeRenderer(canvas, { exposure: 1.26 });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(41, 1, 0.1, 100);
  addStars(scene, 1200, 24);

  scene.add(new THREE.AmbientLight('#8491ad', 1.35));
  const key = new THREE.DirectionalLight('#f4d99a', 4.6);
  key.position.set(4, 6, 7);
  scene.add(key);
  const cyanRim = new THREE.PointLight('#62c7d9', 18, 20);
  cyanRim.position.set(-4, 1, 4);
  const violetRim = new THREE.PointLight('#806be7', 13, 18);
  violetRim.position.set(4, -3, 1);
  scene.add(cyanRim, violetRim);

  const system = new THREE.Group();
  system.rotation.set(-0.1, -0.18, -0.04);
  scene.add(system);

  const core = new THREE.Group();
  system.add(core);
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
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.36, 48, 48),
    new THREE.MeshBasicMaterial({ color: '#62c7d9', transparent: true, opacity: .07, side: THREE.BackSide }),
  );
  core.add(atmosphere);
  const coreRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.62, .014, 8, 180),
    new THREE.MeshBasicMaterial({ color: '#d9bb72', transparent: true, opacity: .65 }),
  );
  coreRing.rotation.x = 1.18;
  coreRing.rotation.z = .22;
  core.add(coreRing);

  const bandRadii = [2.05, 2.58, 3.1, 3.63, 4.16];
  const bandTilt = [[.2, .04], [-.32, .12], [.42, -.08], [-.52, -.14], [.62, .18]];
  const bandColors = ['#d9bb72', '#62c7d9', '#9b87e8', '#65c799', '#aab4c7'];
  const layers = bandRadii.map((radius, band) => {
    const group = new THREE.Group();
    group.rotation.x = bandTilt[band][0];
    group.rotation.z = bandTilt[band][1];
    const ringPoints = Array.from({ length: 181 }, (_, index) => {
      const angle = index / 180 * Math.PI * 2;
      return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    });
    const orbit = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(ringPoints),
      new THREE.LineBasicMaterial({ color: bandColors[band], transparent: true, opacity: band === 0 ? .24 : .1, depthWrite: false }),
    );
    group.add(orbit);
    system.add(group);
    return { group, radius, speed: (.000016 + band * .000004) * (band % 2 ? -1 : 1) };
  });

  const clickable = [planet];
  const satelliteGeometry = new THREE.SphereGeometry(1, 16, 12);
  cases.forEach((item, index) => {
    const band = item.planet?.orbitBand ?? index % layers.length;
    const layer = layers[band];
    const slot = Math.floor(index / layers.length);
    const totalInBand = Math.ceil((cases.length - band) / layers.length);
    const angle = slot / totalInBand * Math.PI * 2 + band * .43;
    const color = item.planet?.color || bandColors[band];
    const size = item.planet?.size || .065;
    const mesh = new THREE.Mesh(
      satelliteGeometry,
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: index < 3 ? 1.05 : .65,
        metalness: .38,
        roughness: .38,
        transparent: true,
        opacity: 1,
      }),
    );
    mesh.scale.setScalar(size);
    mesh.position.set(Math.cos(angle) * layer.radius, Math.sin(angle * 2.3 + band) * .12, Math.sin(angle) * layer.radius);
    mesh.userData = { caseId: item.id, access: item.access, title: item.title };
    layer.group.add(mesh);
    clickable.push(mesh);

    if (index < 20) {
      const connection = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), mesh.position.clone()]),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: index < 3 ? .24 : .1, depthWrite: false }),
      );
      layer.group.add(connection);
    }
  });

  const drag = addPointerRotation(canvas, system, { speed: .0042 });
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
    const distance = 4.45 / Math.sin(Math.min(vertical, horizontal)) * 1.06;
    camera.position.set(0, 0, distance);
    system.position.set(0, 0, 0);
  };
  const stopResize = createResizeHandler(canvas, camera, renderer, fit);
  let frame = 0;
  let previous = performance.now();
  const animate = (now) => {
    const delta = Math.min(now - previous, 32);
    previous = now;
    if (!reduceMotion && !document.hidden && !drag.isDragging()) {
      core.rotation.y += delta * .00016;
      coreRing.rotation.z += delta * .00004;
      layers.forEach((layer) => { layer.group.rotation.y += delta * layer.speed; });
    }
    if (!document.hidden) renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  };
  frame = requestAnimationFrame(animate);

  return () => {
    cancelAnimationFrame(frame);
    stopResize();
    drag.destroy();
    canvas.removeEventListener('click', click);
    canvas.removeEventListener('pointermove', hover);
    canvas.removeEventListener('pointerdown', hideTip);
    canvas.removeEventListener('pointerleave', hideTip);
    tooltip.remove();
    satelliteGeometry.dispose();
    disposeScene(scene, renderer);
  };
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
