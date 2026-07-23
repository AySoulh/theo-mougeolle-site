document.addEventListener('DOMContentLoaded', function () {
  // Menu mobile
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
      var isOpen = nav.classList.contains('open');
      toggle.textContent = isOpen ? 'Fermer' : 'Menu';
      var headerEl = document.querySelector('.site-header');
      if (headerEl) headerEl.classList.toggle('menu-open', isOpen);
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.textContent = 'Menu';
        var headerEl = document.querySelector('.site-header');
        if (headerEl) headerEl.classList.remove('menu-open');
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
  var revealEls = document.querySelectorAll('.reveal:not(.section-head), .reveal-stagger');
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


  // ---------- Vidéo hero -> Projets : fondu au rythme du scroll ----------
  // Le hero reste épinglé (position: sticky, en CSS) pendant que Projets
  // défile par-dessus ; son opacité suit exactement la position de scroll.
  // Le scroll natif du navigateur ne change jamais : rien à recaler, rien
  // qui puisse "sauter".
  (function () {
    var heroSection = document.getElementById('hero-video');
    if (!heroSection) return;
    var ticking = false;
    function updateFade() {
      ticking = false;
      var h = heroSection.offsetHeight || window.innerHeight;
      var progress = Math.min(1, Math.max(0, window.scrollY / h));
      heroSection.style.opacity = String(1 - progress);
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(updateFade); }
    }
    updateFade();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateFade);
  })();

  // ---------- Texte d'arrivée de la section Projets ----------
  // Se déclenche quand le titre "Projets" est à 60% visible dans le
  // viewport. Le scroll vers le bas est mis en pause pendant les 0.8s de
  // l'animation (durée définie par .reveal en CSS), puis reprend
  // automatiquement dès qu'elle est terminée.
  (function () {
    var titleBlock = document.querySelector('#projets .section-head');
    if (!titleBlock) return;
    if (!('IntersectionObserver' in window)) { titleBlock.classList.add('in'); return; }
    var htmlEl = document.documentElement, bodyEl = document.body;
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || done) return;
        done = true;
        io.disconnect();
        htmlEl.style.overflow = 'hidden';
        bodyEl.style.overflow = 'hidden';
        if (window.__lenis) window.__lenis.stop();
        titleBlock.classList.add('in');
        var released = false;
        function release() {
          if (released) return;
          released = true;
          htmlEl.style.overflow = '';
          bodyEl.style.overflow = '';
          if (window.__lenis) window.__lenis.start();
        }
        titleBlock.addEventListener('transitionend', release, { once: true });
        setTimeout(release, 850); // filet de sécurité si transitionend ne se déclenche pas
      });
    }, { threshold: 0.6 });
    io.observe(titleBlock);
  })();

// ---------- Quadrillage overlay ----------
(function () {
  var ov = document.createElement('div');
  ov.className = 'grid-overlay';
  document.body.appendChild(ov);
  function build() {
    ov.innerHTML = '';
    var vPos = [0, 1/3, 2/3, 1];
    var hStep = Math.max(240, Math.round(window.innerHeight / 3));
    var hPos = [];
    for (var y = hStep; y < window.innerHeight; y += hStep) hPos.push(y);
    vPos.forEach(function (p) {
      var v = document.createElement('span');
      v.className = 'gl-v';
      v.style.left = (p * 100) + '%';
      ov.appendChild(v);
    });
    hPos.forEach(function (y) {
      var h = document.createElement('span');
      h.className = 'gl-h';
      h.style.top = y + 'px';
      ov.appendChild(h);
      vPos.forEach(function (p) {
        var x = document.createElement('span');
        x.className = 'gl-x';
        x.textContent = '+';
        x.style.left = (p * 100) + '%';
        x.style.top = y + 'px';
        ov.appendChild(x);
      });
    });
  }
  build();
  window.addEventListener('resize', build);
})();

  initScrollWarp();
});

// ============================================================
// Effet scroll (exemple officiel curtains.js "multiple planes
// scroll effect") : les images sont des plans WebGL ondulés au
// scroll + un ShaderPass de post-traitement applique une
// distorsion radiale autour du centre de l ecran sur TOUTE la
// scene (donc uniquement les images, le texte reste net).
// ============================================================
function initScrollWarp() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.Curtains || !window.Plane || !window.ShaderPass) return;

  // Scroll natif simple (pas de librairie de smooth-scroll).

  var container = document.createElement('div');
  container.id = 'gl-stage';
  container.style.cssText = 'position:fixed;inset:0;z-index:1;pointer-events:none;';
  document.body.appendChild(container);

  var curtains;
  try {
    curtains = new Curtains({ container: container, watchScroll: true, pixelRatio: Math.min(1.5, window.devicePixelRatio) });
  } catch (err) { return; }
  curtains.onError(function () { container.remove(); });
  window.__curtains = curtains; // permet à la bascule élastique hero<->projets de couper ce rendu WebGL pendant l'animation (voir pauseGL/resumeGL)

  // --- Gestion de l effet de scroll : identique a l exemple ---
  var scrollEffect = 0;
  curtains.onRender(function () {
    scrollEffect = curtains.lerp(scrollEffect, 0, 0.05);
  }).onScroll(function () {
    var delta = curtains.getScrollDeltas();
    delta.y = -delta.y;
    if (Math.abs(delta.y) > Math.abs(scrollEffect)) {
      scrollEffect = curtains.lerp(scrollEffect, delta.y, 0.5);
    }
  });

  // --- Plans : ondulation horizontale au scroll (shader de l exemple) ---
  var vs = [
    'precision mediump float;',
    'attribute vec3 aVertexPosition;',
    'attribute vec2 aTextureCoord;',
    'uniform mat4 uMVMatrix;',
    'uniform mat4 uPMatrix;',
    'uniform mat4 planeTextureMatrix;',
    'varying vec3 vVertexPosition;',
    'varying vec2 vTextureCoord;',
    'void main() {',
    '  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);',
    '  vTextureCoord = (planeTextureMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;',
    '  vVertexPosition = aVertexPosition;',
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

  var medias = document.querySelectorAll('.card-media img, .card-media video, .project-media img, .project-hero-media img, .about .img-wrap img');
  medias.forEach(function (img) {
    var wrapper = img.parentElement;
    var isVideo = img.tagName === 'VIDEO';
    var plane = new (window.Plane)(curtains, wrapper, {
      vertexShader: vs,
      fragmentShader: fs,
      widthSegments: 1,
      heightSegments: 1,
      uniforms: {}
    });
    if (isVideo) {
      plane.loadVideo(img, { sampler: 'planeTexture' });
      img.play && img.play().catch(function(){});
    } else {
      plane.loadImage(img, { sampler: 'planeTexture' });
    }
    plane.onReady(function () {
      img.style.opacity = 0;
      wrapper.style.background = 'transparent';
      wrapper.style.overflow = 'visible';
    });

  });

  // --- ShaderPass : distorsion radiale de toute la scene (le code fourni) ---
  var passFs = [
    '#ifdef GL_ES',
    'precision mediump float;',
    '#endif',
    'varying vec3 vVertexPosition;',
    'varying vec2 vTextureCoord;',
    'uniform sampler2D uRenderTexture;',
    'uniform float uScrollEffect;',
    'void main() {',
    '  vec2 uv = vTextureCoord;',
    // distance verticale au centre de l ecran (-0.5 .. 0.5)
    '  float d = uv.y - 0.5;',
    // profil : 0 au centre (feuille plate), 1 aux extremites (courbure max)
    '  float e = pow(abs(d) * 2.0, 2.2);',
    // intensite pilotee par la vitesse de scroll
    '  float s = uScrollEffect / 85.0;',
    '  float m = 1.0 + s * e;',
    // les extremites s incurvent VERS le spectateur : grossissement pres des bords
    // horizontal : le contenu s elargit et sort a gauche/droite
    '  uv.x = 0.5 + (uv.x - 0.5) / m;',
    // vertical : le contenu est pousse au-dela du bord (la feuille se courbe)
    '  uv.y = 0.5 + d / (1.0 + s * e * 0.75);',
    '  gl_FragColor = texture2D(uRenderTexture, uv);',
    '}'
  ].join('\n');

  var pass = new (window.ShaderPass)(curtains, {
    fragmentShader: passFs,
    uniforms: {
      scrollEffect: { name: 'uScrollEffect', type: '1f', value: 0 }
    }
  });
  pass.onRender(function () {
    pass.uniforms.scrollEffect.value = Math.abs(scrollEffect);
  });
}
