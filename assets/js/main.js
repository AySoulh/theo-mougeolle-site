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

  // Déformation basée sur la vitesse de scroll : quand on scrolle vite,
  // les médias (cartes/images) s'étirent/courbent dans la direction opposée
  // au scroll, comme un tissu qui traîne. Retour au repos très rapide.
  var warpEls = Array.prototype.slice.call(document.querySelectorAll('.card-media, .card-media-live, .project-hero-media, .project-media img, .about .img-wrap'));
  if (warpEls.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var lastY = window.scrollY, lastT = performance.now();
    var velocity = 0;          // px/frame lissée
    var currentSkew = 0;
    var MAX_SKEW = 8;          // degrés max
    var SENSITIVITY = 0.10;    // combien un delta rapide se convertit en degrés
    var VEL_SMOOTH = 0.55;     // 0=aucun lissage, 1=très lisse
    var DECAY = 0.86;          // vitesse de retour à 0 par frame quand on ne scrolle plus
    var rafId = null;

    function onScroll() {
      var now = performance.now();
      var dy = window.scrollY - lastY;
      var dt = Math.max(1, now - lastT);
      // px par 16ms (une frame ~60fps)
      var v = dy * (16 / dt);
      velocity = velocity * VEL_SMOOTH + v * (1 - VEL_SMOOTH);
      lastY = window.scrollY;
      lastT = now;
      if (!rafId) rafId = requestAnimationFrame(frame);
    }

    function frame() {
      rafId = null;
      // Skew opposé au scroll : scroll vers le bas (dy>0) -> skewY négatif (image traîne vers le haut)
      var target = Math.max(-MAX_SKEW, Math.min(MAX_SKEW, -velocity * SENSITIVITY));
      currentSkew += (target - currentSkew) * 0.4;
      velocity *= DECAY;
      for (var i = 0; i < warpEls.length; i++) {
        var el = warpEls[i];
        var r = el.getBoundingClientRect();
        if (r.bottom < -50 || r.top > window.innerHeight + 50) continue;
        el.style.transform = 'skewY(' + currentSkew.toFixed(2) + 'deg)';
      }
      if (Math.abs(currentSkew) > 0.03 || Math.abs(velocity) > 0.05) {
        rafId = requestAnimationFrame(frame);
      } else {
        currentSkew = 0; velocity = 0;
        for (var j = 0; j < warpEls.length; j++) warpEls[j].style.transform = '';
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  }
});
