const nearbyLocationButton = document.getElementById("nearby-use-location");
const nearbyLatInput = document.getElementById("nearby-lat-input");
const nearbyLngInput = document.getElementById("nearby-lng-input");
const nearbyLocationHelp = document.getElementById("nearby-location-help");
const nearbyLocationDebug = document.getElementById("nearby-location-debug");

function geolocationNeedsHttps() {
  return !window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
}

function setLocationMessage(message) {
  if (nearbyLocationHelp) {
    nearbyLocationHelp.textContent = message;
  }
}

function setDebugMessage(message) {
  if (nearbyLocationDebug) {
    nearbyLocationDebug.textContent = message;
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

async function updatePermissionDebug() {
  if (!nearbyLocationDebug) {
    return;
  }

  const parts = [
    `Secure context: ${window.isSecureContext ? "yes" : "no"}`,
    `Geolocation API: ${navigator.geolocation ? "available" : "missing"}`
  ];

  if (navigator.permissions && navigator.permissions.query) {
    try {
      const result = await navigator.permissions.query({ name: "geolocation" });
      parts.push(`Permission state: ${result.state}`);
    } catch (error) {
      parts.push("Permission state: unavailable");
    }
  } else {
    parts.push("Permission state: unsupported");
  }

  setDebugMessage(parts.join(" | "));
}

if (nearbyLocationButton && nearbyLatInput && nearbyLngInput) {
  nearbyLocationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
      setLocationMessage("Geolocation is not available in this browser.");
      return;
    }

    if (geolocationNeedsHttps()) {
      setLocationMessage("Current location on the live site needs HTTPS. It will work once the domain has SSL.");
      return;
    }

    nearbyLocationButton.disabled = true;
    nearbyLocationButton.textContent = "Getting location...";
    setLocationMessage("Requesting your current location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        nearbyLatInput.value = position.coords.latitude.toFixed(6);
        nearbyLngInput.value = position.coords.longitude.toFixed(6);
        nearbyLocationButton.disabled = false;
        nearbyLocationButton.textContent = "Use my current location";
        setLocationMessage(`Location found at ${nearbyLatInput.value}, ${nearbyLngInput.value}.`);
        nearbyLatInput.form.submit();
      },
      (error) => {
        nearbyLocationButton.disabled = false;
        nearbyLocationButton.textContent = "Use my current location";
        setLocationMessage(`Could not get your current location. ${geolocationErrorMessage(error)}`);
        updatePermissionDebug();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000
      }
    );
  });
}

if (nearbyLocationHelp && geolocationNeedsHttps()) {
  setLocationMessage("Current location on the live site needs HTTPS. For now, use testing coordinates or add a domain with SSL.");
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
      (error) => {
        window.sessionStorage.setItem("nearby-autolocate-attempted", "denied");
        setLocationMessage(`Automatic location failed. ${geolocationErrorMessage(error)}`);
        updatePermissionDebug();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000
      }
    );
  }
}

updatePermissionDebug();

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
