const express = require("express");
const {
  MAP_AVAILABILITY_VALUES,
  PLAN_STATUS_VALUES,
  STATUS_VALUES,
  getHomePreviewData,
  getPublicPlaceBySlug,
  listMapPlaces,
  listNearbyPlaces,
  listPlanPlaces,
  listTopSuburbs
} = require("../db/places");
const { listPublicTags } = require("../db/tags");
const { getGroupedTags } = require("../utils/tag-groups");

const router = express.Router();
const MAP_ASSET_VERSION = "20260405-2";
const MAP_EXTRA_HEAD = `
    <link rel="stylesheet" href="/leaflet.css?v=${MAP_ASSET_VERSION}" />
    <style>
      .leaflet-container img.leaflet-tile { mix-blend-mode: normal; }
    </style>`;

router.get("/", async (req, res, next) => {
  try {
    const now = new Date();
    const defaultPlanMeal = now.getHours() < 11 ? "breakfast" : now.getHours() < 17 ? "lunch" : "dinner";
    const defaultNearbyMeal = "open";
    const [availableTags, topSuburbs] = await Promise.all([
      listPublicTags(),
      listTopSuburbs(3)
    ]);
    const menuTagGroup = getGroupedTags(availableTags).find((group) => group.key === "menu_items") || null;

    res.render("home", {
      defaultPlanDay: new Date().getDay(),
      defaultPlanMeal,
      defaultPlanTime: `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`,
      defaultNearbyMeal,
      extraHead: MAP_EXTRA_HEAD,
      foodFeelingTags: menuTagGroup ? menuTagGroup.tags : [],
      mapAvailabilityValues: MAP_AVAILABILITY_VALUES,
      pageTitle: "Gluten Avoider",
      topSuburbs
    });
  } catch (error) {
    next(error);
  }
});

router.get("/home/preview-data", async (req, res, next) => {
  try {
    const { filters, location, mapPlaces, nearbyPlaces } = await getHomePreviewData(req.query);

    res.json({
      filters,
      hasCoordinates: location.hasCoordinates,
      mapPlaces: mapPlaces.map((place) => ({
        lat: Number(place.latitude),
        lng: Number(place.longitude),
        name: place.name,
        isOpen: Boolean(place.selectedAvailability && place.selectedAvailability.isOpen),
        slug: place.slug,
        suburb: place.suburb
      })),
      nearbyPlaces: nearbyPlaces.map((place) => ({
        menuItems: (place.tags || [])
          .filter((tag) => tag.tag_group === "menu_items")
          .slice(0, 3),
        menuUrl: place.website_url || "",
        name: place.name,
        notesPublic: place.notes_public || "",
        openSummary: place.selectedAvailability || place.openSummary,
        slug: place.slug,
        status: place.status,
        suburb: place.suburb
      })),
      location: {
        latitude: location.latitude,
        longitude: location.longitude
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/places", async (req, res, next) => {
  try {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(req.query || {})) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item !== undefined && item !== null && item !== "") {
            params.append(key, String(item));
          }
        });
        continue;
      }

      params.set(key, String(value));
    }

    if (params.get("open_now") === "1" && !params.has("meal")) {
      params.set("meal", "open");
    }

    params.delete("open_now");
    params.delete("sort");
    params.delete("featured");
    params.delete("gf_confidence");

    res.redirect(`/plan${params.toString() ? `?${params.toString()}` : ""}`);
  } catch (error) {
    next(error);
  }
});

router.get("/places/:slug", async (req, res, next) => {
  try {
    const place = await getPublicPlaceBySlug(req.params.slug);

    if (!place) {
      res.status(404).render("errors/404", {
        pageTitle: "Place not found"
      });
      return;
    }

    res.render("places/show", {
      pageTitle: place.name,
      place
    });
  } catch (error) {
    next(error);
  }
});

router.get("/map", (req, res) => {
  res.redirect("/map/view");
});

router.get("/map/view", async (req, res, next) => {
  try {
    const [{ filters, places, suburbs, location }, availableTags] = await Promise.all([
      listMapPlaces(req.query),
      listPublicTags()
    ]);

    res.render("map", {
      extraHead: MAP_EXTRA_HEAD,
      filters,
      groupedTags: getGroupedTags(availableTags),
      location,
      mapAvailabilityValues: MAP_AVAILABILITY_VALUES,
      mappablePlaces: places,
      pageTitle: "Map view",
      placesWithoutCoordinates: 0,
      suburbs,
      statusValues: STATUS_VALUES
    });
  } catch (error) {
    next(error);
  }
});

router.get("/nearby", async (req, res, next) => {
  try {
    const { filters, location, places } = await listNearbyPlaces(req.query);

    res.render("nearby", {
      extraHead: location.hasCoordinates ? MAP_EXTRA_HEAD : "",
      filters,
      location,
      pageTitle: "Nearby now",
      places,
      statusValues: STATUS_VALUES.filter((status) => status !== "avoid")
    });
  } catch (error) {
    next(error);
  }
});

router.get("/plan", async (req, res, next) => {
  try {
    const [{ filters, places }, availableTags] = await Promise.all([
      listPlanPlaces(req.query),
      listPublicTags()
    ]);
    const groupedTags = getGroupedTags(availableTags);
    const categoryTagGroup = groupedTags.find((group) => group.key === "category") || null;
    const glutenTagGroup = groupedTags.find((group) => group.key === "gluten_features") || null;
    const menuTagGroup = groupedTags.find((group) => group.key === "menu_items") || null;
    const filteredPlaces = filterPlanPlacesByTagGroups(places, filters.tags, availableTags);
    const trustedPlaces = filteredPlaces.filter((place) => place.status === "trusted");
    const wantToTryPlaces = filteredPlaces.filter((place) => place.status === "want_to_try");

    res.render("plan", {
      categoryTagGroup,
      filters,
      glutenTagGroup,
      menuTagGroup,
      planStatusValues: PLAN_STATUS_VALUES,
      pageTitle: "Plan later",
      trustedPlaces,
      wantToTryPlaces
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

function filterPlanPlacesByTagGroups(places, selectedTagSlugs, availableTags) {
  if (!selectedTagSlugs.length) {
    return places;
  }

  const tagsBySlug = new Map(availableTags.map((tag) => [tag.slug, tag]));
  const selectedGroups = {
    category: [],
    gluten_features: [],
    menu_items: []
  };

  for (const slug of selectedTagSlugs) {
    const tag = tagsBySlug.get(slug);

    if (tag && selectedGroups[tag.tag_group]) {
      selectedGroups[tag.tag_group].push(slug);
    }
  }

  return places.filter((place) => {
    const placeTagSlugs = new Set((place.tags || []).map((tag) => tag.slug));

    return Object.entries(selectedGroups).every(([, groupSlugs]) => {
      if (!groupSlugs.length) {
        return true;
      }

      return groupSlugs.some((slug) => placeTagSlugs.has(slug));
    });
  });
}
