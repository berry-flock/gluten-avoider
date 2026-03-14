const nearbyLocationButton = document.getElementById("nearby-use-location");
const nearbyLatInput = document.getElementById("nearby-lat-input");
const nearbyLngInput = document.getElementById("nearby-lng-input");
const nearbyLocationHelp = document.getElementById("nearby-location-help");

function geolocationNeedsHttps() {
  return !window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
}

if (nearbyLocationButton && nearbyLatInput && nearbyLngInput) {
  nearbyLocationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
      window.alert("Geolocation is not available in this browser.");
      return;
    }

    if (geolocationNeedsHttps()) {
      window.alert("Current location on the live site needs HTTPS. It will work once the domain has SSL.");
      return;
    }

    nearbyLocationButton.disabled = true;
    nearbyLocationButton.textContent = "Getting location...";

    navigator.geolocation.getCurrentPosition(
      (position) => {
        nearbyLatInput.value = position.coords.latitude.toFixed(6);
        nearbyLngInput.value = position.coords.longitude.toFixed(6);
        nearbyLocationButton.disabled = false;
        nearbyLocationButton.textContent = "Use my current location";
        nearbyLatInput.form.submit();
      },
      () => {
        window.alert("Could not get your current location.");
        nearbyLocationButton.disabled = false;
        nearbyLocationButton.textContent = "Use my current location";
      },
      {
        enableHighAccuracy: true,
        timeout: 10000
      }
    );
  });
}

if (nearbyLocationHelp && geolocationNeedsHttps()) {
  nearbyLocationHelp.textContent = "Current location on the live site needs HTTPS. For now, use testing coordinates or add a domain with SSL.";
}

if (
  nearbyLatInput
  && nearbyLngInput
  && !nearbyLatInput.value
  && !nearbyLngInput.value
  && navigator.geolocation
  && !geolocationNeedsHttps()
) {
  const alreadyTried = window.sessionStorage.getItem("nearby-autolocate-attempted");

  if (!alreadyTried) {
    window.sessionStorage.setItem("nearby-autolocate-attempted", "1");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        nearbyLatInput.value = position.coords.latitude.toFixed(6);
        nearbyLngInput.value = position.coords.longitude.toFixed(6);
        nearbyLatInput.form.submit();
      },
      () => {
        window.sessionStorage.setItem("nearby-autolocate-attempted", "denied");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000
      }
    );
  }
}

const nearbyMapElement = document.getElementById("nearby-map");
const nearbyMapDataElement = document.getElementById("nearby-map-data");

if (nearbyMapElement && nearbyMapDataElement && window.L) {
  const mapData = JSON.parse(nearbyMapDataElement.textContent);
  const map = window.L.map("nearby-map");

  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const bounds = [];
  const userMarker = window.L.marker([mapData.userLocation.lat, mapData.userLocation.lng])
    .addTo(map)
    .bindPopup(mapData.userLocation.label || "Chosen location");

  bounds.push([mapData.userLocation.lat, mapData.userLocation.lng]);

  mapData.places.forEach((place) => {
    const marker = window.L.marker([place.lat, place.lng]).addTo(map);
    marker.bindPopup(
      `<strong>${escapeHtml(place.name)}</strong><br>${escapeHtml(place.suburb)}<br>${place.distanceKm.toFixed(1)} km<br><a href="/places/${encodeURIComponent(place.slug)}">View details</a>`
    );
    bounds.push([place.lat, place.lng]);
  });

  if (bounds.length === 1) {
    map.setView(bounds[0], 14);
    userMarker.openPopup();
  } else {
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
