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

  // Déformation basée sur la vitesse de scroll : les bords haut ET bas
  // des médias se courbent dans le même sens que le scroll (concave vers le bas
  // quand on scrolle vers le bas, comme une feuille qui plie sous la vitesse).
  // Aucune déformation au repos, effet visible seulement quand on scrolle vite.
  var warpEls = Array.prototype.slice.call(document.querySelectorAll('.card-media, .card-media-live, .project-hero-media, .project-media img, .about .img-wrap'));
  if (warpEls.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var lastY = window.scrollY, lastT = performance.now();
    var velocity = 0;          // px/frame lissée
    var currentCurve = 0;      // courbure actuelle (px)
    var MAX_CURVE = 60;        // px de courbure max
    var SENSITIVITY = 0.9;     // combien un delta rapide se convertit en courbure
    var VEL_SMOOTH = 0.55;
    var DECAY = 0.86;
    var rafId = null;

    function onScroll() {
      var now = performance.now();
      var dy = window.scrollY - lastY;
      var dt = Math.max(1, now - lastT);
      var v = dy * (16 / dt);
      velocity = velocity * VEL_SMOOTH + v * (1 - VEL_SMOOTH);
      lastY = window.scrollY;
      lastT = now;
      if (!rafId) rafId = requestAnimationFrame(frame);
    }

    function frame() {
      rafId = null;
      var target = Math.max(-MAX_CURVE, Math.min(MAX_CURVE, velocity * SENSITIVITY));
      currentCurve += (target - currentCurve) * 0.4;
      velocity *= DECAY;

      // On veut : quand on scrolle vers le bas (currentCurve > 0), la carte se
      // plie vers le bas → bord haut concave vers le bas (rayons en HAUT poussés
      // vers le centre), bord bas concave vers le bas (rayons en BAS poussés en
      // dehors). Le plus simple visuellement : deux rayons horizontaux différents,
      // haut plus large que bas quand on descend, et l'inverse quand on remonte.
      var absCurve = Math.abs(currentCurve);
      var topRadius, botRadius;
      if (currentCurve > 0) {   // scroll vers le bas
        topRadius = 50 + absCurve;
        botRadius = 50 - absCurve;
      } else {                  // scroll vers le haut
        topRadius = 50 - absCurve;
        botRadius = 50 + absCurve;
      }
      topRadius = Math.max(0, topRadius);
      botRadius = Math.max(0, botRadius);

      // border-radius: {topLeft} {topRight} {botRight} {botLeft} / {vertical parts}
      // On applique un rayon horizontal en % (identique gauche/droite pour rester
      // symétrique), et un rayon vertical fixe qui produit la courbure.
      var rString = topRadius.toFixed(0) + '% ' + topRadius.toFixed(0) + '% ' +
                    botRadius.toFixed(0) + '% ' + botRadius.toFixed(0) + '% / ' +
                    absCurve.toFixed(0) + 'px ' + absCurve.toFixed(0) + 'px ' +
                    absCurve.toFixed(0) + 'px ' + absCurve.toFixed(0) + 'px';

      for (var i = 0; i < warpEls.length; i++) {
        var el = warpEls[i];
        var r = el.getBoundingClientRect();
        if (r.bottom < -50 || r.top > window.innerHeight + 50) continue;
        el.style.borderRadius = rString;
      }
      if (absCurve > 0.5 || Math.abs(velocity) > 0.05) {
        rafId = requestAnimationFrame(frame);
      } else {
        currentCurve = 0; velocity = 0;
        for (var j = 0; j < warpEls.length; j++) warpEls[j].style.borderRadius = '';
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  }
});
