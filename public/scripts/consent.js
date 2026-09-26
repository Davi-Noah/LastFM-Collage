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
      const revoked = preference === "accepted" && choice !== "accepted";
      try { localStorage.setItem(storageKey, choice); } catch { /* armazenamento bloqueado */ }
      preference = choice;
      banner.hidden = true;
      // O script do AdSense não pode ser descarregado; recarregar garante que ele saia da página.
      if (revoked) {
        window.location.reload();
        return;
      }
      document.dispatchEvent(new CustomEvent("cartify:consent", { detail: choice }));
    });
  });

  document.querySelectorAll("[data-consent-open]").forEach((button) => {
    button.addEventListener("click", () => {
      banner.hidden = false;
      banner.querySelector("[data-consent]")?.focus();
    });
  });
})();
