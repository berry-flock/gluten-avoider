const express = require("express");
const {
  SORT_VALUES,
  STATUS_VALUES,
  getHomepageData,
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
    const [{ featuredPlaces, recentPlaces }, availableTags] = await Promise.all([
      getHomepageData(),
      listPublicTags()
    ]);

    res.render("home", {
      groupedTags: getGroupedTags(availableTags),
      featuredPlaces,
      pageTitle: "Trusted food places",
      recentPlaces
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
    const [{ filters, location, places }, availableTags] = await Promise.all([
      listNearbyPlaces(req.query),
      listPublicTags()
    ]);
    const menuTagGroup = getGroupedTags(availableTags).find((group) => group.key === "menu_items") || null;

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
      menuTagGroup,
      pageTitle: "Nearby now",
      places,
      statusValues: STATUS_VALUES
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
    const menuTagGroup = groupedTags.find((group) => group.key === "menu_items") || null;
    const trustedPlaces = places.filter((place) => place.status === "trusted");
    const wantToTryPlaces = places.filter((place) => place.status === "want_to_try");

    res.render("plan", {
      categoryTagGroup,
      filters,
      menuTagGroup,
      pageTitle: "Plan later",
      trustedPlaces,
      wantToTryPlaces
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
