(() => {
  const storageKey = "cartify-ad-consent";
  const banner = document.querySelector("[data-consent-banner]");
  if (!banner) return;

  let preference = null;
  try { preference = localStorage.getItem(storageKey); } catch { /* armazenamento bloqueado */ }

  if (!preference) {
    banner.hidden = false;
  } else {
    document.dispatchEvent(new CustomEvent("cartify:consent", { detail: preference }));
  }

  banner.querySelectorAll("[data-consent]").forEach((button) => {
    button.addEventListener("click", () => {
      const choice = button.dataset.consent;
      try { localStorage.setItem(storageKey, choice); } catch { /* armazenamento bloqueado */ }
      banner.hidden = true;
      document.dispatchEvent(new CustomEvent("cartify:consent", { detail: choice }));
    });
  });
})();
