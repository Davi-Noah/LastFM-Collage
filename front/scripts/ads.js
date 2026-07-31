(() => {
  const client = "ca-pub-2178155704632455";
  let loaded = false;

  function loadAds() {
    if (loaded || document.querySelector("script[data-cartify-ads]")) return;
    loaded = true;
    const script = document.createElement("script");
    script.async = true;
    script.dataset.cartifyAds = "true";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
    script.crossOrigin = "anonymous";
    document.head.append(script);
  }

  document.addEventListener("cartify:consent", (event) => {
    if (event.detail === "accepted") loadAds();
  });

  try {
    if (localStorage.getItem("cartify-ad-consent") === "accepted") loadAds();
  } catch { /* armazenamento bloqueado */ }
})();
