const { DAY_LABELS, formatHoursRange } = require("./opening-hours");

function installViewHelpers(app) {
  app.locals.currentYear = new Date().getFullYear();
  app.locals.formatStatus = formatStatus;
  app.locals.formatConfidence = formatConfidence;
  app.locals.excerpt = excerpt;
  app.locals.badgeClass = badgeClass;
  app.locals.dayLabels = DAY_LABELS;
  app.locals.formatHoursRange = formatHoursRange;
  app.locals.hasSelectedTag = hasSelectedTag;
  app.locals.isOpenNowClass = isOpenNowClass;
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

module.exports = {
  installViewHelpers
};
