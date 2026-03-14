const locationButton = document.getElementById("use-current-location");
const latitudeInput = document.getElementById("latitude-input");
const longitudeInput = document.getElementById("longitude-input");

function geolocationNeedsHttps() {
  return !window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
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

if (locationButton && latitudeInput && longitudeInput) {
  locationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
      window.alert("Geolocation is not available in this browser.");
      return;
    }

    if (geolocationNeedsHttps()) {
      window.alert("Current location on the live site needs HTTPS. It will work once the domain has SSL.");
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
      (error) => {
        window.alert(`Could not get your current location. ${geolocationErrorMessage(error)}`);
        locationButton.disabled = false;
        locationButton.textContent = "Use current location";
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000
      }
    );
  });
}

document.querySelectorAll(".tag-picker").forEach((picker) => {
  const limit = Number(picker.dataset.tagLimit || "3");
  const existingTags = JSON.parse(picker.dataset.existingTags || "[]");
  const selectedTagsContainer = picker.querySelector("[data-selected-tags]");
  const hiddenExistingContainer = picker.querySelector("[data-hidden-existing]");
  const hiddenNewTagsInput = picker.querySelector("[data-new-tags-hidden]");
  const tagInput = picker.querySelector("[data-tag-input]");
  const addButton = picker.querySelector("[data-add-tag]");
  const errorElement = picker.querySelector("[data-tag-error]");
  const selectedExistingIds = new Set(
    Array.from(hiddenExistingContainer.querySelectorAll("[data-existing-input]")).map((input) => input.value)
  );
  const selectedNewTags = new Set(
    String(hiddenNewTagsInput.value || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );

  function renderNewTagsValue() {
    hiddenNewTagsInput.value = Array.from(selectedNewTags).join(", ");
  }

  function totalSelected() {
    return selectedExistingIds.size + selectedNewTags.size;
  }

  function setError(message) {
    if (!errorElement) {
      return;
    }

    errorElement.hidden = !message;
    errorElement.textContent = message;
  }

  function makeChip(label, attributes = {}) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = attributes.newTag ? "tag-picker__chip tag-picker__chip--new" : "tag-picker__chip";

    if (attributes.existingId) {
      chip.dataset.existingId = attributes.existingId;
    }

    if (attributes.newTag) {
      chip.dataset.newTag = attributes.newTag;
    }

    chip.innerHTML = `<span>${escapeHtml(label)}</span><strong aria-hidden="true">×</strong>`;
    selectedTagsContainer.appendChild(chip);
  }

  function addTag() {
    const rawValue = String(tagInput.value || "").trim();

    if (!rawValue) {
      return;
    }

    if (totalSelected() >= limit) {
      setError(`Limit this group to ${limit} tags.`);
      return;
    }

    const existingTag = existingTags.find((tag) => tag.name.toLowerCase() === rawValue.toLowerCase());

    if (existingTag) {
      if (selectedExistingIds.has(existingTag.id)) {
        tagInput.value = "";
        setError("");
        return;
      }

      selectedExistingIds.add(existingTag.id);
      const hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.name = "tag_ids";
      hiddenInput.value = existingTag.id;
      hiddenInput.dataset.existingInput = existingTag.id;
      hiddenExistingContainer.appendChild(hiddenInput);
      makeChip(existingTag.name, { existingId: existingTag.id });
    } else {
      const normalizedExistingName = existingTags.find((tag) => tag.name.toLowerCase() === rawValue.toLowerCase());

      if (!normalizedExistingName && !selectedNewTags.has(rawValue)) {
        selectedNewTags.add(rawValue);
        renderNewTagsValue();
        makeChip(rawValue, { newTag: rawValue });
      }
    }

    tagInput.value = "";
    setError("");
  }

  addButton.addEventListener("click", addTag);
  tagInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag();
    }
  });

  selectedTagsContainer.addEventListener("click", (event) => {
    const chip = event.target.closest(".tag-picker__chip");

    if (!chip) {
      return;
    }

    if (chip.dataset.existingId) {
      selectedExistingIds.delete(chip.dataset.existingId);
      const hiddenInput = hiddenExistingContainer.querySelector(`[data-existing-input="${chip.dataset.existingId}"]`);

      if (hiddenInput) {
        hiddenInput.remove();
      }
    }

    if (chip.dataset.newTag) {
      selectedNewTags.delete(chip.dataset.newTag);
      renderNewTagsValue();
    }

    chip.remove();
    setError("");
  });
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
