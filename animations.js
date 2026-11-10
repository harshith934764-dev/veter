/* VETER motion layer — progressive enhancement */
(() => {
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealTargets = document.querySelectorAll(
    "main > section:not(.hero), .status-grid, .section-head, .grid > .card, .veter-playground"
  );
  if (reduceMotion || !("IntersectionObserver" in window)) return;
  revealTargets.forEach((element) => element.classList.add("veter-reveal"));
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });
  revealTargets.forEach((element) => observer.observe(element));
})();