const resultsSection = document.getElementById("place-results");

if (resultsSection && window.location.search && window.innerWidth <= 720) {
  window.requestAnimationFrame(() => {
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
