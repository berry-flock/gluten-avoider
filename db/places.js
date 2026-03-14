const { all, get } = require("./connection");
const { attachOpenSummary } = require("../utils/opening-hours");
const { sortTagsForDisplay } = require("../utils/tag-groups");
const { haversineDistanceKm } = require("../utils/distance");

const STATUS_VALUES = ["trusted", "want_to_try", "avoid"];
const CONFIDENCE_VALUES = ["strong", "partial", "uncertain", "unknown"];
const SORT_VALUES = ["recommended", "alphabetical", "recently_updated", "featured"];
const PLAN_STATUS_VALUES = ["all", "trusted", "want_to_try"];

function normalizeFilters(rawQuery = {}) {
  const search = typeof rawQuery.search === "string" ? rawQuery.search.trim() : "";
  const status = STATUS_VALUES.includes(rawQuery.status) ? rawQuery.status : "";
  const gfConfidence = CONFIDENCE_VALUES.includes(rawQuery.gf_confidence)
    ? rawQuery.gf_confidence
    : "";
  const sort = SORT_VALUES.includes(rawQuery.sort) ? rawQuery.sort : "recommended";
  const featuredOnly = rawQuery.featured === "1";
  const openNow = rawQuery.open_now === "1";
  const tags = normalizeArray(rawQuery.tags);

  return {
    featuredOnly,
    gfConfidence,
    openNow,
    search,
    sort,
    status,
    tags
  };
}

async function getHomepageData() {
  const planPreviewPlaces = await all(
    `SELECT p.*
     FROM places p
     WHERE p.is_public = 1 AND p.status = 'want_to_try'
     ORDER BY
       datetime(p.updated_at) DESC
     LIMIT 3`
  );

  await attachTags(planPreviewPlaces);
  await attachOpeningHours(planPreviewPlaces);

  return { planPreviewPlaces };
}

async function listPublicPlaces(rawQuery = {}) {
  const filters = normalizeFilters(rawQuery);
  const places = await queryPublicPlaces(filters, getOrderByClause(filters.sort));

  await attachTags(places);
  await attachOpeningHours(places);

  return {
    filters,
    places: filters.openNow
      ? places.filter((place) => place.openSummary && place.openSummary.isOpen)
      : places
  };
}

async function listNearbyPlaces(rawQuery = {}) {
  const filters = {
    ...normalizeFilters(rawQuery),
    featuredOnly: false,
    openNow: true
  };
  const location = normalizeLocation(rawQuery);

  if (!location.hasCoordinates) {
    return {
      filters,
      location,
      places: []
    };
  }

  const places = await queryPublicPlaces(filters, getOrderByClause("recommended"));

  await attachTags(places);
  await attachOpeningHours(places);

  const nearbyPlaces = places
    .filter((place) => hasCoordinates(place))
    .map((place) => ({
      ...place,
      distance_km: haversineDistanceKm(
        location.latitude,
        location.longitude,
        Number(place.latitude),
        Number(place.longitude)
      )
    }))
    .filter((place) => !filters.openNow || (place.openSummary && place.openSummary.isOpen))
    .sort(compareNearbyPlaces);

  return {
    filters,
    location,
    places: nearbyPlaces
  };
}

async function listPlanPlaces(rawQuery = {}) {
  const filters = normalizePlanFilters(rawQuery);

  const places = await queryPublicPlaces(filters, getPlanOrderByClause());

  await attachTags(places);
  await attachOpeningHours(places);

  return {
    filters,
    places
  };
}

async function getHomePreviewData(rawQuery = {}) {
  const location = normalizeLocation(rawQuery);

  if (!location.hasCoordinates) {
    return {
      location,
      mapPlaces: [],
      nearbyPlaces: []
    };
  }

  const nearbyPlaces = (await listNearbyPlaces({
    lat: location.latitude,
    lng: location.longitude,
    status: "trusted"
  })).places.slice(0, 3);

  const allPlaces = await queryPublicPlaces({
    featuredOnly: false,
    gfConfidence: "",
    openNow: false,
    search: "",
    sort: "recommended",
    status: "",
    tags: []
  }, getOrderByClause("recommended"));

  await attachTags(allPlaces);
  await attachOpeningHours(allPlaces);

  const mapPlaces = allPlaces
    .filter((place) => hasCoordinates(place))
    .map((place) => ({
      ...place,
      distance_km: haversineDistanceKm(
        location.latitude,
        location.longitude,
        Number(place.latitude),
        Number(place.longitude)
      )
    }))
    .sort((left, right) => left.distance_km - right.distance_km)
    .slice(0, 12);

  return {
    location,
    mapPlaces,
    nearbyPlaces
  };
}

async function getPublicPlaceBySlug(slug) {
  const place = await get(
    `SELECT p.*
     FROM places p
     WHERE p.slug = ? AND p.is_public = 1`,
    [slug]
  );

  if (!place) {
    return null;
  }

  await attachTags([place]);
  await attachOpeningHours([place]);

  return place;
}

async function attachTags(places) {
  if (!places.length) {
    return;
  }

  const placeIds = places.map((place) => place.id);
  const placeholders = placeIds.map(() => "?").join(", ");

  const tagRows = await all(
    `SELECT
       pt.place_id,
       t.id,
       t.name,
       t.slug,
       t.category,
       COALESCE(t.tag_group, 'category') AS tag_group
     FROM place_tags pt
     JOIN tags t ON t.id = pt.tag_id
     WHERE pt.place_id IN (${placeholders})
     ORDER BY
       CASE t.category
         WHEN 'meal' THEN 1
         WHEN 'style' THEN 2
         WHEN 'dietary' THEN 3
         WHEN 'logistics' THEN 4
         ELSE 5
       END,
       t.name ASC`,
    placeIds
  );

  const tagsByPlaceId = new Map();

  for (const row of tagRows) {
    if (!tagsByPlaceId.has(row.place_id)) {
      tagsByPlaceId.set(row.place_id, []);
    }

    tagsByPlaceId.get(row.place_id).push({
      category: row.category,
      id: row.id,
      name: row.name,
      slug: row.slug,
      tag_group: row.tag_group
    });
  }

  for (const place of places) {
    place.tags = sortTagsForDisplay(tagsByPlaceId.get(place.id) || []);
  }
}

async function attachOpeningHours(places) {
  if (!places.length) {
    return;
  }

  const placeIds = places.map((place) => place.id);
  const placeholders = placeIds.map(() => "?").join(", ");
  const hourRows = await all(
    `SELECT
       oh.place_id,
       oh.id,
       oh.day_of_week,
       oh.open_time,
       oh.close_time,
       oh.is_closed,
       oh.sort_order
     FROM opening_hours oh
     WHERE oh.place_id IN (${placeholders})
     ORDER BY oh.day_of_week ASC, oh.sort_order ASC, oh.open_time ASC`,
    placeIds
  );

  const hoursByPlaceId = new Map();

  for (const row of hourRows) {
    if (!hoursByPlaceId.has(row.place_id)) {
      hoursByPlaceId.set(row.place_id, []);
    }

    hoursByPlaceId.get(row.place_id).push({
      close_time: row.close_time,
      day_of_week: row.day_of_week,
      id: row.id,
      is_closed: Boolean(row.is_closed),
      open_time: row.open_time,
      sort_order: row.sort_order
    });
  }

  for (const place of places) {
    place.openingHours = hoursByPlaceId.get(place.id) || [];
    attachOpenSummary(place);
  }
}

async function queryPublicPlaces(filters, orderByClause) {
  const whereParts = ["p.is_public = 1", "p.status != 'avoid'"];
  const params = [];

  if (filters.status) {
    whereParts.push("p.status = ?");
    params.push(filters.status);
  }

  if (filters.gfConfidence) {
    whereParts.push("p.gf_confidence = ?");
    params.push(filters.gfConfidence);
  }

  if (filters.featuredOnly) {
    whereParts.push("p.featured = 1");
  }

  if (filters.tags.length) {
    const placeholders = filters.tags.map(() => "?").join(", ");
    whereParts.push(
      `p.id IN (
        SELECT pt.place_id
        FROM place_tags pt
        JOIN tags t ON t.id = pt.tag_id
        WHERE t.slug IN (${placeholders})
        GROUP BY pt.place_id
        HAVING COUNT(DISTINCT t.slug) = ?
      )`
    );
    params.push(...filters.tags, filters.tags.length);
  }

  if (filters.search) {
    const searchValue = `%${filters.search}%`;
    whereParts.push(
      `(
        p.name LIKE ?
        OR p.suburb LIKE ?
        OR p.address LIKE ?
        OR p.notes_public LIKE ?
        OR EXISTS (
          SELECT 1
          FROM place_tags pt
          JOIN tags t ON t.id = pt.tag_id
          WHERE pt.place_id = p.id
            AND (t.name LIKE ? OR t.slug LIKE ?)
        )
      )`
    );
    params.push(
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue
    );
  }

  return all(
    `SELECT p.*
     FROM places p
     WHERE ${whereParts.join(" AND ")}
     ORDER BY ${orderByClause}`,
    params
  );
}

function getOrderByClause(sort) {
  if (sort === "alphabetical") {
    return "p.name COLLATE NOCASE ASC";
  }

  if (sort === "recently_updated") {
    return "datetime(p.updated_at) DESC, p.name COLLATE NOCASE ASC";
  }

  if (sort === "featured") {
    return "p.featured DESC, datetime(p.updated_at) DESC, p.name COLLATE NOCASE ASC";
  }

  return `
    p.featured DESC,
    CASE p.status
      WHEN 'trusted' THEN 1
      WHEN 'want_to_try' THEN 2
      ELSE 3
    END,
    CASE p.gf_confidence
      WHEN 'strong' THEN 1
      WHEN 'partial' THEN 2
      WHEN 'uncertain' THEN 3
      ELSE 4
    END,
    datetime(p.updated_at) DESC,
    p.name COLLATE NOCASE ASC
  `;
}

function getPlanOrderByClause() {
  return `
    CASE p.status
      WHEN 'trusted' THEN 1
      WHEN 'want_to_try' THEN 2
      ELSE 3
    END,
    datetime(p.updated_at) DESC,
    p.name COLLATE NOCASE ASC
  `;
}

function normalizeArray(value) {
  if (!value) {
    return [];
  }

  const list = Array.isArray(value) ? value : [value];

  return list
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function normalizePlanFilters(rawQuery = {}) {
  const baseFilters = normalizeFilters(rawQuery);
  const day = Number.isInteger(Number(rawQuery.day)) && Number(rawQuery.day) >= 0 && Number(rawQuery.day) <= 6
    ? Number(rawQuery.day)
    : 6;
  const statusPreference = PLAN_STATUS_VALUES.includes(rawQuery.status_preference)
    ? rawQuery.status_preference
    : "all";

  return {
    ...baseFilters,
    day,
    featuredOnly: false,
    openNow: false,
    sort: "recommended",
    status: statusPreference === "all" ? "" : statusPreference,
    statusPreference
  };
}

function normalizeLocation(rawQuery = {}) {
  const latitude = parseCoordinate(rawQuery.lat);
  const longitude = parseCoordinate(rawQuery.lng);

  return {
    hasCoordinates: latitude !== null && longitude !== null,
    latitude,
    longitude
  };
}

function parseCoordinate(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function hasCoordinates(place) {
  return place.latitude !== null
    && place.latitude !== ""
    && place.longitude !== null
    && place.longitude !== ""
    && Number.isFinite(Number(place.latitude))
    && Number.isFinite(Number(place.longitude));
}

function compareNearbyPlaces(left, right) {
  const distanceDifference = left.distance_km - right.distance_km;

  if (Math.abs(distanceDifference) > 0.15) {
    return distanceDifference;
  }

  const statusDifference = statusRank(left.status) - statusRank(right.status);

  if (statusDifference !== 0) {
    return statusDifference;
  }

  return left.name.localeCompare(right.name);
}

function statusRank(status) {
  return {
    trusted: 1,
    want_to_try: 2,
    avoid: 3
  }[status] || 4;
}

module.exports = {
  CONFIDENCE_VALUES,
  SORT_VALUES,
  STATUS_VALUES,
  PLAN_STATUS_VALUES,
  getHomePreviewData,
  getHomepageData,
  listPlanPlaces,
  getPublicPlaceBySlug,
  listNearbyPlaces,
  listPublicPlaces,
  normalizeFilters
};
