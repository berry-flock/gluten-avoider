const planFiltersElement = document.getElementById("plan-filters");
const planResultsElement = document.getElementById("plan-results");
const planLatInput = document.getElementById("plan-lat");
const planLngInput = document.getElementById("plan-lng");
const planMealInput = document.getElementById("plan-meal");
const planMealButtons = Array.from(document.querySelectorAll("[data-plan-meal]"));
const planTagCollapseElements = Array.from(document.querySelectorAll(".tag-filter-collapse"));

if (planFiltersElement && planResultsElement) {
  const formElement = planFiltersElement.querySelector("form");
  const params = new URLSearchParams(window.location.search);
  const hasSearch = params.toString().length > 0;

  planMealButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!planMealInput || !formElement) {
        return;
      }

      planMealInput.value = button.dataset.planMeal || "lunch";
      formElement.submit();
    });
  });

  if (
    planLatInput
    && planLngInput
    && !planLatInput.value
    && !planLngInput.value
    && navigator.geolocation
    && window.isSecureContext
  ) {
    const attempted = window.sessionStorage.getItem("plan-autolocate-attempted");

    if (!attempted) {
      window.sessionStorage.setItem("plan-autolocate-attempted", "1");

      navigator.geolocation.getCurrentPosition(
        (position) => {
          planLatInput.value = position.coords.latitude.toFixed(6);
          planLngInput.value = position.coords.longitude.toFixed(6);
          formElement.submit();
        },
        () => {
          window.sessionStorage.setItem("plan-autolocate-attempted", "denied");
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 12000
        }
      );
    }
  }

  if (hasSearch) {
    window.requestAnimationFrame(() => {
      planResultsElement.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (planTagCollapseElements.length && hasSearch) {
    planTagCollapseElements.forEach((element) => {
      element.open = false;
    });
  }
}
