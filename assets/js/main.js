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

  // Déformation au scroll : les bords haut et bas des cartes se courbent
  // (comme une feuille qui se plie) quand ils touchent les extrémités de l'écran,
  // puis se lissent au centre. On agit sur les rayons de coin haut/bas séparément.
  var warpEls = Array.prototype.slice.call(document.querySelectorAll('.card-media, .card-media-live, .project-hero-media, .project-media img, .about .img-wrap'));
  if (warpEls.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var warpTicking = false;
    var ZONE = 0.18;       // proportion de l'écran considérée comme "zone de bord"
    var MAX_RADIUS = 36;   // px de courbure max au bord

    function applyWarp() {
      var vh = window.innerHeight;
      warpEls.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;

        // 0 = tout en haut de l'écran, 1 = tout en bas
        var topPos = r.top / vh;
        var botPos = r.bottom / vh;

        // Courbure du bord bas quand la carte arrive par le bas de l'écran
        var bottomCurve = 0;
        if (botPos > 1 - ZONE) {
          var p = Math.min(1, (botPos - (1 - ZONE)) / ZONE);
          bottomCurve = MAX_RADIUS * p;
        }
        // Courbure du bord haut quand la carte repart par le haut de l'écran
        var topCurve = 0;
        if (topPos < ZONE) {
          var q = Math.min(1, (ZONE - topPos) / ZONE);
          topCurve = MAX_RADIUS * q;
        }

        el.style.borderRadius =
          topCurve.toFixed(1) + 'px ' + topCurve.toFixed(1) + 'px ' +
          bottomCurve.toFixed(1) + 'px ' + bottomCurve.toFixed(1) + 'px';
      });
      warpTicking = false;
    }
    window.addEventListener('scroll', function () {
      if (!warpTicking) { requestAnimationFrame(applyWarp); warpTicking = true; }
    }, { passive: true });
    window.addEventListener('resize', applyWarp);
    applyWarp();
  }
});
