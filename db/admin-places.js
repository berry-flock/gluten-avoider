const { all, get, run, withTransaction } = require("./connection");
const { slugify } = require("../utils/slugify");

async function listAdminPlaces() {
  return all(
    `SELECT
       id,
       name,
       slug,
       suburb,
       status,
       gf_confidence,
       featured,
       is_public,
       updated_at
     FROM places
     ORDER BY datetime(updated_at) DESC, name COLLATE NOCASE ASC`
  );
}

async function getAdminPlaceById(id) {
  const place = await get(
    `SELECT *
     FROM places
     WHERE id = ?`,
    [id]
  );

  if (!place) {
    return null;
  }

  const tagRows = await all(
    `SELECT tag_id
     FROM place_tags
     WHERE place_id = ?`,
    [id]
  );

  const openingHours = await all(
    `SELECT day_of_week, open_time, close_time, is_closed
     FROM opening_hours
     WHERE place_id = ?
     ORDER BY day_of_week ASC`,
    [id]
  );

  place.tag_ids = tagRows.map((row) => row.tag_id);
  place.opening_hours = openingHours.map((row) => ({
    day_of_week: row.day_of_week,
    open_time: row.open_time,
    close_time: row.close_time,
    is_closed: Boolean(row.is_closed)
  }));

  return place;
}

async function createAdminPlace(placeInput) {
  return withTransaction(async () => {
    const tagIds = await resolveTagIds(placeInput.tag_ids, placeInput.new_tags);
    const slug = await createUniqueSlug(placeInput.name);
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        placeInput.name,
        slug,
        placeInput.suburb,
        placeInput.address,
        placeInput.latitude,
        placeInput.longitude,
        placeInput.website_url,
        placeInput.google_maps_url,
        placeInput.status,
        placeInput.gf_confidence,
        placeInput.notes_public,
        placeInput.notes_private,
        placeInput.featured ? 1 : 0,
        placeInput.is_public ? 1 : 0
      ]
    );

    await replacePlaceTags(insertResult.lastID, tagIds);
    await replaceOpeningHours(insertResult.lastID, placeInput.opening_hours);

    return insertResult.lastID;
  });
}

async function updateAdminPlace(id, placeInput) {
  return withTransaction(async () => {
    const tagIds = await resolveTagIds(placeInput.tag_ids, placeInput.new_tags);
    const slug = await createUniqueSlug(placeInput.name, id);

    await run(
      `UPDATE places
       SET
         name = ?,
         slug = ?,
         suburb = ?,
         address = ?,
         latitude = ?,
         longitude = ?,
         website_url = ?,
         google_maps_url = ?,
         status = ?,
         gf_confidence = ?,
         notes_public = ?,
         notes_private = ?,
         featured = ?,
         is_public = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        placeInput.name,
        slug,
        placeInput.suburb,
        placeInput.address,
        placeInput.latitude,
        placeInput.longitude,
        placeInput.website_url,
        placeInput.google_maps_url,
        placeInput.status,
        placeInput.gf_confidence,
        placeInput.notes_public,
        placeInput.notes_private,
        placeInput.featured ? 1 : 0,
        placeInput.is_public ? 1 : 0,
        id
      ]
    );

    await replacePlaceTags(id, tagIds);
    await replaceOpeningHours(id, placeInput.opening_hours);
  });
}

async function deleteAdminPlace(id) {
  await run(`DELETE FROM places WHERE id = ?`, [id]);
}

async function createUniqueSlug(name, excludeId = null) {
  const baseSlug = slugify(name) || "place";
  let attempt = 0;

  while (true) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const existingPlace = await get(
      `SELECT id
       FROM places
       WHERE slug = ?`,
      [candidate]
    );

    if (!existingPlace || existingPlace.id === Number(excludeId)) {
      return candidate;
    }

    attempt += 1;
  }
}

async function replacePlaceTags(placeId, tagIds) {
  await run(`DELETE FROM place_tags WHERE place_id = ?`, [placeId]);

  for (const tagId of tagIds) {
    await run(
      `INSERT INTO place_tags (place_id, tag_id) VALUES (?, ?)`,
      [placeId, tagId]
    );
  }
}

async function replaceOpeningHours(placeId, openingHours) {
  await run(`DELETE FROM opening_hours WHERE place_id = ?`, [placeId]);

  for (const hours of openingHours) {
    await run(
      `INSERT INTO opening_hours (place_id, day_of_week, open_time, close_time, is_closed)
       VALUES (?, ?, ?, ?, ?)`,
      [
        placeId,
        hours.day_of_week,
        hours.open_time,
        hours.close_time,
        hours.is_closed ? 1 : 0
      ]
    );
  }
}

async function resolveTagIds(existingTagIds, newTagsByGroup) {
  const resolvedIds = [...existingTagIds];

  for (const [groupKey, names] of Object.entries(newTagsByGroup || {})) {
    for (const rawName of names) {
      const name = rawName.trim();

      if (!name) {
        continue;
      }

      const existingTag = await get(
        `SELECT id
         FROM tags
         WHERE lower(name) = lower(?)`,
        [name]
      );

      if (existingTag) {
        resolvedIds.push(existingTag.id);
        continue;
      }

      const slug = await createUniqueTagSlug(name);
      const insertResult = await run(
        `INSERT INTO tags (name, slug, category, tag_group)
         VALUES (?, ?, ?, ?)`,
        [name, slug, getTagCategoryForGroup(groupKey), groupKey]
      );

      resolvedIds.push(insertResult.lastID);
    }
  }

  return [...new Set(resolvedIds)];
}

async function createUniqueTagSlug(name) {
  const baseSlug = slugify(name) || "tag";
  let attempt = 0;

  while (true) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const existingTag = await get(
      `SELECT id
       FROM tags
       WHERE slug = ?`,
      [candidate]
    );

    if (!existingTag) {
      return candidate;
    }

    attempt += 1;
  }
}

function getTagCategoryForGroup(groupKey) {
  if (groupKey === "gluten_features") {
    return "dietary";
  }

  return "meal";
}

module.exports = {
  createAdminPlace,
  deleteAdminPlace,
  getAdminPlaceById,
  listAdminPlaces,
  updateAdminPlace
};
