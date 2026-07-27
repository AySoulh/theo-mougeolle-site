// Preloader : remplit progressivement le logo tant que la page charge, puis
// termine à 100 % et disparaît en fondu au chargement complet (window.load).
(function () {
  var el = document.getElementById('preloader');
  if (!el) return;
  var logo = el.querySelector('.preloader-logo');
  var fill = 0;
  var done = false;

  function setFill(v) {
    fill = Math.max(0, Math.min(100, v));
    if (logo) logo.style.setProperty('--fill', fill + '%');
  }
  setFill(8); // amorce visible tout de suite

  // Progression douce et continue tant que le chargement n'est pas fini : monte
  // par paliers décroissants vers ~90 %, sans jamais atteindre 100 % avant que
  // la page soit réellement prête (évite un faux « terminé »).
  var timer = setInterval(function () {
    if (done) return;
    var remaining = 90 - fill;
    if (remaining > 0) setFill(fill + Math.max(0.5, remaining * 0.06));
  }, 90);

  function finish() {
    if (done) return;
    done = true;
    clearInterval(timer);
    setFill(100);
    // laisse voir le logo plein un court instant, puis fond enchaîné
    setTimeout(function () {
      el.classList.add('is-done');
      // retire le voile du DOM après le fondu pour libérer l'interaction
      setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 700);
    }, 250);
  }

  // Fin quand tout est chargé (images incluses). Filet de sécurité : ne jamais
  // rester bloqué plus de 6 s même si une ressource traîne.
  if (document.readyState === 'complete') finish();
  else window.addEventListener('load', finish);
  setTimeout(finish, 6000);
})();
