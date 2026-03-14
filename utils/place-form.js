const { STATUS_VALUES } = require("../db/places");
const { DAY_LABELS, formatHoursRange } = require("./opening-hours");

const TAG_GROUP_KEYS = ["category", "menu_items", "gluten_features"];

function buildPlaceFormData(place = {}) {
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
    opening_hours: normalizeOpeningHours(place.opening_hours || []),
    opening_hours_text: place.opening_hours && place.opening_hours.length
      ? formatOpeningHoursText(place.opening_hours || [])
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
    longitude: formData.longitude ? Number(formData.longitude) : ""
  };
}

function parseOpeningHoursText(value) {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^[\uE000-\uF8FF]+$/.test(line));

  if (!lines.length) {
    return {
      opening_hours: []
    };
  }

  const byDay = new Map();
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

    const parsedRange = parseHoursLines(hourLines);

    if (parsedRange.error) {
      return { error: `${dayLine}: ${parsedRange.error}` };
    }

    byDay.set(dayIndex, {
      day_of_week: dayIndex,
      open_time: parsedRange.open_time,
      close_time: parsedRange.close_time,
      is_closed: parsedRange.is_closed
    });

    index = nextIndex;
  }

  return {
    opening_hours: DAY_LABELS.map((dayLabel, dayIndex) => byDay.get(dayIndex) || {
      day_of_week: dayIndex,
      open_time: "",
      close_time: "",
      is_closed: true
    })
  };
}

function parseHoursLines(lines) {
  const normalizedLines = lines
    .map((line) => line.replace(/\u202f/g, " ").trim())
    .filter(Boolean);

  if (normalizedLines.length === 1) {
    return parseHoursRange(normalizedLines[0]);
  }

  if (normalizedLines.some((line) => /^closed$/i.test(line))) {
    return { error: "Use either Closed or one or more opening ranges." };
  }

  const parsedRanges = normalizedLines.map((line) => parseHoursRange(line));
  const rangeError = parsedRanges.find((parsedRange) => parsedRange.error);

  if (rangeError) {
    return rangeError;
  }

  return {
    close_time: parsedRanges[parsedRanges.length - 1].close_time,
    is_closed: false,
    open_time: parsedRanges[0].open_time
  };
}

function parseHoursRange(value) {
  if (/^closed$/i.test(value)) {
    return {
      close_time: "",
      is_closed: true,
      open_time: ""
    };
  }

  const normalized = value
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const parts = normalized.split("-").map((part) => part.trim()).filter(Boolean);

  if (parts.length !== 2) {
    return { error: "Use either Closed or a range like 4 pm-10 pm." };
  }

  const openTime = parseClockValue(parts[0]);
  const closeTime = parseClockValue(parts[1], openTime.minutes);

  if (!openTime || !closeTime) {
    return { error: "Time range should look like 4 pm-10 pm or 4:30 pm-12 am." };
  }

  let closeMinutes = closeTime.minutes;

  if (closeMinutes <= openTime.minutes && closeMinutes === 0) {
    closeMinutes = 24 * 60;
  }

  if (closeMinutes <= openTime.minutes) {
    return { error: "Close time must be later than open time. Overnight times beyond midnight are not supported yet except 12 am." };
  }

  return {
    close_time: minutesToTimeString(closeMinutes),
    is_closed: false,
    open_time: minutesToTimeString(openTime.minutes)
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
    if (hours < 12 && fallbackHours >= 12) {
      hours += 12;
    }
  }

  return {
    minutes: hours * 60 + minutes
  };
}

function minutesToTimeString(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatOpeningHoursText(openingHours) {
  return normalizeOpeningHours(openingHours)
    .map((hours) => `${DAY_LABELS[hours.day_of_week]}\n${formatHoursRange(hours)}`)
    .join("\n\n");
}

function normalizeOpeningHours(openingHours) {
  const hoursByDay = new Map(openingHours.map((hours) => [hours.day_of_week, hours]));

  return DAY_LABELS.map((dayLabel, dayIndex) => hoursByDay.get(dayIndex) || {
    day_of_week: dayIndex,
    open_time: "",
    close_time: "",
    is_closed: true
  });
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
  parsePlaceForm,
  preparePlaceForSave,
  validatePlaceForm
};
