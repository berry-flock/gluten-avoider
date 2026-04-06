const feelingsDataElement = document.getElementById("feelings-data");
const feelingsPanelElement = document.getElementById("feelings-panel");
const feelingsStageElement = document.getElementById("feelings-stage");
const feelingsMenuTagsElement = document.getElementById("feelings-menu-tags");
const feelingsOccasionTagsElement = document.getElementById("feelings-occasion-tags");
const feelingsVibeEmptyElement = document.getElementById("feelings-vibe-empty");
const feelingsResultsBlockElement = document.getElementById("feelings-results-block");
const feelingsResultsElement = document.getElementById("feelings-results");
const feelingsResultsCountElement = document.getElementById("feelings-results-count");
const feelingsResultsCopyElement = document.getElementById("feelings-results-copy");
const feelingsResultsFoodSlotElement = document.getElementById("feelings-results-slot-food");
const feelingsResultsVibeSlotElement = document.getElementById("feelings-results-slot-vibe");
const feelingsRefreshButton = document.getElementById("feelings-refresh");
const feelingsVibeToggleButton = document.getElementById("feelings-vibe-toggle");
const feelingsAvailabilityButtons = Array.from(document.querySelectorAll("[data-feelings-availability]"));

if (
  feelingsDataElement
  && feelingsMenuTagsElement
  && feelingsResultsElement
  && feelingsResultsBlockElement
  && feelingsResultsFoodSlotElement
  && feelingsResultsVibeSlotElement
) {
  const data = JSON.parse(feelingsDataElement.textContent);
  const state = {
    activeMenuSlug: data.initialFoodSlug || "",
    activeOccasionSlugs: new Set(),
    availability: data.initialAvailability || "open",
    isVibeMode: data.initialMode === "vibe",
    userLocation: null
  };
  const menuTagLookup = new Map(data.menuTags.map((tag) => [tag.slug, tag.name]));

  normalizeSelections();
  renderMenuTagStage(true);
  renderOccasionTags();
  renderResults();
  syncLayout();
  syncAvailabilityButtons();
  requestUserLocation();

  if (feelingsRefreshButton) {
    feelingsRefreshButton.addEventListener("click", () => {
      state.activeMenuSlug = "";
      normalizeSelections();
      renderMenuTagStage(false);
      renderOccasionTags();
      renderResults();
      syncLayout();
    });
  }

  if (feelingsVibeToggleButton) {
    feelingsVibeToggleButton.addEventListener("click", () => {
      state.isVibeMode = !state.isVibeMode;

      if (state.isVibeMode) {
        state.activeMenuSlug = "";
      }

      normalizeSelections();
      renderMenuTagStage(true);
      renderOccasionTags();
      renderResults();
      syncLayout();
    });
  }

  feelingsAvailabilityButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.availability = button.dataset.feelingsAvailability || "open";
      normalizeSelections();
      renderMenuTagStage(false);
      renderOccasionTags();
      renderResults();
      syncLayout();
      syncAvailabilityButtons();
    });
  });

  feelingsMenuTagsElement.addEventListener("click", (event) => {
    const button = event.target.closest("[data-feelings-menu]");

    if (!button) {
      return;
    }

    const slug = button.dataset.feelingsMenu || "";
    state.activeMenuSlug = state.activeMenuSlug === slug ? "" : slug;
    state.isVibeMode = false;
    normalizeSelections();
    renderMenuTagStage(true);
    renderOccasionTags();
    renderResults();
    syncLayout();
  });

  if (feelingsOccasionTagsElement) {
    feelingsOccasionTagsElement.addEventListener("click", (event) => {
      const button = event.target.closest("[data-feelings-occasion]");

      if (!button) {
        return;
      }

      const slug = button.dataset.feelingsOccasion || "";

      if (state.activeOccasionSlugs.has(slug)) {
        state.activeOccasionSlugs.delete(slug);
      } else {
        state.activeOccasionSlugs.add(slug);
      }

      normalizeSelections();
      renderMenuTagStage(true);
      renderOccasionTags();
      renderResults();
      syncLayout();
    });
  }

  function requestUserLocation() {
    if (!navigator.geolocation) {
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        state.userLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        renderResults();
      },
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 60000,
        timeout: 12000
      }
    );
  }

  function renderMenuTagStage(isFirstRender) {
    const visibleTags = getVisibleMenuTags();
    const renderedTags = buildRenderedMenuTags(visibleTags);

    if (!renderedTags.length) {
      feelingsMenuTagsElement.innerHTML = `<p class="empty-state">Nothing is lining up for ${escapeHtml(state.availability)} right now.</p>`;
      return;
    }

    feelingsMenuTagsElement.innerHTML = renderedTags.map((tag, index) => `
      <button
        class="feelings-tag ${state.activeMenuSlug === tag.slug ? "feelings-tag--active" : ""}"
        type="button"
        data-feelings-menu="${escapeHtml(tag.slug)}"
        aria-pressed="${state.activeMenuSlug === tag.slug ? "true" : "false"}"
        style="--stagger:${index};"
      >
        <span>${escapeHtml(tag.name)}</span>
      </button>
    `).join("");

    if (!isFirstRender && feelingsStageElement) {
      feelingsStageElement.classList.remove("feelings-stage--shuffle");
      void feelingsStageElement.offsetWidth;
      feelingsStageElement.classList.add("feelings-stage--shuffle");
    }
  }

  function buildRenderedMenuTags(visibleTags) {
    if (!visibleTags.length) {
      return [];
    }

    const selectedTag = state.activeMenuSlug
      ? visibleTags.find((tag) => tag.slug === state.activeMenuSlug) || null
      : null;
    const otherTags = shuffle(visibleTags.filter((tag) => tag.slug !== state.activeMenuSlug));
    const limitedTags = selectedTag ? [selectedTag, ...otherTags] : otherTags;

    return limitedTags.slice(0, Math.min(10, limitedTags.length));
  }

  function getVisibleMenuTags() {
    const visibleSlugs = new Set(
      getAvailablePlaces()
        .filter((place) => state.activeOccasionSlugs.size === 0 || [...state.activeOccasionSlugs].every((slug) => place.occasionTags.some((tag) => tag.slug === slug)))
        .flatMap((place) => place.menuItems.map((tag) => tag.slug))
    );

    return data.menuTags.filter((tag) => visibleSlugs.has(tag.slug));
  }

  function renderOccasionTags() {
    if (!feelingsOccasionTagsElement) {
      return;
    }

    const visibleTags = getVisibleOccasionTags();

    feelingsOccasionTagsElement.innerHTML = visibleTags.map((tag, index) => `
      <button
        class="feelings-vibe-tag ${state.activeOccasionSlugs.has(tag.slug) ? "feelings-vibe-tag--active" : ""}"
        type="button"
        data-feelings-occasion="${escapeHtml(tag.slug)}"
        aria-pressed="${state.activeOccasionSlugs.has(tag.slug) ? "true" : "false"}"
        style="--stagger:${index};"
      >
        ${escapeHtml(tag.name)}
      </button>
    `).join("");

    if (feelingsVibeEmptyElement) {
      feelingsVibeEmptyElement.hidden = visibleTags.length > 0;
    }
  }

  function getVisibleOccasionTags() {
    return data.occasionTags.filter((tag) => {
      if (state.activeOccasionSlugs.has(tag.slug)) {
        return true;
      }

      const testOccasionSlugs = new Set(state.activeOccasionSlugs);
      testOccasionSlugs.add(tag.slug);
      return getMatchingPlaces({
        activeMenuSlug: state.activeMenuSlug,
        activeOccasionSlugs: testOccasionSlugs
      }).length > 0;
    });
  }

  function renderResults() {
    const results = sortPlaces(getMatchingPlaces({
      activeMenuSlug: state.activeMenuSlug,
      activeOccasionSlugs: state.activeOccasionSlugs
    })).slice(0, 12);

    feelingsResultsElement.innerHTML = results.length
      ? results.map(renderCard).join("")
      : `<p class="empty-state">No places matched that combination. Shuffle again or ease off the vibe.</p>`;

    if (feelingsResultsCountElement) {
      feelingsResultsCountElement.textContent = String(results.length);
    }

    if (feelingsResultsCopyElement) {
      feelingsResultsCopyElement.textContent = buildResultsCopy(results.length);
    }
  }

  function sortPlaces(places) {
    return [...places].sort((left, right) => {
      const leftDistance = getDistanceKm(left);
      const rightDistance = getDistanceKm(right);

      if (Number.isFinite(leftDistance) || Number.isFinite(rightDistance)) {
        if (!Number.isFinite(leftDistance)) {
          return 1;
        }

        if (!Number.isFinite(rightDistance)) {
          return -1;
        }

        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }
      }

      return (left.sortIndex || 0) - (right.sortIndex || 0);
    });
  }

  function getDistanceKm(place) {
    if (!state.userLocation) {
      return Number.POSITIVE_INFINITY;
    }

    if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) {
      return Number.POSITIVE_INFINITY;
    }

    return haversineDistanceKm(
      state.userLocation.latitude,
      state.userLocation.longitude,
      place.latitude,
      place.longitude
    );
  }

  function normalizeSelections() {
    const visibleMenuSlugs = new Set(getVisibleMenuTags().map((tag) => tag.slug));

    if (state.activeMenuSlug && !visibleMenuSlugs.has(state.activeMenuSlug)) {
      state.activeMenuSlug = "";
    }

    if (getMatchingPlaces({
      activeMenuSlug: state.activeMenuSlug,
      activeOccasionSlugs: state.activeOccasionSlugs
    }).length > 0) {
      return;
    }

    state.activeOccasionSlugs.clear();
  }

  function syncLayout() {
    const useVibeSlot = state.isVibeMode || state.activeOccasionSlugs.size > 0;
    const targetSlot = useVibeSlot ? feelingsResultsVibeSlotElement : feelingsResultsFoodSlotElement;

    targetSlot.appendChild(feelingsResultsBlockElement);
    feelingsPanelElement?.classList.toggle("feelings-panel--vibe-mode", state.isVibeMode);

    if (feelingsVibeToggleButton) {
      feelingsVibeToggleButton.textContent = state.isVibeMode ? "Back to food tags" : "It's more the vibe...";
    }
  }

  function syncAvailabilityButtons() {
    feelingsAvailabilityButtons.forEach((button) => {
      button.classList.toggle("button--secondary", button.dataset.feelingsAvailability !== state.availability);
    });
  }

  function getAvailablePlaces() {
    return data.places.filter((place) => place.availabilityByMode && place.availabilityByMode[state.availability]);
  }

  function getMatchingPlaces({ activeMenuSlug, activeOccasionSlugs }) {
    return getAvailablePlaces().filter((place) => {
      const menuSlugs = new Set(place.menuItems.map((tag) => tag.slug));
      const occasionSlugs = new Set(place.occasionTags.map((tag) => tag.slug));

      const menuMatch = !activeMenuSlug || menuSlugs.has(activeMenuSlug);
      const occasionMatch = activeOccasionSlugs.size === 0
        || [...activeOccasionSlugs].every((slug) => occasionSlugs.has(slug));

      return menuMatch && occasionMatch;
    });
  }

  function renderCard(place) {
    const occasionMarkup = place.occasionTags.slice(0, 4).map((tag) => `<span class="occasion-chip">${escapeHtml(tag.name)}</span>`).join("");
    const menuMarkup = place.menuItems.slice(0, 5).map((tag) => `<span class="menu-chip menu-chip--menu">${escapeHtml(tag.name)}</span>`).join("");
    const openSummary = place.summaryByMode?.[state.availability] || null;

    return `
      <article class="place-card restaurant-card">
        <a class="restaurant-card__overlay-link" href="/places/${encodeURIComponent(place.slug)}" aria-label="View ${escapeHtml(place.name)}"></a>
        <div class="restaurant-card__header">
          <div class="restaurant-card__title-block">
            <h3 class="place-card__title">${escapeHtml(place.name)}</h3>
            <p class="place-card__suburb">${escapeHtml(place.suburb)}</p>
          </div>
          ${place.menuUrl ? `<a class="menu-link restaurant-card__menu-link" href="${escapeHtml(place.menuUrl)}" target="_blank" rel="noreferrer"><span class="menu-link__icon" aria-hidden="true"></span><span class="sr-only">Menu</span></a>` : ""}
        </div>
        ${renderOpenSummary(openSummary)}
        ${occasionMarkup ? `<div class="restaurant-card__tag-group"><div class="tag-row restaurant-card__tag-row">${occasionMarkup}</div></div>` : ""}
        ${menuMarkup ? `<div class="restaurant-card__tag-group"><p class="restaurant-card__tag-label">On the menu</p><div class="tag-row restaurant-card__tag-row">${menuMarkup}</div></div>` : ""}
      </article>
    `;
  }

  function renderOpenSummary(openSummary) {
    if (!openSummary) {
      return "";
    }

    const primary = escapeHtml(openSummary.primaryLabel || openSummary.label || "");
    const secondary = openSummary.secondaryLabel
      ? `<p class="open-status__secondary">${escapeHtml(openSummary.secondaryLabel)}</p>`
      : "";

    return `<div class="open-status"><p class="nearby-status-line ${openSummary.isOpen ? "open-status__primary--open" : "open-status__primary--closed"}">${primary}</p>${secondary}</div>`;
  }

  function buildResultsCopy(count) {
    if (count === 0) {
      return "No spark yet. Shuffle again or try a different vibe.";
    }

    if (state.userLocation) {
      if (state.activeMenuSlug && state.activeOccasionSlugs.size) {
        return `Showing the closest ${count} place${count === 1 ? "" : "s"} for ${menuTagLookup.get(state.activeMenuSlug) || "this craving"} and this vibe.`;
      }

      if (state.activeMenuSlug) {
        return `Showing the closest ${count} place${count === 1 ? "" : "s"} with ${menuTagLookup.get(state.activeMenuSlug) || "this"} on the menu.`;
      }

      if (state.activeOccasionSlugs.size) {
        return `Showing the closest ${count} place${count === 1 ? "" : "s"} for this vibe.`;
      }
    }

    if (state.activeMenuSlug && state.activeOccasionSlugs.size) {
      return `Showing ${count} place${count === 1 ? "" : "s"} for ${menuTagLookup.get(state.activeMenuSlug) || "this craving"} and this vibe.`;
    }

    if (state.activeMenuSlug) {
      return `Showing ${count} place${count === 1 ? "" : "s"} with ${menuTagLookup.get(state.activeMenuSlug) || "this"} on the menu.`;
    }

    if (state.activeOccasionSlugs.size) {
      return `Showing ${count} place${count === 1 ? "" : "s"} for this vibe.`;
    }

    return "Pick a craving, or skip straight to the vibe.";
  }
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const earthRadiusKm = 6371;
  const toRadians = (value) => (value * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const originLat = toRadians(lat1);
  const targetLat = toRadians(lat2);

  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(originLat) * Math.cos(targetLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function shuffle(items) {
  const list = [...items];

  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
  }

  return list;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
