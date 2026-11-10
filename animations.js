/* VETER motion layer — progressive enhancement */
(() => {
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealTargets = document.querySelectorAll(
    "main > section:not(.hero), .status-grid, .section-head, .grid > .card, .veter-playground"
  );
  const progress = document.createElement("div");
  progress.className = "veter-scroll-progress";
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-label", "Page reading progress");
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  const progressFill = document.createElement("span");
  progress.appendChild(progressFill);
  document.body.appendChild(progress);
  let ticking = false;
  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const value = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
    progressFill.style.width = value + "%";
    progress.setAttribute("aria-valuenow", String(Math.round(value)));
    ticking = false;
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { window.requestAnimationFrame(updateProgress); ticking = true; }
  }, { passive: true });
  window.addEventListener("resize", updateProgress, { passive: true });
  updateProgress();
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