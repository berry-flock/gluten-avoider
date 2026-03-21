const express = require("express");
const {
  PLAN_STATUS_VALUES,
  SORT_VALUES,
  STATUS_VALUES,
  getHomePreviewData,
  getPublicPlaceBySlug,
  listNearbyPlaces,
  listPlanPlaces,
  listPublicPlaces
} = require("../db/places");
const { listPublicTags } = require("../db/tags");
const { getGroupedTags } = require("../utils/tag-groups");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    res.render("home", {
      defaultPlanDay: new Date().getDay(),
      extraHead: `
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />`,
      pageTitle: "Gluten Avoider"
    });
  } catch (error) {
    next(error);
  }
});

router.get("/home/preview-data", async (req, res, next) => {
  try {
    const { location, mapPlaces, nearbyPlaces } = await getHomePreviewData(req.query);

    res.json({
      hasCoordinates: location.hasCoordinates,
      mapPlaces: mapPlaces.map((place) => ({
        lat: Number(place.latitude),
        lng: Number(place.longitude),
        name: place.name,
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
        openSummary: place.openSummary,
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
    const [{ filters, places }, availableTags] = await Promise.all([
      listPublicPlaces(req.query),
      listPublicTags()
    ]);

    res.render("places/index", {
      availableTags,
      filters,
      groupedTags: getGroupedTags(availableTags),
      pageTitle: "Browse places",
      places,
      sortValues: SORT_VALUES.filter((value) => value !== "featured"),
      statusValues: STATUS_VALUES
    });
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
    const [{ filters, places }, availableTags] = await Promise.all([
      listPublicPlaces(req.query),
      listPublicTags()
    ]);
    const mappablePlaces = places.filter((place) => {
      const latitude = Number(place.latitude);
      const longitude = Number(place.longitude);

      return Number.isFinite(latitude) && Number.isFinite(longitude);
    });

    res.render("map", {
      extraHead: `
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />`,
      filters,
      groupedTags: getGroupedTags(availableTags),
      mappablePlaces,
      pageTitle: "Map view",
      placesWithoutCoordinates: places.length - mappablePlaces.length,
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
      extraHead: location.hasCoordinates
        ? `
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />`
        : "",
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
