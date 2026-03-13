const { all } = require("./connection");

async function listPublicTags() {
  return all(
    `SELECT DISTINCT t.id, t.name, t.slug, t.category, COALESCE(t.tag_group, 'category') AS tag_group
     FROM tags t
     JOIN place_tags pt ON pt.tag_id = t.id
     JOIN places p ON p.id = pt.place_id
     WHERE p.is_public = 1 AND p.status != 'avoid'
     ORDER BY
       CASE COALESCE(t.tag_group, 'category')
         WHEN 'category' THEN 1
         WHEN 'menu_items' THEN 2
         ELSE 3
       END,
       t.name ASC`
  );
}

async function listAllTags() {
  return all(
    `SELECT id, name, slug, category, COALESCE(tag_group, 'category') AS tag_group
     FROM tags
     ORDER BY
       CASE COALESCE(tag_group, 'category')
         WHEN 'category' THEN 1
         WHEN 'menu_items' THEN 2
         ELSE 3
       END,
       name ASC`
  );
}

module.exports = {
  listAllTags,
  listPublicTags
};
