/* VETER accessible dialog controls — native dialog handles Escape and focus containment */
(() => {
  const dialog = document.getElementById("veter-help-dialog");
  const openButton = document.querySelector("[data-veter-dialog-open]");
  if (!dialog || !openButton || typeof dialog.showModal !== "function") return;
  const closeButton = dialog.querySelector("[data-veter-dialog-close]");
  openButton.addEventListener("click", () => {
    if (!dialog.open) dialog.showModal();
  });
  closeButton?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => dialog.close());
  });
  dialog.addEventListener("close", () => openButton.focus());
})();
