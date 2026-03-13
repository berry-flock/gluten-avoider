const locationButton = document.getElementById("use-current-location");
const latitudeInput = document.getElementById("latitude-input");
const longitudeInput = document.getElementById("longitude-input");

if (locationButton && latitudeInput && longitudeInput) {
  locationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
      window.alert("Geolocation is not available in this browser.");
      return;
    }

    locationButton.disabled = true;
    locationButton.textContent = "Getting location...";

    navigator.geolocation.getCurrentPosition(
      (position) => {
        latitudeInput.value = position.coords.latitude.toFixed(6);
        longitudeInput.value = position.coords.longitude.toFixed(6);
        locationButton.disabled = false;
        locationButton.textContent = "Use current location";
      },
      () => {
        window.alert("Could not get your current location.");
        locationButton.disabled = false;
        locationButton.textContent = "Use current location";
      },
      {
        enableHighAccuracy: true,
        timeout: 10000
      }
    );
  });
}
