const nearbyPreviewElement = document.getElementById("home-nearby-preview");
const mapElement = document.getElementById("home-map");
const mapMessageElement = document.getElementById("home-map-message");
const homeMapFilterButtons = Array.from(document.querySelectorAll("[data-map-availability]"));
const homeMapSuburbButtons = Array.from(document.querySelectorAll("[data-map-suburb]"));
const homeNearbyMealButtons = Array.from(document.querySelectorAll("[data-home-nearby-meal]"));
const homePlanMealButtons = Array.from(document.querySelectorAll("[data-home-plan-meal]"));
const homePlanMealInput = document.querySelector(".home-plan-form input[name='meal']");
const foodFeelingsElement = document.getElementById("food-feelings-list");
const foodFeelingsRefreshButton = document.getElementById("food-feelings-refresh");
let homeMapState = {
  availability: "open",
  latitude: null,
  longitude: null,
  suburb: ""
};
let homeNearbyMeal = document.querySelector("[data-home-nearby-meal]:not(.button--secondary)")?.dataset.homeNearbyMeal || "open";
let homeMapInstance = null;
let homeMapLayer = null;

if (nearbyPreviewElement && mapElement) {
  if (!navigator.geolocation) {
    renderGeolocationUnavailable();
  } else if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    renderGeolocationUnavailable("Current location on the live site needs HTTPS. Once the domain has SSL, this preview will auto-load.");
  } else {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);

        try {
          homeMapState.latitude = latitude;
          homeMapState.longitude = longitude;
          await loadHomePreview();
        } catch (error) {
          renderGeolocationUnavailable("Could not load the homepage previews right now.");
        }
      },
      (error) => {
        renderGeolocationUnavailable(`Could not get your current location. ${geolocationErrorMessage(error)}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000
      }
    );
  }
}

if (foodFeelingsElement) {
  renderFoodFeelings();
}

if (foodFeelingsRefreshButton) {
  foodFeelingsRefreshButton.addEventListener("click", () => {
    renderFoodFeelings();
  });
}

updateHomeMapButtons();
updateNearbyMealButtons();
updateHomePlanMealButtons();

homeMapFilterButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    homeMapState.availability = button.dataset.mapAvailability || "open";
    updateHomeMapButtons();

    if (homeMapState.latitude && homeMapState.longitude) {
      await loadHomePreview();
    }
  });
});

homeMapSuburbButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const suburb = button.dataset.mapSuburb || "";
    homeMapState.suburb = homeMapState.suburb === suburb ? "" : suburb;
    updateHomeMapButtons();

    if (homeMapState.latitude && homeMapState.longitude) {
      await loadHomePreview();
    }
  });
});

homeNearbyMealButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    homeNearbyMeal = button.dataset.homeNearbyMeal || "lunch";
    updateNearbyMealButtons();

    if (homeMapState.latitude && homeMapState.longitude) {
      await loadHomePreview();
    }
  });
});

homePlanMealButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!homePlanMealInput) {
      return;
    }

    homePlanMealInput.value = button.dataset.homePlanMeal || "lunch";
    updateHomePlanMealButtons();
  });
});

function renderGeolocationUnavailable(message = "Location preview is not available in this browser.") {
  nearbyPreviewElement.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
  mapMessageElement.textContent = message;
}

function renderNearbyPreview(places) {
  if (!places.length) {
    nearbyPreviewElement.innerHTML = `<p class="empty-state">No trusted places nearby are open for ${escapeHtml(homeNearbyMeal)}.</p>`;
    return;
  }

  nearbyPreviewElement.innerHTML = `<div class="home-preview-list">${places.map((place) => `
    <article class="place-card place-card--compact nearby-card">
      <div class="nearby-card__content">
        <div class="place-card__title-row">
          <h3 class="place-card__title"><a class="place-card__primary-link" href="/places/${encodeURIComponent(place.slug)}">${escapeHtml(place.name)}</a></h3>
          ${place.menuUrl ? `<a class="menu-link" href="${escapeHtml(place.menuUrl)}" target="_blank" rel="noreferrer"><span class="menu-link__icon" aria-hidden="true"></span><span class="sr-only">Menu</span></a>` : ""}
        </div>
        <p class="place-card__suburb">${escapeHtml(place.suburb || "")}</p>
      </div>
      ${place.openSummary ? `<p class="nearby-status-line">${escapeHtml(compactOpenLabel(place.openSummary.label))}</p>` : ""}
      ${place.menuItems.length ? `<div class="nearby-card__group"><p class="nearby-card__label">On the menu</p><div class="nearby-card__menu-row">${place.menuItems.map((tag) => `<a class="menu-chip menu-chip--link" href="/plan?tags=${encodeURIComponent(tag.slug)}&meal=open">${escapeHtml(tag.name)}</a>`).join("")}</div></div>` : ""}
    </article>
  `).join("")}</div>`;
}

function renderHomeMap(payload) {
  if (!window.L || !payload.hasCoordinates) {
    mapMessageElement.textContent = "Could not center the map on your location.";
    return;
  }

  if (!homeMapInstance) {
    homeMapInstance = window.L.map("home-map");
    window.setTimeout(() => homeMapInstance.invalidateSize(), 0);
    homeMapLayer = window.L.layerGroup().addTo(homeMapInstance);

    window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(homeMapInstance);
  }

  homeMapLayer.clearLayers();

  const userLatLng = [payload.location.latitude, payload.location.longitude];
  const bounds = [userLatLng];

  window.L.marker(userLatLng)
    .addTo(homeMapLayer)
    .bindPopup("You are here");

  payload.mapPlaces.forEach((place) => {
    const marker = window.L.marker([place.lat, place.lng], {
      icon: makeStatusIcon(place.isOpen)
    }).addTo(homeMapLayer);
    marker.bindPopup(`<strong>${escapeHtml(place.name)}</strong><br>${escapeHtml(place.suburb || "")}<br><a href="/places/${encodeURIComponent(place.slug)}">View details</a>`);
    bounds.push([place.lat, place.lng]);
  });

  homeMapInstance.fitBounds(bounds, { padding: [20, 20], maxZoom: 17 });
  mapMessageElement.textContent = `Showing ${payload.filters.availability} places${payload.filters.suburb ? ` in ${payload.filters.suburb}` : ""}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function geolocationErrorMessage(error) {
  if (!error) {
    return "Unknown geolocation failure.";
  }

  const codeMap = {
    1: "Permission denied",
    2: "Position unavailable",
    3: "Timed out"
  };

  const label = codeMap[error.code] || `Error code ${error.code}`;
  return `${label}${error.message ? `: ${error.message}` : ""}`;
}

function formatStatus(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function compactOpenLabel(label) {
  return String(label || "").replace(/^Open now\s+/i, "");
}

async function loadHomePreview() {
  const params = new URLSearchParams({
    lat: String(homeMapState.latitude),
    lng: String(homeMapState.longitude),
    availability: homeMapState.availability,
    nearby_meal: homeNearbyMeal
  });

  if (homeMapState.suburb) {
    params.set("suburb", homeMapState.suburb);
  }

  const response = await fetch(`/home/preview-data?${params.toString()}`);
  const payload = await response.json();
  renderNearbyPreview(payload.nearbyPlaces);
  renderHomeMap(payload);
}

function updateHomeMapButtons() {
  homeMapFilterButtons.forEach((button) => {
    button.classList.toggle("button--secondary", button.dataset.mapAvailability !== homeMapState.availability);
  });

  homeMapSuburbButtons.forEach((button) => {
    button.classList.toggle("button--secondary", button.dataset.mapSuburb !== homeMapState.suburb);
  });
}

function updateNearbyMealButtons() {
  homeNearbyMealButtons.forEach((button) => {
    button.classList.toggle("button--secondary", button.dataset.homeNearbyMeal !== homeNearbyMeal);
  });
}

function updateHomePlanMealButtons() {
  homePlanMealButtons.forEach((button) => {
    button.classList.toggle("button--secondary", !homePlanMealInput || button.dataset.homePlanMeal !== homePlanMealInput.value);
  });
}

function renderFoodFeelings() {
  if (!foodFeelingsElement) {
    return;
  }

  const tags = JSON.parse(foodFeelingsElement.dataset.foodFeelings || "[]");
  const shuffled = [...tags].sort(() => Math.random() - 0.5).slice(0, 10);

  foodFeelingsElement.innerHTML = shuffled.map((tag) => (
    `<a class="menu-chip menu-chip--link" href="/plan?tags=${encodeURIComponent(tag.slug)}&meal=open">${escapeHtml(tag.name)}</a>`
  )).join("");
}

function makeStatusIcon(isOpen) {
  return window.L.divIcon({
    className: "map-pin-wrap",
    html: `<span class="map-pin ${isOpen ? "map-pin--open" : "map-pin--closed"}"></span>`,
    iconAnchor: [10, 20],
    iconSize: [20, 20],
    popupAnchor: [0, -18]
  });
}
