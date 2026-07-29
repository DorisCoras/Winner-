/* ==========================================================================
   Winner Marble — 3B sahneler (Three.js)

   İki sahne kurar:
     1. Hero: dönen, cilalı mermer monolit + yüzen cam parçaları
     2. Ürün görüntüleyici: sürüklenerek döndürülen mermer plaka

   Modül yüklenemezse (eski tarayıcı / WebGL yok) sayfa
   .hero__fallback görseliyle sorunsuz çalışmaya devam eder.
   ========================================================================== */

import * as THREE from '../vendor/three.module.min.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* -------------------------------------------------------------------------
   WebGL kullanılabilirlik denetimi
   ------------------------------------------------------------------------- */
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

/* -------------------------------------------------------------------------
   Stüdyo ortam haritası — canvas'tan equirectangular gradyan üretilir.
   Cilalı taşın yansımaları bu haritadan gelir.
   ------------------------------------------------------------------------- */
function buildEnvironment(renderer) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d');

  // Tavan aydınlık, zemin koyu — klasik stüdyo kutusu
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.00, '#fbf6ec');
  g.addColorStop(0.30, '#cfc7ba');
  g.addColorStop(0.52, '#4c4a48');
  g.addColorStop(0.78, '#17171a');
  g.addColorStop(1.00, '#0a0a0c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);

  // Sıcak anahtar ışık
  const key = ctx.createRadialGradient(300, 120, 10, 300, 120, 260);
  key.addColorStop(0, 'rgba(255, 240, 210, 1)');
  key.addColorStop(1, 'rgba(255, 240, 210, 0)');
  ctx.fillStyle = key;
  ctx.fillRect(0, 0, 1024, 512);

  // Soğuk dolgu ışık (karşı taraf)
  const fill = ctx.createRadialGradient(760, 190, 10, 760, 190, 230);
  fill.addColorStop(0, 'rgba(190, 215, 255, 0.85)');
  fill.addColorStop(1, 'rgba(190, 215, 255, 0)');
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, 1024, 512);

  // Altın aksan yansıması
  const gold = ctx.createRadialGradient(540, 300, 5, 540, 300, 150);
  gold.addColorStop(0, 'rgba(201, 164, 76, 0.75)');
  gold.addColorStop(1, 'rgba(201, 164, 76, 0)');
  ctx.fillStyle = gold;
  ctx.fillRect(0, 0, 1024, 512);

  // Uzun softbox şeritleri — plaka yüzeyinde kayan çizgisel parlamalar
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillRect(80, 40, 360, 16);
  ctx.fillRect(600, 70, 300, 10);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromEquirectangular(tex).texture;

  pmrem.dispose();
  tex.dispose();
  return env;
}

/* -------------------------------------------------------------------------
   Köşeleri yuvarlatılmış, pahlı plaka geometrisi
   ------------------------------------------------------------------------- */
function roundedSlab(w, h, d, r) {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;

  shape.moveTo(x, y + r);
  shape.lineTo(x, y + h - r);
  shape.quadraticCurveTo(x, y + h, x + r, y + h);
  shape.lineTo(x + w - r, y + h);
  shape.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
  shape.lineTo(x + w, y + r);
  shape.quadraticCurveTo(x + w, y, x + w - r, y);
  shape.lineTo(x + r, y);
  shape.quadraticCurveTo(x, y, x, y + r);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: d * 0.16,
    bevelSize: d * 0.16,
    bevelOffset: 0,
    bevelSegments: 4,
    curveSegments: 14
  });

  geo.center();
  geo.computeBoundingBox();

  // ExtrudeGeometry UV'leri dünya birimindedir; 0..1 aralığına taşı
  const bb = geo.boundingBox;
  const sx = bb.max.x - bb.min.x;
  const sy = bb.max.y - bb.min.y;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(
      i,
      (pos.getX(i) - bb.min.x) / sx,
      (pos.getY(i) - bb.min.y) / sy
    );
  }
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/* -------------------------------------------------------------------------
   Doku yükleyici — renk uzayı ve filtreleme ayarlarıyla
   ------------------------------------------------------------------------- */
const loader = new THREE.TextureLoader();

function loadTexture(url, renderer, onDone) {
  loader.load(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    if (onDone) onDone(tex);
  }, undefined, () => { /* doku yoksa düz malzemeyle devam */ });
}

/* =========================================================================
   1. HERO SAHNESİ
   ========================================================================= */
function initHeroScene(host) {
  const texUrl = host.getAttribute('data-texture');
  const roughUrl = host.getAttribute('data-roughness');

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.86;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const env = buildEnvironment(renderer);
  scene.environment = env;
  registerScene(renderer, scene);

  const camera = new THREE.PerspectiveCamera(
    36, host.clientWidth / host.clientHeight, 0.1, 100
  );
  camera.position.set(0, 0, 9.2);

  // --- Mermer monolit ---
  const group = new THREE.Group();
  // Metin solda durduğu için kütle sağa kaydırılır
  group.position.x = window.innerWidth < 900 ? 0 : 1.9;
  scene.add(group);

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.16,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    envMapIntensity: 0.85,
    reflectivity: 0.55
  });

  if (texUrl) {
    loadTexture(texUrl, renderer, (t) => {
      material.map = t;
      material.needsUpdate = true;
    });
  }
  if (roughUrl) {
    loader.load(roughUrl, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      material.roughnessMap = t;
      material.needsUpdate = true;
    }, undefined, () => {});
  }

  const slab = new THREE.Mesh(roundedSlab(2.6, 3.7, 0.38, 0.14), material);
  slab.rotation.set(-0.12, -0.5, 0.04);
  group.add(slab);

  // --- Yüzen cam parçaları (sıvı cam hissi) ---
  const isSmall = window.innerWidth < 820;
  const glassBits = [];
  if (!isSmall) {
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 1.0,
      thickness: 0.9,
      roughness: 0.06,
      ior: 1.5,
      metalness: 0,
      clearcoat: 1,
      envMapIntensity: 1.5,
      transparent: true,
      opacity: 1
    });

    const shapes = [
      new THREE.IcosahedronGeometry(0.44, 0),
      new THREE.TorusGeometry(0.42, 0.13, 16, 44),
      new THREE.OctahedronGeometry(0.36, 0)
    ];

    const spots = [
      [-3.05, 1.45, 1.5],
      [2.95, -1.35, 1.1],
      [-2.35, -1.85, 0.6]
    ];

    spots.forEach((p, i) => {
      const m = new THREE.Mesh(shapes[i % shapes.length], glassMat);
      m.position.set(p[0], p[1], p[2]);
      m.userData.phase = i * 2.1;
      m.userData.baseY = p[1];
      group.add(m);
      glassBits.push(m);
    });
  }

  // --- Altın toz zerrecikleri ---
  const dustCount = isSmall ? 90 : 220;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3]     = (Math.random() - 0.5) * 16;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 10;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xc9a44c,
    size: 0.032,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  scene.add(dust);

  // --- Işıklar ---
  const key = new THREE.DirectionalLight(0xfff2d8, 1.35);
  key.position.set(4, 6, 6);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xbcd4ff, 0.85);
  rim.position.set(-6, -2, -4);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(0xffffff, 0.16));

  // --- Etkileşim ---
  let pointerX = 0, pointerY = 0;
  let targetX = 0, targetY = 0;
  let scrollNorm = 0;

  window.addEventListener('pointermove', (e) => {
    targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  window.addEventListener('scroll', () => {
    scrollNorm = Math.min(1.6, (window.pageYOffset || 0) / Math.max(1, window.innerHeight));
  }, { passive: true });

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    const aspect = w / h;
    camera.aspect = aspect;
    // Dar/dikey ekranlarda yatay görüş alanı daralır; kütle ekranı doldurmasın
    camera.position.z = aspect < 0.9 ? 15.5 : (aspect < 1.4 ? 11.5 : 9.2);
    group.position.x = aspect < 1.1 ? 0 : 1.9;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  // Görünmezken render etme
  let visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    }, { threshold: 0 }).observe(host);
  }

  const clock = new THREE.Clock();

  function animate() {
    // Sahne serbest bırakılmışsa döngüyü yeniden kurma
    if (!renderer.domElement.isConnected) return;
    requestAnimationFrame(animate);
    if (!visible) return;

    const t = clock.getElapsedTime();
    pointerX += (targetX - pointerX) * 0.045;
    pointerY += (targetY - pointerY) * 0.045;

    if (!reduced) {
      // Yavaş kendi ekseninde dönüş + imleç eğimi + kaydırma tepkisi
      slab.rotation.y = -0.5 + t * 0.16 + pointerX * 0.42;
      slab.rotation.x = -0.12 + pointerY * 0.22 - scrollNorm * 0.30;
      slab.position.y = Math.sin(t * 0.55) * 0.10 - scrollNorm * 1.5;
      slab.position.x = pointerX * 0.18;

      group.position.z = -scrollNorm * 2.2;

      glassBits.forEach((m, i) => {
        m.rotation.x = t * (0.24 + i * 0.07);
        m.rotation.y = t * (0.19 + i * 0.05);
        m.position.y = m.userData.baseY + Math.sin(t * 0.7 + m.userData.phase) * 0.28;
      });

      dust.rotation.y = t * 0.022;
      dust.position.y = -scrollNorm * 0.8;
    }

    renderer.render(scene, camera);
  }

  animate();
  resize();
  host.classList.add('is-ready');
}

/* =========================================================================
   2. ÜRÜN GÖRÜNTÜLEYİCİ — sürüklenebilir plaka
   ========================================================================= */
function initStoneViewer(host) {
  const texUrl = host.getAttribute('data-texture');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = buildEnvironment(renderer);
  registerScene(renderer, scene);

  const camera = new THREE.PerspectiveCamera(
    34, host.clientWidth / host.clientHeight, 0.1, 100
  );
  camera.position.set(0, 0, 8.4);

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.12,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.3
  });

  if (texUrl) {
    loadTexture(texUrl, renderer, (t) => {
      material.map = t;
      material.needsUpdate = true;
    });
  }

  const slab = new THREE.Mesh(roundedSlab(2.9, 3.9, 0.34, 0.12), material);
  scene.add(slab);

  const key = new THREE.DirectionalLight(0xfff4e2, 2.0);
  key.position.set(3, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe0ff, 1.1);
  rim.position.set(-5, -2, -3);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  // --- Sürükleyerek döndürme ---
  let rotX = -0.10, rotY = -0.42;
  let targetRotX = rotX, targetRotY = rotY;
  let dragging = false;
  let lastX = 0, lastY = 0;
  let idle = true;

  host.addEventListener('pointerdown', (e) => {
    dragging = true;
    idle = false;
    host.classList.add('is-touched');
    lastX = e.clientX;
    lastY = e.clientY;
    host.setPointerCapture(e.pointerId);
  });

  host.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    targetRotY += (e.clientX - lastX) * 0.008;
    targetRotX += (e.clientY - lastY) * 0.006;
    targetRotX = Math.max(-0.9, Math.min(0.9, targetRotX));
    lastX = e.clientX;
    lastY = e.clientY;
  });

  function endDrag(e) {
    dragging = false;
    if (e && e.pointerId != null && host.hasPointerCapture(e.pointerId)) {
      host.releasePointerCapture(e.pointerId);
    }
  }
  host.addEventListener('pointerup', endDrag);
  host.addEventListener('pointercancel', endDrag);
  host.addEventListener('pointerleave', endDrag);

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  let visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    }, { threshold: 0 }).observe(host);
  }

  const clock = new THREE.Clock();

  function animate() {
    if (!renderer.domElement.isConnected) return;
    requestAnimationFrame(animate);
    if (!visible) return;

    // Dokunulmadıysa kendi kendine yavaşça döner
    if (idle && !reduced) targetRotY += 0.0022;

    rotX += (targetRotX - rotX) * 0.08;
    rotY += (targetRotY - rotY) * 0.08;

    slab.rotation.x = rotX;
    slab.rotation.y = rotY;
    if (!reduced) slab.position.y = Math.sin(clock.getElapsedTime() * 0.6) * 0.045;

    renderer.render(scene, camera);
  }

  animate();
  resize();
  host.classList.add('is-ready');
}

/* =========================================================================
   Başlat
   ========================================================================= */
/* Kurulan sahneler. Tek dosyalık sürümde sayfa değişince serbest bırakılır;
   aksi hâlde tarayıcının WebGL bağlam sınırı (~16) hızla dolar. */
const liveScenes = [];

function registerScene(renderer, scene) {
  liveScenes.push({ renderer, scene });
}

function disposeScenes() {
  while (liveScenes.length) {
    const { renderer, scene } = liveScenes.pop();
    try {
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
        mats.forEach((m) => {
          Object.keys(m).forEach((k) => {
            const v = m[k];
            if (v && v.isTexture) v.dispose();
          });
          m.dispose();
        });
      });
      if (scene.environment) scene.environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    } catch (e) { /* temizlik hatası sayfayı düşürmesin */ }
  }
}

function mountScenes() {
  if (!hasWebGL()) return;

  const hero = document.querySelector('[data-scene="hero"]:not(.is-ready)');
  if (hero) {
    try { initHeroScene(hero); } catch (e) { /* fallback görsel devrede kalır */ }
  }

  document.querySelectorAll('[data-scene="stone"]:not(.is-ready)').forEach((el) => {
    try { initStoneViewer(el); } catch (e) { /* sessizce atla */ }
  });
}

window.WinnerScene = { mount: mountScenes, dispose: disposeScenes };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountScenes);
} else {
  mountScenes();
}
