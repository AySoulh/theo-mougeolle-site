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

  // Effet "page qui se bombe" (comme haoqi.design) : pendant un scroll rapide,
  // chaque média bascule en 3D (rotateX) selon sa position dans l'écran —
  // au-dessus du centre : le bas s'éloigne ; en dessous : le haut s'éloigne.
  // La page entière semble se courber comme une feuille. Proportionnel à la
  // vitesse (|v|), identique dans les deux sens, retour à plat au repos.
  var warpEls = Array.prototype.slice.call(document.querySelectorAll('.card-media, .card-media-live, .project-hero-media, .project-media img, .about .img-wrap'));
  if (warpEls.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var lastY = window.scrollY, lastT = performance.now();
    var velocity = 0;         // px/frame lissée (signée)
    var intensity = 0;        // amplitude actuelle (degrés, >= 0)
    var MAX_ANGLE = 14;       // degrés max de bascule
    var SENSITIVITY = 0.22;   // conversion vitesse -> degrés
    var VEL_SMOOTH = 0.5;
    var DECAY = 0.88;
    var PERSPECTIVE = 900;    // px
    var rafId = null;
    var settleTimer = null;

    function scheduleFrame() {
      if (!rafId) rafId = requestAnimationFrame(frame);
      // Sécurité : si rAF est throttlé (onglet en arrière-plan...), on force
      // quand même la suite de l'animation via un timer.
      clearTimeout(settleTimer);
      settleTimer = setTimeout(function () {
        if (intensity > 0.05) { rafId = null; frame(); }
      }, 90);
    }

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
      var target = Math.min(MAX_ANGLE, Math.abs(velocity) * SENSITIVITY);
      intensity += (target - intensity) * 0.35;
      velocity *= DECAY;

      var vh = window.innerHeight;
      for (var i = 0; i < warpEls.length; i++) {
        var el = warpEls[i];
        var r = el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) continue;
        // Position relative au centre de l'écran : -1 (haut) .. +1 (bas)
        var d = ((r.top + r.height / 2) - vh / 2) / (vh / 2);
        d = Math.max(-1.2, Math.min(1.2, d));
        var angle = intensity * d;
        el.style.transform = 'perspective(' + PERSPECTIVE + 'px) rotateX(' + angle.toFixed(2) + 'deg)';
      }
      if (intensity > 0.05 || Math.abs(velocity) > 0.05) {
        scheduleFrame();
      } else {
        clearTimeout(settleTimer);
        intensity = 0; velocity = 0;
        for (var j = 0; j < warpEls.length; j++) warpEls[j].style.transform = '';
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  }
});
