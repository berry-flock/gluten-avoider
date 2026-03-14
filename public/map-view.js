const mapViewElement = document.getElementById("map-view");
const mapViewDataElement = document.getElementById("map-view-data");

if (mapViewElement && mapViewDataElement && window.L) {
  const mapData = JSON.parse(mapViewDataElement.textContent);
  const map = window.L.map("map-view");

  window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map);

  if (!mapData.places.length) {
    map.setView([-33.8688, 151.2093], 10);
  } else {
    const bounds = [];

    mapData.places.forEach((place) => {
      const marker = window.L.marker([place.lat, place.lng]).addTo(map);
      marker.bindPopup(
        `<strong>${escapeHtml(place.name)}</strong><br>${escapeHtml(place.suburb)}<br><a href="/places/${encodeURIComponent(place.slug)}">View details</a>`
      );
      bounds.push([place.lat, place.lng]);
    });

    map.fitBounds(bounds, { padding: [24, 24] });
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
