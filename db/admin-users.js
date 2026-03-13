const { all, get } = require("./connection");

async function findAdminUserByUsername(username) {
  return get(
    `SELECT id, username, password_hash, created_at
     FROM admin_users
     WHERE username = ?`,
    [username]
  );
}

async function getAdminDashboardStats() {
  const stats = await get(
    `SELECT
       (SELECT COUNT(*) FROM places) AS place_count,
       (SELECT COUNT(*) FROM tags) AS tag_count,
       (SELECT COUNT(*) FROM places WHERE is_public = 1) AS public_place_count`
  );

  return stats;
}

async function listPlacesMissingOpeningHours(limit = 8) {
  return all(
    `SELECT
       p.id,
       p.name
     FROM places p
     LEFT JOIN opening_hours oh ON oh.place_id = p.id
     GROUP BY p.id
     HAVING COALESCE(SUM(CASE WHEN oh.is_closed = 0 AND oh.open_time != '' AND oh.close_time != '' THEN 1 ELSE 0 END), 0) = 0
     ORDER BY datetime(p.updated_at) DESC, p.name COLLATE NOCASE ASC
     LIMIT ?`,
    [limit]
  );
}

module.exports = {
  findAdminUserByUsername,
  getAdminDashboardStats,
  listPlacesMissingOpeningHours
};
