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

  // Déformation au scroll : les cartes se courbent légèrement en arrivant par le bas
  // et en repartant par le haut de l'écran, puis reprennent leur forme au centre.
  var warpEls = Array.prototype.slice.call(document.querySelectorAll('.card'));
  if (warpEls.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var warpTicking = false;
    var ZONE = 0.28, MAX_SKEW = 5, MAX_SCALE = 0.03, MAX_SHIFT = 14;

    function applyWarp() {
      var vh = window.innerHeight;
      warpEls.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) { return; }
        var center = (r.top + r.height / 2) / vh;
        var skew = 0, scaleY = 1, shift = 0;
        if (center > 1 - ZONE) {
          var p = Math.min(1, (center - (1 - ZONE)) / ZONE);
          skew = -MAX_SKEW * p; scaleY = 1 - MAX_SCALE * p; shift = MAX_SHIFT * p;
        } else if (center < ZONE) {
          var p2 = Math.min(1, (ZONE - center) / ZONE);
          skew = MAX_SKEW * p2; scaleY = 1 - MAX_SCALE * p2; shift = -MAX_SHIFT * p2;
        }
        el.style.transform = 'translateY(' + shift.toFixed(2) + 'px) skewY(' + skew.toFixed(2) + 'deg) scaleY(' + scaleY.toFixed(3) + ')';
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
