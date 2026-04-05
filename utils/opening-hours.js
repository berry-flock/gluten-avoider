const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

function attachOpenSummary(place, now = new Date()) {
  place.openSummary = getOpenSummary(place.openingHours || [], now);
  return place;
}

function getOpenSummary(openingHours, now = new Date()) {
  return getOpenSummaryForSelection(openingHours, now.getDay(), now.getHours() * 60 + now.getMinutes(), {
    prefix: "Open now"
  });
}

function getOpenSummaryForSelection(openingHours, dayOfWeek, minutes, options = {}) {
  const selection = getAvailabilityAt(openingHours, dayOfWeek, minutes);
  const prefix = options.prefix || `Open at ${formatMinutes(minutes)}`;

  if (selection.isOpen && selection.entry) {
    const closeMinutes = timeToMinutes(selection.entry.close_time);
    const primaryLabel = closeMinutes >= 24 * 60 && selection.sourceDay !== dayOfWeek
      ? `Open until ${formatTime(selection.entry.close_time)}`
      : closeMinutes >= 24 * 60
        ? `Open until ${DAY_LABELS[(dayOfWeek + 1) % 7]} ${formatTime(selection.entry.close_time)}`
        : `Open until ${formatTime(selection.entry.close_time)}`;
    const secondaryLabel = selection.nextEntry && selection.nextEntry.offsetDays === 0
      ? `Reopening ${formatTime(selection.nextEntry.open_time)}`
      : "";

    return {
      isOpen: true,
      label: secondaryLabel ? `${primaryLabel}. ${secondaryLabel}` : primaryLabel,
      prefix,
      primaryLabel,
      secondaryLabel
    };
  }

  if (selection.nextEntry) {
    const relativeDayLabel = selection.nextEntry.offsetDays === 0
      ? "today"
      : selection.nextEntry.offsetDays === 1
        ? "tomorrow"
        : DAY_LABELS[selection.nextEntry.day_of_week];

    return {
      isOpen: false,
      label: `Closed. Opens ${relativeDayLabel} at ${formatTime(selection.nextEntry.open_time)}`,
      prefix,
      primaryLabel: "Closed",
      secondaryLabel: `Opens ${relativeDayLabel} at ${formatTime(selection.nextEntry.open_time)}`
    };
  }

  return {
    isOpen: false,
    label: "Closed",
    prefix,
    primaryLabel: "Closed",
    secondaryLabel: ""
  };
}

function getAvailabilityAt(openingHours, dayOfWeek, minutes) {
  const normalizedHours = normalizeOpeningHours(openingHours);
  const todayEntries = getHoursForDay(normalizedHours, dayOfWeek).filter((entry) => !entry.is_closed);

  for (const entry of todayEntries) {
    const openMinutes = timeToMinutes(entry.open_time);
    const closeMinutes = timeToMinutes(entry.close_time);

    if (minutes >= openMinutes && minutes < closeMinutes) {
      return {
        entry,
        isOpen: true,
        nextEntry: null,
        sourceDay: dayOfWeek
      };
    }
  }

  const previousDay = (dayOfWeek + 6) % 7;
  const previousDayEntries = getHoursForDay(normalizedHours, previousDay).filter((entry) => !entry.is_closed);

  for (const entry of previousDayEntries) {
    const closeMinutes = timeToMinutes(entry.close_time);

    if (closeMinutes > 24 * 60 && minutes < (closeMinutes - 24 * 60)) {
      return {
        entry,
        isOpen: true,
        nextEntry: null,
        sourceDay: previousDay
      };
    }
  }

  const upcomingEntries = buildUpcomingEntries(normalizedHours, dayOfWeek, minutes);

  return {
    entry: null,
    isOpen: false,
    nextEntry: upcomingEntries[0] || null,
    sourceDay: dayOfWeek
  };
}

function buildUpcomingEntries(openingHours, currentDay, currentMinutes) {
  const entries = [];

  for (let offsetDays = 0; offsetDays <= 7; offsetDays += 1) {
    const dayOfWeek = (currentDay + offsetDays) % 7;
    const dayEntries = getHoursForDay(openingHours, dayOfWeek).filter((entry) => !entry.is_closed);

    for (const entry of dayEntries) {
      if (offsetDays === 0 && timeToMinutes(entry.open_time) <= currentMinutes) {
        continue;
      }

      entries.push({
        ...entry,
        day_of_week: dayOfWeek,
        offsetDays
      });
    }
  }

  return entries.sort((left, right) => {
    if (left.offsetDays !== right.offsetDays) {
      return left.offsetDays - right.offsetDays;
    }

    return timeToMinutes(left.open_time) - timeToMinutes(right.open_time);
  });
}

function getHoursForDay(openingHours, dayOfWeek) {
  return (openingHours || [])
    .filter((entry) => Number(entry.day_of_week) === Number(dayOfWeek))
    .sort(compareHourEntries);
}

function formatHoursForDay(openingHours, dayOfWeek) {
  const entries = getHoursForDay(openingHours, dayOfWeek);

  if (!entries.length) {
    return "Closed";
  }

  if (entries.every((entry) => entry.is_closed)) {
    return "Closed";
  }

  return entries
    .filter((entry) => !entry.is_closed)
    .map((entry) => formatHoursRange(entry))
    .join(", ");
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  let [hours, minutes] = value.split(":").map(Number);

  if (hours >= 24) {
    hours -= 24;
  }

  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  const minuteText = minutes === 0 ? "" : `:${String(minutes).padStart(2, "0")}`;

  return `${hour12}${minuteText} ${suffix}`;
}

function formatMinutes(minutes) {
  const normalized = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;

  return formatTime(`${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`);
}

function formatHoursRange(entry) {
  if (!entry || entry.is_closed) {
    return "Closed";
  }

  if (timeToMinutes(entry.open_time) === 0 && timeToMinutes(entry.close_time) === 24 * 60) {
    return "Open 24 hours";
  }

  return `${formatTime(entry.open_time)}-${formatTime(entry.close_time)}`;
}

function normalizeOpeningHours(openingHours) {
  return [...(openingHours || [])]
    .map((entry, index) => ({
      close_time: entry.close_time || "",
      day_of_week: Number(entry.day_of_week),
      id: entry.id || null,
      is_closed: Boolean(entry.is_closed),
      open_time: entry.open_time || "",
      sort_order: entry.sort_order !== undefined ? Number(entry.sort_order) : index
    }))
    .sort(compareHourEntries);
}

function compareHourEntries(left, right) {
  if (Number(left.day_of_week) !== Number(right.day_of_week)) {
    return Number(left.day_of_week) - Number(right.day_of_week);
  }

  if (Number(left.sort_order) !== Number(right.sort_order)) {
    return Number(left.sort_order) - Number(right.sort_order);
  }

  return timeToMinutes(left.open_time) - timeToMinutes(right.open_time);
}

function timeToMinutes(value) {
  if (!value) {
    return 0;
  }

  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function parseTimeInput(value, fallback = "12:00") {
  const raw = typeof value === "string" && /^\d{1,2}:\d{2}$/.test(value) ? value : fallback;
  const [hours, minutes] = raw.split(":").map(Number);

  return {
    minutes: (hours * 60) + minutes,
    value: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
  };
}

module.exports = {
  DAY_LABELS,
  attachOpenSummary,
  getAvailabilityAt,
  formatHoursForDay,
  formatHoursRange,
  formatMinutes,
  getOpenSummaryForSelection,
  normalizeOpeningHours,
  parseTimeInput,
  timeToMinutes
};
