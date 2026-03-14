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
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const normalizedHours = normalizeOpeningHours(openingHours);
  const todayEntries = getHoursForDay(normalizedHours, currentDay).filter((entry) => !entry.is_closed);

  for (const entry of todayEntries) {
    const openMinutes = timeToMinutes(entry.open_time);
    const closeMinutes = timeToMinutes(entry.close_time);

    if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
      return {
        isOpen: true,
        label: closeMinutes >= 24 * 60
          ? `Open now until ${DAY_LABELS[(currentDay + 1) % 7]} ${formatTime(entry.close_time)}`
          : `Open now until ${formatTime(entry.close_time)}`
      };
    }
  }

  const previousDayEntries = getHoursForDay(normalizedHours, (currentDay + 6) % 7).filter((entry) => !entry.is_closed);

  for (const entry of previousDayEntries) {
    const closeMinutes = timeToMinutes(entry.close_time);

    if (closeMinutes > 24 * 60 && currentMinutes < (closeMinutes - 24 * 60)) {
      return {
        isOpen: true,
        label: `Open now until ${formatTime(entry.close_time)}`
      };
    }
  }

  const upcomingEntries = buildUpcomingEntries(normalizedHours, currentDay, currentMinutes);

  if (upcomingEntries.length) {
    const nextEntry = upcomingEntries[0];
    const dayLabel = nextEntry.offsetDays === 0
      ? "today"
      : nextEntry.offsetDays === 1
        ? "tomorrow"
        : DAY_LABELS[nextEntry.day_of_week];

    return {
      isOpen: false,
      label: `Closed now. Opens ${dayLabel} at ${formatTime(nextEntry.open_time)}`
    };
  }

  return {
    isOpen: false,
    label: "Closed for now"
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

module.exports = {
  DAY_LABELS,
  attachOpenSummary,
  formatHoursForDay,
  formatHoursRange,
  normalizeOpeningHours,
  timeToMinutes
};
