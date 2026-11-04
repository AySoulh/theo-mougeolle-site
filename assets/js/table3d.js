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
  var AUTO_SPEED = 0.9; // vitesse de croisiere de la rotation automatique
  // Cadrage par defaut, pour la reprise automatique apres interaction
  var homePos = new THREE.Vector3(), homeTarget = new THREE.Vector3();
  var idleTimer = null, resetting = false, resetFrom = new THREE.Vector3(), resetFromT = new THREE.Vector3(), resetK = 0;

  function size() {
    var r = stage.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  }

  function init() {
    if (inited) return; inited = true;

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
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
    // Lumiere venue du bas : eclaire le dessous (bois) qui etait trop sombre.
    var under = new THREE.DirectionalLight(0xffffff, 0.95); under.position.set(0.6, -4, 1.4); scene.add(under);
    // Ambiance douce ciel/sol -> remonte encore un peu les faces inferieures.
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc8bd, 0.45));
    t0 = performance.now();

    // Textures fournies : bouleau pour le dessous, inox brosse pour les pieds.
    var texLoader = new THREE.TextureLoader();
    var woodTex = texLoader.load('assets/img/table-mp01/tex-bois.jpg');
    woodTex.colorSpace = THREE.SRGBColorSpace; woodTex.anisotropy = 8;
    var inoxTex = texLoader.load('assets/img/table-mp01/tex-inox.jpg');
    inoxTex.colorSpace = THREE.SRGBColorSpace; inoxTex.anisotropy = 8;
    inoxTex.wrapS = inoxTex.wrapT = THREE.RepeatWrapping; inoxTex.repeat.set(2, 2);

    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.autoRotate = true; controls.autoRotateSpeed = AUTO_SPEED;
    controls.enablePan = false;
    controls.enableZoom = false; // la molette fait defiler la page, pas zoomer
    // Interaction : on stoppe la rotation auto et on masque l'indice pendant qu'on manipule.
    controls.addEventListener('start', function () {
      controls.autoRotate = false; resetting = false;
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      if (hint) hint.style.opacity = 0;
    });
    // Fin d'interaction : apres un court delai, on revient au cadrage par defaut
    // puis la rotation automatique reprend (et l'indice reapparait).
    controls.addEventListener('end', function () {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(function () {
        resetFrom.copy(camera.position); resetFromT.copy(controls.target); resetK = 0; resetting = true;
      }, 2200);
    });

    new GLTFLoader().load('assets/models/table.glb', function (gltf) {
      var model = gltf.scene;
      model.traverse(function (o) {
        if (!o.isMesh) return;
        if (/ground|sweep|sol|plane/i.test(o.name)) { o.visible = false; return; } // sol studio masqué
        // Fin du z-fighting du bois : BOIS001 est une fine dalle coplanaire avec
        // BOIS000 (meme face, meme materiau, meme plan a y=30). Elle est redondante
        // -> on la masque completement. (Le polygonOffset etait sans effet car
        // logarithmicDepthBuffer, desormais retire, l'annulait.)
        if (/^bois001/i.test(o.name)) { o.visible = false; return; }
        var mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(function (m, i) {
          if (!m) return;
          if (/inox/i.test(m.name)) {
            // Inox brosse : la texture sert a la fois de couleur ET de carte de
            // rugosite -> les fines stries du brossage modulent les reflets et
            // deviennent nettement visibles. Anisotropie pour etirer les highlights.
            var pm = new THREE.MeshPhysicalMaterial({
              map: inoxTex,
              roughnessMap: inoxTex,
              metalness: 1.0, roughness: 0.62,
              anisotropy: 0.95, anisotropyRotation: Math.PI / 2,
              envMapIntensity: 1.15
            });
            if (Array.isArray(o.material)) o.material[i] = pm; else o.material = pm;
          } else if (/bois/i.test(m.name) || /^bois/i.test(o.name)) {
            // Dessous : texture de bouleau fournie, aspect bois mat.
            var wm = m.clone();
            wm.map = woodTex; wm.metalness = 0.0; wm.roughness = 0.78; wm.envMapIntensity = 0.9;
            wm.color && wm.color.set(0xffffff);
            if (Array.isArray(o.material)) o.material[i] = wm; else o.material = wm;
          } else {
            m.envMapIntensity = 1.15;
            if (m.map) m.map.anisotropy = 8;
            m.needsUpdate = true;
          }
        });
      });
      var box = new THREE.Box3();
      model.traverse(function (o) { if (o.isMesh && o.visible) box.expandByObject(o); });
      var sz = box.getSize(new THREE.Vector3());
      var ctr = box.getCenter(new THREE.Vector3());
      model.position.sub(ctr);
      scene.add(model);

      var maxDim = Math.max(sz.x, sz.y, sz.z);
      var fov = camera.fov * Math.PI / 180;
      // *1.085 = 30% plus pres qu'avant (1.55)
      var dist = (maxDim / 2) / Math.tan(fov / 2) * 1.085;
      controls.target.set(0, 0, 0);
      controls.minDistance = maxDim * 0.5;
      controls.maxDistance = maxDim * 3.5;
      camera.near = maxDim / 50; camera.far = maxDim * 8; camera.updateProjectionMatrix();
      camera.position.set(dist * 0.72, dist * 0.5, dist * 0.82);
      camera.lookAt(0, 0, 0);
      // Cadrage memorise pour la reprise auto apres interaction
      homePos.copy(camera.position); homeTarget.copy(controls.target);

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
      // Lumiere mobile facon soleil : derive ample de la position -> les reflets
      // sur l'inox et les ombres se deplacent nettement.
      var t = (performance.now() - t0) * 0.00024;
      sun.position.set(Math.cos(t) * 7.5, 4.2 + Math.sin(t) * 3.2, Math.sin(t * 0.8) * 6.5);
    }
    if (resetting) {
      // Retour tres progressif au cadrage par defaut, puis reprise de la rotation
      // automatique en douceur (voir la montee de vitesse plus bas).
      resetK = Math.min(1, resetK + 0.009);
      var e = 1 - Math.pow(1 - resetK, 3); // easeOutCubic
      camera.position.lerpVectors(resetFrom, homePos, e);
      controls.target.lerpVectors(resetFromT, homeTarget, e);
      if (resetK >= 1) {
        resetting = false;
        controls.autoRotate = true; controls.autoRotateSpeed = 0; // repart de 0 -> montee douce
        if (hint) hint.style.opacity = '';
      }
    }
    // Montee en douceur de la vitesse de rotation auto (apres une reprise).
    if (controls.autoRotate && controls.autoRotateSpeed < AUTO_SPEED) {
      controls.autoRotateSpeed = Math.min(AUTO_SPEED, controls.autoRotateSpeed + 0.008);
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
