// Viewer 3D de la table MP-01 — chargement différé, rendu en pause hors écran.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

(function () {
  var stage = document.getElementById('table3d-stage');
  if (!stage) return;
  var canvas = stage.querySelector('canvas');
  var hint = stage.querySelector('.p3d-hint');

  // WebGL dispo ?
  try {
    var test = document.createElement('canvas');
    if (!(test.getContext('webgl2') || test.getContext('webgl'))) { stage.classList.add('p3d-nowebgl'); return; }
  } catch (e) { stage.classList.add('p3d-nowebgl'); return; }

  var inited = false, running = false, renderer, scene, camera, controls, raf = null;
  var sun = null, t0 = 0;

  function size() {
    var r = stage.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  }

  function init() {
    if (inited) return; inited = true;

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    var s = size(); renderer.setSize(s.w, s.h, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, s.w / s.h, 0.1, 2000);

    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    sun = new THREE.DirectionalLight(0xffffff, 2.0); sun.position.set(3, 5, 2); scene.add(sun);
    var fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-3, 2, -2); scene.add(fill);
    t0 = performance.now();

    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.autoRotate = true; controls.autoRotateSpeed = 0.9;
    controls.enablePan = false;
    controls.addEventListener('start', function () { controls.autoRotate = false; if (hint) hint.style.opacity = 0; });

    new GLTFLoader().load('assets/models/table.glb', function (gltf) {
      var model = gltf.scene;
      model.traverse(function (o) {
        if (!o.isMesh) return;
        if (/ground|sweep|sol|plane/i.test(o.name)) { o.visible = false; return; } // sol studio masqué
        var mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(function (m) {
          if (!m) return;
          if (/inox/i.test(m.name)) { m.metalness = 1.0; m.roughness = 0.32; m.envMapIntensity = 1.4; }
          else { m.envMapIntensity = 1.15; }
          if (m.map) m.map.anisotropy = 8;
          m.needsUpdate = true;
        });
        // Fin du z-fighting du bois : BOIS001 est une fine dalle coplanaire avec
        // BOIS000 (meme face, meme materiau). On rend BOIS001 legerement devant
        // via un polygonOffset (sur une copie du materiau partage).
        if (/^bois001/i.test(o.name) && o.material) {
          o.material = o.material.clone();
          o.material.polygonOffset = true;
          o.material.polygonOffsetFactor = -1;
          o.material.polygonOffsetUnits = -2;
        }
      });
      var box = new THREE.Box3();
      model.traverse(function (o) { if (o.isMesh && o.visible) box.expandByObject(o); });
      var sz = box.getSize(new THREE.Vector3());
      var ctr = box.getCenter(new THREE.Vector3());
      model.position.sub(ctr);
      scene.add(model);

      var maxDim = Math.max(sz.x, sz.y, sz.z);
      var fov = camera.fov * Math.PI / 180;
      var dist = (maxDim / 2) / Math.tan(fov / 2) * 1.55;
      controls.target.set(0, 0, 0);
      controls.minDistance = maxDim * 0.7;
      controls.maxDistance = maxDim * 3.5;
      camera.near = maxDim / 50; camera.far = maxDim * 8; camera.updateProjectionMatrix();
      camera.position.set(dist * 0.72, dist * 0.5, dist * 0.82);
      camera.lookAt(0, 0, 0);

      stage.classList.add('p3d-ready');
    }, undefined, function () { stage.classList.add('p3d-error'); });

    window.addEventListener('resize', onResize);
  }

  function onResize() {
    if (!renderer) return;
    var s = size();
    camera.aspect = s.w / s.h; camera.updateProjectionMatrix();
    renderer.setSize(s.w, s.h, false);
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (sun) {
      // Lumiere mobile facon soleil : lente derive de la position -> les reflets
      // et ombres se deplacent doucement.
      var t = (performance.now() - t0) * 0.00010;
      sun.position.set(Math.cos(t) * 4.5, 3.6 + Math.sin(t) * 1.6, 2.4 + Math.sin(t * 0.8) * 2.2);
    }
    controls.update();
    renderer.render(scene, camera);
  }
  function start() { if (!running && renderer) { running = true; loop(); } }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

  // Chargement différé + pause hors écran
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { init(); start(); }
      else { stop(); }
    });
  }, { rootMargin: '200px 0px 200px 0px', threshold: 0 });
  io.observe(stage);
})();
