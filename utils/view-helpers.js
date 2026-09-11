const { DAY_LABELS, formatHoursForDay, formatHoursRange } = require("./opening-hours");

function installViewHelpers(app) {
  app.locals.currentYear = new Date().getFullYear();
  app.locals.formatStatus = formatStatus;
  app.locals.formatConfidence = formatConfidence;
  app.locals.excerpt = excerpt;
  app.locals.badgeClass = badgeClass;
  app.locals.buildAppleMapsUrl = buildAppleMapsUrl;
  app.locals.buildGoogleMapsUrl = buildGoogleMapsUrl;
  app.locals.dayLabels = DAY_LABELS;
  app.locals.formatHoursForDay = formatHoursForDay;
  app.locals.formatHoursRange = formatHoursRange;
  app.locals.hasSelectedTag = hasSelectedTag;
  app.locals.isOpenNowClass = isOpenNowClass;
  app.locals.tagsByGroup = tagsByGroup;
  app.locals.jsonForHtml = jsonForHtml;
}

// Serialises a value for embedding in a single-quoted HTML attribute or a
// <script> block. JSON.stringify escapes double quotes but leaves "<" and "'"
// alone, so a name like "Nonna's" or a note containing "</script>" would
// otherwise terminate the attribute or the script element early. Only
// characters that appear inside JSON string values are escaped, so the result
// still parses with JSON.parse.
function jsonForHtml(value) {
  return JSON.stringify(value === undefined ? null : value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/'/g, "\\u0027")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function formatStatus(status) {
  return {
    trusted: "Trusted",
    want_to_try: "Want to try",
    avoid: "Avoid"
  }[status] || status;
}

function formatConfidence(confidence) {
  return {
    strong: "Strong GF confidence",
    partial: "Partial GF confidence",
    uncertain: "Uncertain GF confidence",
    unknown: "Unknown GF confidence"
  }[confidence] || confidence;
}

function excerpt(text, length = 140) {
  if (!text || text.length <= length) {
    return text;
  }

  return `${text.slice(0, length).trim()}...`;
}

function badgeClass(type, value) {
  return `${type}-badge ${type}-badge--${value}`;
}

function hasSelectedTag(filters, slug) {
  return Array.isArray(filters.tags) && filters.tags.includes(slug);
}

function isOpenNowClass(openSummary) {
  return openSummary && openSummary.isOpen ? "hours-pill--open" : "hours-pill--closed";
}

function tagsByGroup(tags, groupKey) {
  return (tags || []).filter((tag) => (tag.tag_group || "category") === groupKey);
}

function buildAppleMapsUrl(place) {
  if (place.latitude !== null && place.latitude !== "" && place.longitude !== null && place.longitude !== "") {
    return `https://maps.apple.com/?ll=${encodeURIComponent(place.latitude)},${encodeURIComponent(place.longitude)}&q=${encodeURIComponent(place.name || place.address || "Location")}`;
  }

  return `https://maps.apple.com/?q=${encodeURIComponent(place.address || place.name || "Location")}`;
}

function buildGoogleMapsUrl(place) {
  if (place.address || place.name) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([place.name, place.address, place.suburb].filter(Boolean).join(", "))}`;
  }

  if (place.latitude !== null && place.latitude !== "" && place.longitude !== null && place.longitude !== "") {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.latitude},${place.longitude}`)}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address || place.name || "Location")}`;
}

module.exports = {
  installViewHelpers
};
