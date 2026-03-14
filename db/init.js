const fs = require("fs");
const path = require("path");
const { exec, getDb } = require("./connection");

async function initializeDatabase() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  await exec(schemaSql);
  await ensureTagGroupColumn();
  await ensureOpeningHoursSchema();
}

function ensureTagGroupColumn() {
  return new Promise((resolve, reject) => {
    getDb().all(`PRAGMA table_info(tags)`, async (error, columns) => {
      if (error) {
        reject(error);
        return;
      }

      const hasTagGroup = columns.some((column) => column.name === "tag_group");

      try {
        if (!hasTagGroup) {
          await exec(
            `ALTER TABLE tags
             ADD COLUMN tag_group TEXT NOT NULL DEFAULT 'category'`
          );
        }

        await exec(`
          UPDATE tags
          SET tag_group = CASE
            WHEN slug IN ('sandwich', 'noodles', 'laksa', 'fried-chicken', 'san-choi-bao') THEN 'menu_items'
            WHEN slug IN ('gf-bread-available', 'dedicated-fryer', 'gluten-free-menu', 'gluten-free-soy-sauce', 'coeliac-aware', 'uncertain-gf') THEN 'gluten_features'
            ELSE 'category'
          END
        `);

        resolve();
      } catch (migrationError) {
        reject(migrationError);
      }
    });
  });
}

function ensureOpeningHoursSchema() {
  return new Promise((resolve, reject) => {
    getDb().all(`PRAGMA table_info(opening_hours)`, async (error, columns) => {
      if (error) {
        reject(error);
        return;
      }

      const hasSortOrder = columns.some((column) => column.name === "sort_order");

      try {
        if (hasSortOrder) {
          resolve();
          return;
        }

        await exec(`
          ALTER TABLE opening_hours RENAME TO opening_hours_legacy;

          CREATE TABLE opening_hours (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            place_id INTEGER NOT NULL,
            day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
            open_time TEXT DEFAULT '',
            close_time TEXT DEFAULT '',
            is_closed INTEGER NOT NULL DEFAULT 0,
            sort_order INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (place_id) REFERENCES places (id) ON DELETE CASCADE,
            UNIQUE (place_id, day_of_week, sort_order)
          );

          INSERT INTO opening_hours (id, place_id, day_of_week, open_time, close_time, is_closed, sort_order)
          SELECT id, place_id, day_of_week, open_time, close_time, is_closed, 0
          FROM opening_hours_legacy;

          DROP TABLE opening_hours_legacy;

          CREATE INDEX IF NOT EXISTS idx_opening_hours_place_day ON opening_hours (place_id, day_of_week);
        `);

        resolve();
      } catch (migrationError) {
        reject(migrationError);
      }
    });
  });
}

module.exports = {
  initializeDatabase
};
