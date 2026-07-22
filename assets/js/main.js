document.addEventListener('DOMContentLoaded', function () {
  // Menu mobile
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
      toggle.textContent = nav.classList.contains('open') ? 'Fermer' : 'Menu';
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.textContent = 'Menu';
      });
    });
  }

  // Header transparent sur la vidéo hero, blanc une fois qu'on a scrollé
  var header = document.querySelector('.site-header');
  var heroVideo = document.getElementById('hero-video');
  if (header && heroVideo && 'IntersectionObserver' in window) {
    header.classList.add('on-hero');
    var headerIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        header.classList.toggle('on-hero', entry.isIntersecting);
      });
    }, { threshold: 0, rootMargin: '-80px 0px 0px 0px' });
    headerIO.observe(heroVideo);
  }

  // Animations au scroll
  var revealEls = document.querySelectorAll('.reveal, .reveal-stagger');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  initScrollWarp();
});

// ============================================================
// Effet "page souple" (référence haoqi.design)
// Lenis (smooth scroll + vitesse) + curtains.js (WebGL) :
// chaque image devient un plan WebGL dont les sommets sont
// courbés par un vertex shader proportionnellement à la vitesse.
// ============================================================
function initScrollWarp() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.Curtains || !window.Lenis) return;

  // --- Smooth scroll (fournit une vitesse lissée fiable) ---
  var lenis = new Lenis({ autoRaf: true, lerp: 0.11 });
  var scrollEffect = 0;   // valeur courante envoyée au shader
  var targetEffect = 0;
  lenis.on('scroll', function (e) {
    // e.velocity : px/frame signé
    targetEffect = Math.max(-60, Math.min(60, e.velocity * 2.2));
  });

  // --- WebGL ---
  var container = document.createElement('div');
  container.id = 'gl-stage';
  container.style.cssText = 'position:fixed;inset:0;z-index:1;pointer-events:none;';
  document.body.appendChild(container);

  var curtains;
  try {
    curtains = new Curtains({ container: container, watchScroll: true, pixelRatio: Math.min(1.5, window.devicePixelRatio) });
  } catch (err) { return; }

  curtains.onError(function () {
    // WebGL indisponible : on retire le canvas, les images restent telles quelles
    container.remove();
  });

  var vs = [
    'precision mediump float;',
    'attribute vec3 aVertexPosition;',
    'attribute vec2 aTextureCoord;',
    'uniform mat4 uMVMatrix;',
    'uniform mat4 uPMatrix;',
    'uniform mat4 planeTextureMatrix;',
    'varying vec3 vVertexPosition;',
    'varying vec2 vTextureCoord;',
    'uniform float uScrollEffect;',
    'void main() {',
    '  vec3 vertexPosition = aVertexPosition;',
    // courbure : le milieu vertical du plan se déplace en Z selon la vitesse
    '  float bend = sin(((vertexPosition.y + 1.0) / 2.0) * 3.141592);',
    '  vertexPosition.z -= bend * uScrollEffect * 0.018;',
    // léger étirement vertical dans le sens du scroll pour accompagner
    '  vertexPosition.y += vertexPosition.z * sign(uScrollEffect) * 0.18;',
    '  gl_Position = uPMatrix * uMVMatrix * vec4(vertexPosition, 1.0);',
    '  vTextureCoord = (planeTextureMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;',
    '  vVertexPosition = vertexPosition;',
    '}'
  ].join('\n');

  var fs = [
    'precision mediump float;',
    'varying vec3 vVertexPosition;',
    'varying vec2 vTextureCoord;',
    'uniform sampler2D planeTexture;',
    'void main() {',
    '  gl_FragColor = texture2D(planeTexture, vTextureCoord);',
    '}'
  ].join('\n');

  var imgs = document.querySelectorAll('.card-media img, .project-media img, .project-hero-media img, .about .img-wrap img');
  var planes = [];
  imgs.forEach(function (img) {
    var wrapper = img.parentElement;
    var plane = new (window.Plane)(curtains, wrapper, {
      vertexShader: vs,
      fragmentShader: fs,
      widthSegments: 1,
      heightSegments: 12,
      uniforms: {
        scrollEffect: { name: 'uScrollEffect', type: '1f', value: 0 }
      }
    });
    plane.loadImage(img, { sampler: 'planeTexture' });
    plane.onReady(function () {
      // cacher l image DOM une fois le plan WebGL pret
      img.style.opacity = 0;
    });
    plane.onRender(function () {
      plane.uniforms.scrollEffect.value = scrollEffect;
    });
    planes.push(plane);
  });

  // boucle : lissage de l effet
  curtains.onRender(function () {
    scrollEffect += (targetEffect - scrollEffect) * 0.12;
    targetEffect *= 0.92;
  });
}
