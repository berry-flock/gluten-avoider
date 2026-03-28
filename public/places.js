const resultsSection = document.getElementById("place-results");
const tagCollapseElements = Array.from(document.querySelectorAll(".tag-filter-collapse"));

if (resultsSection && window.location.search && window.innerWidth <= 720) {
  window.requestAnimationFrame(() => {
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

if (tagCollapseElements.length && window.location.search) {
  tagCollapseElements.forEach((element) => {
    element.open = false;
  });
}
