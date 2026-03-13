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
  const today = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const hoursByDay = new Map(openingHours.map((entry) => [entry.day_of_week, entry]));
  const todayHours = hoursByDay.get(today);

  if (todayHours && !todayHours.is_closed) {
    const openMinutes = timeToMinutes(todayHours.open_time);
    const closeMinutes = timeToMinutes(todayHours.close_time);

    if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
      return {
        isOpen: true,
        label: `Open now until ${formatTime(todayHours.close_time)}`
      };
    }

    if (currentMinutes < openMinutes) {
      return {
        isOpen: false,
        label: `Opens today at ${formatTime(todayHours.open_time)}`
      };
    }
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const lookupDay = (today + offset) % 7;
    const nextHours = hoursByDay.get(lookupDay);

    if (!nextHours || nextHours.is_closed) {
      continue;
    }

    return {
      isOpen: false,
      label: `Closed now. Opens ${offset === 1 ? "tomorrow" : DAY_LABELS[lookupDay]} at ${formatTime(nextHours.open_time)}`
    };
  }

  return {
    isOpen: false,
    label: "Closed for now"
  };
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  const [hours, minutes] = value.split(":").map(Number);
  if (hours === 24) {
    return `12:${String(minutes).padStart(2, "0")} AM`;
  }
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;

  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatHoursRange(entry) {
  if (!entry || entry.is_closed) {
    return "Closed";
  }

  return `${formatTime(entry.open_time)} to ${formatTime(entry.close_time)}`;
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
  formatHoursRange
};
