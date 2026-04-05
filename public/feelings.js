const feelingsDataElement = document.getElementById("feelings-data");
const feelingsMenuTagsElement = document.getElementById("feelings-menu-tags");
const feelingsOccasionTagsElement = document.getElementById("feelings-occasion-tags");
const feelingsResultsElement = document.getElementById("feelings-results");
const feelingsResultsCountElement = document.getElementById("feelings-results-count");
const feelingsResultsCopyElement = document.getElementById("feelings-results-copy");
const feelingsRefreshButton = document.getElementById("feelings-refresh");
const feelingsClearButton = document.getElementById("feelings-clear");

if (feelingsDataElement && feelingsMenuTagsElement && feelingsResultsElement) {
  const data = JSON.parse(feelingsDataElement.textContent);
  const state = {
    activeMenuSlugs: new Set(),
    activeOccasionSlugs: new Set(),
    visibleMenuSlugs: []
  };

  renderMenuTagStage(true);
  renderResults();

  if (feelingsRefreshButton) {
    feelingsRefreshButton.addEventListener("click", () => {
      state.activeMenuSlugs.clear();
      renderMenuTagStage(false);
      feelingsMenuTagsElement.classList.remove("feelings-stage__chips--shuffle");
      void feelingsMenuTagsElement.offsetWidth;
      feelingsMenuTagsElement.classList.add("feelings-stage__chips--shuffle");
      seedFreshCravings();
      syncTagButtons();
      renderResults();
    });
  }

  if (feelingsClearButton) {
    feelingsClearButton.addEventListener("click", () => {
      state.activeMenuSlugs.clear();
      state.activeOccasionSlugs.clear();
      syncTagButtons();
      renderResults();
    });
  }

  if (feelingsOccasionTagsElement) {
    feelingsOccasionTagsElement.addEventListener("click", (event) => {
      const button = event.target.closest("[data-feelings-occasion]");

      if (!button) {
        return;
      }

      const slug = button.dataset.feelingsOccasion;

      if (state.activeOccasionSlugs.has(slug)) {
        state.activeOccasionSlugs.delete(slug);
      } else {
        state.activeOccasionSlugs.add(slug);
      }

      syncTagButtons();
      renderResults();
    });
  }

  function renderMenuTagStage(isFirstRender) {
    const tags = shuffle(data.menuTags).slice(0, Math.min(10, data.menuTags.length));
    state.visibleMenuSlugs = tags.map((tag) => tag.slug);

    tags.forEach((tag) => {
      if (isFirstRender && Math.random() > 0.72) {
        state.activeMenuSlugs.add(tag.slug);
      }
    });

    feelingsMenuTagsElement.innerHTML = tags.map((tag, index) => `
      <button
        class="feelings-tag ${state.activeMenuSlugs.has(tag.slug) ? "feelings-tag--active" : ""}"
        type="button"
        data-feelings-menu="${escapeHtml(tag.slug)}"
        style="--stagger:${index};"
      >
        <span>${escapeHtml(tag.name)}</span>
      </button>
    `).join("");

    feelingsMenuTagsElement.onclick = (event) => {
      const button = event.target.closest("[data-feelings-menu]");

      if (!button) {
        return;
      }

      const slug = button.dataset.feelingsMenu;

      if (state.activeMenuSlugs.has(slug)) {
        state.activeMenuSlugs.delete(slug);
      } else {
        state.activeMenuSlugs.add(slug);
      }

      syncTagButtons();
      renderResults();
    };

    syncTagButtons();
  }

  function seedFreshCravings() {
    shuffle(state.visibleMenuSlugs)
      .slice(0, Math.min(2, state.visibleMenuSlugs.length))
      .forEach((slug) => state.activeMenuSlugs.add(slug));
  }

  function syncTagButtons() {
    Array.from(document.querySelectorAll("[data-feelings-menu]")).forEach((button) => {
      button.classList.toggle("feelings-tag--active", state.activeMenuSlugs.has(button.dataset.feelingsMenu));
    });

    Array.from(document.querySelectorAll("[data-feelings-occasion]")).forEach((button) => {
      button.classList.toggle("occasion-chip--active", state.activeOccasionSlugs.has(button.dataset.feelingsOccasion));
      button.setAttribute("aria-pressed", state.activeOccasionSlugs.has(button.dataset.feelingsOccasion) ? "true" : "false");
    });
  }

  function renderResults() {
    const matches = data.places.filter((place) => {
      const menuSlugs = new Set(place.menuItems.map((tag) => tag.slug));
      const occasionSlugs = new Set(place.occasionTags.map((tag) => tag.slug));

      const menuMatch = state.activeMenuSlugs.size === 0
        || [...state.activeMenuSlugs].some((slug) => menuSlugs.has(slug));
      const occasionMatch = state.activeOccasionSlugs.size === 0
        || [...state.activeOccasionSlugs].every((slug) => occasionSlugs.has(slug));

      return menuMatch && occasionMatch;
    });

    const results = shuffle(matches).slice(0, 12);

    feelingsResultsElement.innerHTML = results.length
      ? results.map(renderCard).join("")
      : `<p class="empty-state">No places matched that combo. Try refreshing the menu feelings or clear the occasion filters.</p>`;

    if (feelingsResultsCountElement) {
      feelingsResultsCountElement.textContent = String(results.length);
    }

    if (feelingsResultsCopyElement) {
      feelingsResultsCopyElement.textContent = buildResultsCopy(results.length);
    }
  }

  function renderCard(place) {
    const occasionMarkup = place.occasionTags.slice(0, 4).map((tag) => `<span class="occasion-chip">${escapeHtml(tag.name)}</span>`).join("");
    const menuMarkup = place.menuItems.slice(0, 5).map((tag) => `<span class="menu-chip menu-chip--menu">${escapeHtml(tag.name)}</span>`).join("");

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
        ${renderOpenSummary(place.openSummary)}
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
      return "No spark yet. Shuffle again and loosen the occasion tags.";
    }

    if (state.activeMenuSlugs.size === 0) {
      return "A mix of places to get you out of the “I don’t know” zone.";
    }

    return `Showing ${count} place${count === 1 ? "" : "s"} for this craving.`;
  }
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
