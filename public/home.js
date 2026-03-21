const nearbyPreviewElement = document.getElementById("home-nearby-preview");
const mapElement = document.getElementById("home-map");
const mapMessageElement = document.getElementById("home-map-message");

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
          const response = await fetch(`/home/preview-data?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`);
          const payload = await response.json();

          renderNearbyPreview(payload.nearbyPlaces);
          renderHomeMap(payload);
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

function renderGeolocationUnavailable(message = "Location preview is not available in this browser.") {
  nearbyPreviewElement.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
  mapMessageElement.textContent = message;
}

function renderNearbyPreview(places) {
  if (!places.length) {
    nearbyPreviewElement.innerHTML = '<p class="empty-state">No trusted places nearby are open right now.</p>';
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
      ${place.menuItems.length ? `<div class="nearby-card__group"><p class="nearby-card__label">On the menu</p><div class="nearby-card__menu-row">${place.menuItems.map((tag) => `<span class="menu-chip">${escapeHtml(tag.name)}</span>`).join("")}</div></div>` : ""}
    </article>
  `).join("")}</div>`;
}

function renderHomeMap(payload) {
  if (!window.L || !payload.hasCoordinates) {
    mapMessageElement.textContent = "Could not center the map on your location.";
    return;
  }

  const map = window.L.map("home-map");

  window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map);

  const userLatLng = [payload.location.latitude, payload.location.longitude];
  const bounds = [userLatLng];

  window.L.marker(userLatLng)
    .addTo(map)
    .bindPopup("You are here");

  payload.mapPlaces.forEach((place) => {
    const marker = window.L.marker([place.lat, place.lng]).addTo(map);
    marker.bindPopup(`<strong>${escapeHtml(place.name)}</strong><br>${escapeHtml(place.suburb || "")}<br><a href="/places/${encodeURIComponent(place.slug)}">View details</a>`);
    bounds.push([place.lat, place.lng]);
  });

  map.fitBounds(bounds, { padding: [20, 20], maxZoom: 16 });
  mapMessageElement.textContent = "Showing saved places around your current location.";
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
