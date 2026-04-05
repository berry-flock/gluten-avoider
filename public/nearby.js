const nearbyLocationButton = document.getElementById("nearby-use-location");
const nearbyLatInput = document.getElementById("nearby-lat-input");
const nearbyLngInput = document.getElementById("nearby-lng-input");
const nearbyLocationHelp = document.getElementById("nearby-location-help");

function geolocationNeedsHttps() {
  return !window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
}

function setLocationMessage(message) {
  if (nearbyLocationHelp) {
    nearbyLocationHelp.textContent = message;
  }
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

function locationFallbackMessage(error) {
  const baseMessage = "I don't know where you are. You might need to enable location services in your Safari settings. Or search manually below.";
  return error ? `${baseMessage} ${geolocationErrorMessage(error)}` : baseMessage;
}

function requestNearbyLocation() {
  if (!nearbyLocationButton || !nearbyLatInput || !nearbyLngInput) {
    return;
  }

  if (!navigator.geolocation) {
    setLocationMessage(locationFallbackMessage());
    return;
  }

  if (geolocationNeedsHttps()) {
    setLocationMessage("I don't know where you are. Location access on the live site needs HTTPS. Or search manually below.");
    return;
  }

  nearbyLocationButton.disabled = true;
  nearbyLocationButton.textContent = "Trying location...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      nearbyLatInput.value = position.coords.latitude.toFixed(6);
      nearbyLngInput.value = position.coords.longitude.toFixed(6);
      nearbyLocationButton.disabled = false;
      nearbyLocationButton.textContent = "Try location again";
      nearbyLatInput.form.submit();
    },
    (error) => {
      window.sessionStorage.setItem("nearby-autolocate-attempted", "denied");
      nearbyLocationButton.disabled = false;
      nearbyLocationButton.textContent = "Try location again";
      setLocationMessage(locationFallbackMessage(error));
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000
    }
  );
}

if (nearbyLocationButton && nearbyLatInput && nearbyLngInput) {
  nearbyLocationButton.addEventListener("click", requestNearbyLocation);
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
    requestNearbyLocation();
  }
}

const nearbyMapElement = document.getElementById("nearby-map");
const nearbyMapDataElement = document.getElementById("nearby-map-data");

if (nearbyMapElement && nearbyMapDataElement && window.L) {
  const mapData = JSON.parse(nearbyMapDataElement.textContent);
  const map = window.L.map("nearby-map");
  scheduleMapRelayout(map);

  window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
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

  scheduleMapRelayout(map);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function scheduleMapRelayout(map) {
  if (!map) {
    return;
  }

  const refresh = () => map.invalidateSize(false);
  window.requestAnimationFrame(refresh);
  window.setTimeout(refresh, 120);
  window.setTimeout(refresh, 320);
}
