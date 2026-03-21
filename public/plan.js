const planFiltersElement = document.getElementById("plan-filters");
const planResultsElement = document.getElementById("plan-results");

if (planFiltersElement && planResultsElement) {
  const params = new URLSearchParams(window.location.search);
  const hasSearch = params.toString().length > 0;

  if (hasSearch) {
    window.requestAnimationFrame(() => {
      planResultsElement.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}
