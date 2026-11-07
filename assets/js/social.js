(() => {
  const toast = document.getElementById("social-toast");
  if (!toast) return;
  let hideTimer;
  document.querySelectorAll("[data-auth-info]").forEach((button) => {
    button.addEventListener("click", () => {
      toast.textContent = "Sign-in is not active yet. Veter Social is in preview while secure authentication is being connected.";
      toast.classList.add("show");
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => toast.classList.remove("show"), 4200);
    });
  });
})();