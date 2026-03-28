const mapViewElement = document.getElementById("map-view");
const mapViewDataElement = document.getElementById("map-view-data");
const mapResultsCountElement = document.getElementById("map-results-count");
const mapCardElements = Array.from(document.querySelectorAll("[data-map-card]"));

if (mapViewElement && mapViewDataElement && window.L) {
  const mapData = JSON.parse(mapViewDataElement.textContent);
  const map = window.L.map("map-view");
  const markersBySlug = new Map();

  window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map);

  if (!mapData.places.length) {
    map.setView([-33.8688, 151.2093], 10);
  } else {
    const bounds = [];

    mapData.places.forEach((place) => {
      const marker = window.L.marker([place.lat, place.lng], {
        icon: makeStatusIcon(place.isOpen)
      }).addTo(map);
      markersBySlug.set(place.slug, marker);
      marker.bindPopup(
        `<strong>${escapeHtml(place.name)}</strong><br>${escapeHtml(place.suburb)}<br><a href="/places/${encodeURIComponent(place.slug)}">View details</a>`
      );
      marker.on("click", () => focusCard(place.slug));
      bounds.push([place.lat, place.lng]);
    });

    map.fitBounds(bounds, { padding: [24, 24] });
    updateVisibleCards();
    map.on("moveend", updateVisibleCards);
  }

  function updateVisibleCards() {
    const bounds = map.getBounds();
    const visibleCards = [];

    mapCardElements.forEach((card) => {
      const lat = Number(card.dataset.lat);
      const lng = Number(card.dataset.lng);
      const isVisible = bounds.contains([lat, lng]);

      card.hidden = !isVisible;

      if (isVisible) {
        visibleCards.push(card);
      }
    });

    if (mapResultsCountElement) {
      mapResultsCountElement.textContent = String(visibleCards.length);
    }
  }

  function focusCard(slug) {
    const card = mapCardElements.find((item) => item.dataset.slug === slug);

    if (!card || !card.parentElement) {
      return;
    }

    card.parentElement.prepend(card);
    card.classList.add("map-result-card--active");

    window.setTimeout(() => {
      card.classList.remove("map-result-card--active");
    }, 1500);
  }
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
