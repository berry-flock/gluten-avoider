const { STATUS_VALUES } = require("../db/places");
const {
  DAY_LABELS,
  formatHoursForDay,
  formatHoursRange,
  normalizeOpeningHours,
  timeToMinutes
} = require("./opening-hours");

const TAG_GROUP_KEYS = ["category", "menu_items", "gluten_features"];

function buildPlaceFormData(place = {}) {
  const normalizedOpeningHours = normalizeOpeningHours(place.opening_hours || []);

  return {
    address: place.address || "",
    featured: Boolean(place.featured),
    gf_confidence: place.gf_confidence || "unknown",
    google_maps_url: place.google_maps_url || "",
    is_public: place.is_public !== undefined ? Boolean(place.is_public) : true,
    latitude: place.latitude !== undefined && place.latitude !== null ? String(place.latitude) : "",
    longitude: place.longitude !== undefined && place.longitude !== null ? String(place.longitude) : "",
    name: place.name || "",
    new_tags: {
      category: "",
      gluten_features: "",
      menu_items: ""
    },
    notes_private: place.notes_private || "",
    notes_public: place.notes_public || "",
    opening_hours: normalizedOpeningHours,
    opening_hours_text: normalizedOpeningHours.length
      ? formatOpeningHoursText(normalizedOpeningHours)
      : "",
    share_url: "",
    status: place.status || "trusted",
    suburb: place.suburb || "",
    tag_ids: (place.tag_ids || []).map((tagId) => String(tagId)),
    website_url: place.website_url || ""
  };
}

function parsePlaceForm(body) {
  return {
    address: String(body.address || "").trim(),
    featured: body.featured === "1",
    gf_confidence: "unknown",
    google_maps_url: "",
    is_public: body.is_public === "1",
    latitude: String(body.latitude || "").trim(),
    longitude: String(body.longitude || "").trim(),
    name: String(body.name || "").trim(),
    new_tags: parseNewTags(body.new_tags || {}),
    notes_private: String(body.notes_private || "").trim(),
    notes_public: String(body.notes_public || "").trim(),
    opening_hours: [],
    opening_hours_text: String(body.opening_hours_text || "").trim(),
    share_url: String(body.share_url || "").trim(),
    status: String(body.status || "").trim(),
    suburb: String(body.suburb || "").trim(),
    tag_ids: normalizeArray(body.tag_ids),
    website_url: String(body.website_url || "").trim()
  };
}

function validatePlaceForm(formData) {
  const errors = {};

  if (!formData.name) {
    errors.name = "Name is required.";
  }

  if (!STATUS_VALUES.includes(formData.status)) {
    errors.status = "Choose a valid place status.";
  }

  if (formData.latitude || formData.longitude) {
    if (!isValidLatitude(formData.latitude)) {
      errors.latitude = "Latitude must be a number between -90 and 90.";
    }

    if (!isValidLongitude(formData.longitude)) {
      errors.longitude = "Longitude must be a number between -180 and 180.";
    }
  }

  if (formData.website_url && !isValidHttpUrl(formData.website_url)) {
    errors.website_url = "Menu URL must start with http:// or https://";
  }

  const parsedOpeningHours = parseOpeningHoursText(formData.opening_hours_text);

  if (parsedOpeningHours.error) {
    errors.opening_hours_text = parsedOpeningHours.error;
  } else {
    formData.opening_hours = parsedOpeningHours.opening_hours;
    formData.opening_hours_text = formatOpeningHoursText(parsedOpeningHours.opening_hours);
  }

  return errors;
}

function preparePlaceForSave(formData) {
  return {
    ...formData,
    gf_confidence: formData.gf_confidence || "unknown",
    google_maps_url: formData.google_maps_url || "",
    latitude: formData.latitude ? Number(formData.latitude) : "",
    longitude: formData.longitude ? Number(formData.longitude) : "",
    opening_hours: normalizeOpeningHours(formData.opening_hours || [])
  };
}

function parseOpeningHoursText(value) {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^[\uE000-\uF8FF]+$/.test(line));

  if (!lines.length) {
    return { opening_hours: [] };
  }

  const openingHours = [];
  let index = 0;

  while (index < lines.length) {
    const dayLine = lines[index];
    const dayIndex = DAY_LABELS.findIndex((day) => day.toLowerCase() === dayLine.toLowerCase());

    if (dayIndex === -1) {
      return { error: `Could not read day name from "${dayLine}".` };
    }

    const hourLines = [];
    let nextIndex = index + 1;

    while (nextIndex < lines.length) {
      const nextLine = lines[nextIndex];
      const nextDayIndex = DAY_LABELS.findIndex((day) => day.toLowerCase() === nextLine.toLowerCase());

      if (nextDayIndex !== -1) {
        break;
      }

      hourLines.push(nextLine);
      nextIndex += 1;
    }

    if (!hourLines.length) {
      return { error: `Missing hours for ${dayLine}.` };
    }

    const parsedEntries = parseHoursLines(hourLines);

    if (parsedEntries.error) {
      return { error: `${dayLine}: ${parsedEntries.error}` };
    }

    parsedEntries.entries.forEach((entry, serviceIndex) => {
      openingHours.push({
        close_time: entry.close_time,
        day_of_week: dayIndex,
        is_closed: entry.is_closed,
        open_time: entry.open_time,
        sort_order: serviceIndex
      });
    });

    index = nextIndex;
  }

  return {
    opening_hours: normalizeOpeningHours(openingHours)
  };
}

function parseHoursLines(lines) {
  const normalizedLines = lines
    .map((line) => line.replace(/\u202f/g, " ").trim())
    .filter(Boolean);

  if (normalizedLines.length === 1 && /^open 24 hours$/i.test(normalizedLines[0])) {
    return {
      entries: [{
        close_time: "24:00",
        is_closed: false,
        open_time: "00:00"
      }]
    };
  }

  if (normalizedLines.length === 1 && /^closed$/i.test(normalizedLines[0])) {
    return {
      entries: [{
        close_time: "",
        is_closed: true,
        open_time: ""
      }]
    };
  }

  if (normalizedLines.some((line) => /^closed$/i.test(line))) {
    return { error: "Use either Closed, Open 24 hours, or one or more opening ranges." };
  }

  const entries = [];

  for (const line of normalizedLines) {
    const parsedRange = parseHoursRange(line);

    if (parsedRange.error) {
      return parsedRange;
    }

    entries.push(parsedRange);
  }

  return { entries };
}

function parseHoursRange(value) {
  if (/^open 24 hours$/i.test(value)) {
    return {
      close_time: "24:00",
      is_closed: false,
      open_time: "00:00"
    };
  }

  if (/^closed$/i.test(value)) {
    return {
      close_time: "",
      is_closed: true,
      open_time: ""
    };
  }

  const normalized = value
    .replace(/\bto\b/gi, "-")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const parts = normalized.split("-").map((part) => part.trim()).filter(Boolean);

  if (parts.length !== 2) {
    return { error: "Use Closed, Open 24 hours, or a range like 12-2 pm or 5-10 pm." };
  }

  const openTime = parseClockValue(parts[0]);

  if (!openTime) {
    return { error: "Could not read the opening time." };
  }

  const inferredOpenTime = inferOpenMeridiem(openTime, parts[1]);
  const closeTime = parseClockValue(parts[1], inferredOpenTime.minutes);

  if (!closeTime) {
    return { error: "Could not read the closing time." };
  }

  let closeMinutes = closeTime.minutes;

  if (closeMinutes <= inferredOpenTime.minutes) {
    closeMinutes += 24 * 60;
  }

  return {
    close_time: minutesToTimeString(closeMinutes),
    is_closed: false,
    open_time: minutesToTimeString(inferredOpenTime.minutes)
  };
}

function parseClockValue(value, fallbackMinutes = null) {
  const normalized = value.toLowerCase().replace(/\u202f/g, " ").replace(/\./g, "").trim();
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);

  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2] || "0");
  const meridiem = match[3];

  if (minutes > 59 || hours > 24 || hours < 0) {
    return null;
  }

  if (meridiem === "am") {
    hours = hours === 12 ? 0 : hours;
  } else if (meridiem === "pm") {
    hours = hours === 12 ? 12 : hours + 12;
  } else if (fallbackMinutes !== null) {
    const fallbackHours = Math.floor(fallbackMinutes / 60);

    if (fallbackHours >= 12 && hours < 12) {
      hours += 12;
    }
  }

  return {
    hasMeridiem: Boolean(meridiem),
    meridiem: meridiem || "",
    minutes: hours * 60 + minutes,
    rawHours: Number(match[1])
  };
}

function inferOpenMeridiem(openTime, closeValue) {
  if (openTime.hasMeridiem) {
    return openTime;
  }

  const closeProbe = String(closeValue || "").toLowerCase();
  const closeHasAm = /\bam\b/.test(closeProbe);
  const closeHasPm = /\bpm\b/.test(closeProbe);
  let minutes = openTime.minutes;

  if (closeHasPm && minutes < 12 * 60) {
    minutes += 12 * 60;
  }

  if (closeHasAm && openTime.rawHours === 12) {
    minutes = 0;
  }

  return {
    ...openTime,
    minutes
  };
}

function minutesToTimeString(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatOpeningHoursText(openingHours) {
  const groupedByDay = new Map();
  const normalizedHours = normalizeOpeningHours(openingHours);

  normalizedHours.forEach((entry) => {
    if (!groupedByDay.has(entry.day_of_week)) {
      groupedByDay.set(entry.day_of_week, []);
    }

    groupedByDay.get(entry.day_of_week).push(entry);
  });

  return DAY_LABELS.map((dayLabel, dayIndex) => {
    const dayEntries = groupedByDay.get(dayIndex);

    if (!dayEntries || !dayEntries.length) {
      return `${dayLabel}\nClosed`;
    }

    return `${dayLabel}\n${dayEntries.map((entry) => formatHoursRange(entry)).join("\n")}`;
  }).join("\n\n");
}

function parseNewTags(newTagsInput) {
  const parsed = {
    category: [],
    gluten_features: [],
    menu_items: []
  };

  for (const key of TAG_GROUP_KEYS) {
    parsed[key] = String(newTagsInput[key] || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return parsed;
}

function normalizeArray(value) {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];

  return values
    .map((entry) => String(entry).trim())
    .filter(Boolean);
}

function isValidLatitude(value) {
  const numericValue = Number(value);
  return !Number.isNaN(numericValue) && numericValue >= -90 && numericValue <= 90;
}

function isValidLongitude(value) {
  const numericValue = Number(value);
  return !Number.isNaN(numericValue) && numericValue >= -180 && numericValue <= 180;
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

module.exports = {
  buildPlaceFormData,
  parseOpeningHoursText,
  parsePlaceForm,
  preparePlaceForSave,
  validatePlaceForm
};
