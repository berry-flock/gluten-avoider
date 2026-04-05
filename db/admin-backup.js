const { all, run, withTransaction } = require("./connection");
const { slugify } = require("../utils/slugify");
const { parseOpeningHoursText } = require("../utils/place-form");
const { categoryForTagGroup, isValidTagGroup } = require("../utils/tag-groups");

const EXPORT_COLUMNS = [
  "name",
  "suburb",
  "address",
  "latitude",
  "longitude",
  "menu_url",
  "status",
  "is_public",
  "notes_public",
  "notes_private",
  "category_tags",
  "menu_item_tags",
  "gluten_feature_tags",
  "opening_hours"
];

async function exportPlacesCsv() {
  const places = await all(
    `SELECT
       p.id,
       p.name,
       p.suburb,
       p.address,
       p.latitude,
       p.longitude,
       p.website_url,
       p.status,
       p.is_public,
       p.notes_public,
       p.notes_private
     FROM places p
     ORDER BY p.name COLLATE NOCASE ASC`
  );

  const tagRows = await all(
    `SELECT
       pt.place_id,
       t.name,
       COALESCE(t.tag_group, 'category') AS tag_group
     FROM place_tags pt
     JOIN tags t ON t.id = pt.tag_id
     ORDER BY t.name COLLATE NOCASE ASC`
  );

  const openingHourRows = await all(
    `SELECT
       place_id,
       day_of_week,
       open_time,
       close_time,
       is_closed,
       sort_order
     FROM opening_hours
     ORDER BY day_of_week ASC, sort_order ASC, open_time ASC`
  );

  const tagsByPlaceId = new Map();
  const hoursByPlaceId = new Map();

  tagRows.forEach((row) => {
    if (!tagsByPlaceId.has(row.place_id)) {
      tagsByPlaceId.set(row.place_id, {
        category: [],
        gluten_features: [],
        menu_items: []
      });
    }

    tagsByPlaceId.get(row.place_id)[row.tag_group || "category"].push(row.name);
  });

  openingHourRows.forEach((row) => {
    if (!hoursByPlaceId.has(row.place_id)) {
      hoursByPlaceId.set(row.place_id, []);
    }

    hoursByPlaceId.get(row.place_id).push({
      close_time: row.close_time,
      day_of_week: row.day_of_week,
      is_closed: Boolean(row.is_closed),
      open_time: row.open_time,
      sort_order: row.sort_order
    });
  });

  const rows = [
    EXPORT_COLUMNS,
    ...places.map((place) => {
      const tags = tagsByPlaceId.get(place.id) || {
        category: [],
        gluten_features: [],
        menu_items: []
      };

      return [
        place.name,
        place.suburb,
        place.address,
        place.latitude,
        place.longitude,
        place.website_url,
        place.status,
        place.is_public ? "1" : "0",
        place.notes_public,
        place.notes_private,
        tags.category.join(" | "),
        tags.menu_items.join(" | "),
        tags.gluten_features.join(" | "),
        formatOpeningHoursCsv(hoursByPlaceId.get(place.id) || [])
      ];
    })
  ];

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

async function importPlacesCsv(csvText) {
  const rows = parseCsv(csvText);

  if (rows.length < 2) {
    throw new Error("The CSV file is empty.");
  }

  const headers = rows[0];
  const expectedHeader = EXPORT_COLUMNS.join(",");

  if (headers.join(",") !== expectedHeader) {
    throw new Error("The CSV columns do not match the expected backup format.");
  }

  const places = rows.slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) => rowToObject(headers, row));

  return withTransaction(async () => {
    await run(`DELETE FROM place_tags`);
    await run(`DELETE FROM opening_hours`);
    await run(`DELETE FROM places`);
    await run(`DELETE FROM tags`);

    const tagIdByKey = new Map();

    for (const place of places) {
      const slug = await createUniqueSlug(place.name);
      const insertResult = await run(
        `INSERT INTO places (
          name,
          slug,
          suburb,
          address,
          latitude,
          longitude,
          website_url,
          google_maps_url,
          status,
          gf_confidence,
          notes_public,
          notes_private,
          featured,
          is_public,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, 'unknown', ?, ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          place.name,
          slug,
          place.suburb,
          place.address,
          Number(place.latitude || 0),
          Number(place.longitude || 0),
          place.menu_url,
          place.status || "trusted",
          place.notes_public || "",
          place.notes_private || "",
          place.is_public === "0" ? 0 : 1
        ]
      );

      const placeId = insertResult.lastID;
      const groupedTags = {
        category: splitPipeList(place.category_tags),
        menu_items: splitPipeList(place.menu_item_tags),
        gluten_features: splitPipeList(place.gluten_feature_tags)
      };

      for (const [groupKey, names] of Object.entries(groupedTags)) {
        for (const name of names) {
          const tagId = await ensureTag(tagIdByKey, name, groupKey);
          await run(`INSERT INTO place_tags (place_id, tag_id) VALUES (?, ?)`, [placeId, tagId]);
        }
      }

      const openingHours = parseOpeningHoursText(place.opening_hours || "");

      if (openingHours.error) {
        throw new Error(`Could not import opening hours for "${place.name}": ${openingHours.error}`);
      }

      for (const hours of openingHours.opening_hours) {
        await run(
          `INSERT INTO opening_hours (place_id, day_of_week, open_time, close_time, is_closed, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            placeId,
            hours.day_of_week,
            hours.open_time,
            hours.close_time,
            hours.is_closed ? 1 : 0,
            hours.sort_order || 0
          ]
        );
      }
    }

    return places.length;
  });
}

function formatOpeningHoursCsv(openingHours) {
  if (!openingHours.length) {
    return "";
  }

  const grouped = new Map();

  openingHours.forEach((entry) => {
    if (!grouped.has(entry.day_of_week)) {
      grouped.set(entry.day_of_week, []);
    }

    grouped.get(entry.day_of_week).push(entry);
  });

  return [0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
    const dayEntries = grouped.get(dayIndex);

    if (!dayEntries || !dayEntries.length) {
      return `${dayLabel(dayIndex)}\nClosed`;
    }

    return `${dayLabel(dayIndex)}\n${dayEntries.map(formatEntryLine).join("\n")}`;
  }).join("\n\n");
}

function formatEntryLine(entry) {
  if (entry.is_closed) {
    return "Closed";
  }

  if (entry.open_time === "00:00" && entry.close_time === "24:00") {
    return "Open 24 hours";
  }

  return `${formatClock(entry.open_time)}-${formatClock(entry.close_time)}`;
}

function formatClock(value) {
  const [rawHours, rawMinutes] = String(value || "00:00").split(":").map(Number);
  let hours = rawHours;
  const minutes = rawMinutes || 0;

  if (hours >= 24) {
    hours -= 24;
  }

  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  const minuteText = minutes === 0 ? "" : `:${String(minutes).padStart(2, "0")}`;

  return `${hour12}${minuteText} ${suffix}`;
}

function dayLabel(index) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][index];
}

function splitPipeList(value) {
  return String(value || "")
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function rowToObject(headers, row) {
  const output = {};

  headers.forEach((header, index) => {
    output[header] = row[index] || "";
  });

  return output;
}

function csvEscape(value) {
  const normalized = String(value ?? "").replace(/\r\n/g, "\n");
  return `"${normalized.replace(/"/g, "\"\"")}"`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (inQuotes) {
      if (char === "\"" && nextChar === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    field += char;
  }

  row.push(field);
  rows.push(row);
  return rows;
}

async function ensureTag(tagIdByKey, name, groupKey) {
  if (!isValidTagGroup(groupKey)) {
    throw new Error(`Invalid tag group "${groupKey}" in backup import.`);
  }

  const key = `${groupKey}:${name.toLowerCase()}`;

  if (tagIdByKey.has(key)) {
    return tagIdByKey.get(key);
  }

  const insertResult = await run(
    `INSERT INTO tags (name, slug, category, tag_group)
     VALUES (?, ?, ?, ?)`,
    [name, await createUniqueTagSlug(name), categoryForTagGroup(groupKey), groupKey]
  );

  tagIdByKey.set(key, insertResult.lastID);
  return insertResult.lastID;
}

async function createUniqueSlug(name, excludeId = null) {
  const baseSlug = slugify(name) || "place";
  let attempt = 0;

  while (true) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const existing = await all(`SELECT id FROM places WHERE slug = ?`, [candidate]);

    if (!existing.length || existing[0].id === Number(excludeId)) {
      return candidate;
    }

    attempt += 1;
  }
}

async function createUniqueTagSlug(name) {
  const baseSlug = slugify(name) || "tag";
  let attempt = 0;

  while (true) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const existing = await all(`SELECT id FROM tags WHERE slug = ?`, [candidate]);

    if (!existing.length) {
      return candidate;
    }

    attempt += 1;
  }
}

module.exports = {
  exportPlacesCsv,
  importPlacesCsv
};
