const { all, get, run, withTransaction } = require("./connection");
const { slugify } = require("../utils/slugify");
const { categoryForTagGroup, isValidTagGroup } = require("../utils/tag-groups");

async function listAdminTags() {
  return all(
    `SELECT
       t.id,
       t.name,
       t.slug,
       t.category,
       COALESCE(t.tag_group, 'category') AS tag_group,
       COUNT(pt.place_id) AS usage_count
     FROM tags t
     LEFT JOIN place_tags pt ON pt.tag_id = t.id
     GROUP BY t.id
     ORDER BY
       CASE COALESCE(t.tag_group, 'category')
         WHEN 'category' THEN 1
         WHEN 'menu_items' THEN 2
         ELSE 3
       END,
       t.name ASC`
  );
}

async function getAdminTagById(id) {
  return get(
    `SELECT
       id,
       name,
       slug,
       category,
       COALESCE(tag_group, 'category') AS tag_group
     FROM tags
     WHERE id = ?`,
    [id]
  );
}

async function createAdminTag(tagInput) {
  return withTransaction(async () => {
    if (!isValidTagGroup(tagInput.tag_group)) {
      const error = new Error("Choose a valid tag group.");
      error.code = "INVALID_TAG_GROUP";
      throw error;
    }

    const existingByName = await get(
      `SELECT id
       FROM tags
       WHERE lower(name) = lower(?)`,
      [tagInput.name]
    );

    if (existingByName) {
      const error = new Error("A tag with that name already exists.");
      error.code = "TAG_NAME_EXISTS";
      throw error;
    }

    const slug = await createUniqueTagSlug(tagInput.name);

    const result = await run(
      `INSERT INTO tags (name, slug, category, tag_group)
       VALUES (?, ?, ?, ?)`,
      [tagInput.name, slug, categoryForTagGroup(tagInput.tag_group), tagInput.tag_group]
    );

    return result.lastID;
  });
}

async function updateAdminTag(id, tagInput) {
  return withTransaction(async () => {
    if (!isValidTagGroup(tagInput.tag_group)) {
      const error = new Error("Choose a valid tag group.");
      error.code = "INVALID_TAG_GROUP";
      throw error;
    }

    const existingByName = await get(
      `SELECT id
       FROM tags
       WHERE lower(name) = lower(?)`,
      [tagInput.name]
    );

    if (existingByName && existingByName.id !== Number(id)) {
      const error = new Error("A tag with that name already exists.");
      error.code = "TAG_NAME_EXISTS";
      throw error;
    }

    const slug = await createUniqueTagSlug(tagInput.name, id);

    await run(
      `UPDATE tags
       SET
         name = ?,
         slug = ?,
         category = ?,
         tag_group = ?
       WHERE id = ?`,
      [tagInput.name, slug, categoryForTagGroup(tagInput.tag_group), tagInput.tag_group, id]
    );
  });
}

async function deleteAdminTag(id) {
  const usage = await get(
    `SELECT COUNT(*) AS usage_count
     FROM place_tags
     WHERE tag_id = ?`,
    [id]
  );

  if (usage && usage.usage_count > 0) {
    const error = new Error("This tag is still assigned to one or more places.");
    error.code = "TAG_IN_USE";
    throw error;
  }

  await run(`DELETE FROM tags WHERE id = ?`, [id]);
}

async function createUniqueTagSlug(name, excludeId = null) {
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

    if (!existingTag || existingTag.id === Number(excludeId)) {
      return candidate;
    }

    attempt += 1;
  }
}

module.exports = {
  createAdminTag,
  deleteAdminTag,
  getAdminTagById,
  listAdminTags,
  updateAdminTag
};
