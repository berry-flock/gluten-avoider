const siteHeader = document.querySelector(".site-header");

if (siteHeader) {
  const syncHeaderState = () => {
    siteHeader.classList.toggle("site-header--compact", window.scrollY > 28);
  };

  syncHeaderState();
  window.addEventListener("scroll", syncHeaderState, { passive: true });
}
