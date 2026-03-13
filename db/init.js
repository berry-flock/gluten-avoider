const fs = require("fs");
const path = require("path");
const { exec, getDb } = require("./connection");

async function initializeDatabase() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  await exec(schemaSql);
  await ensureTagGroupColumn();
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

module.exports = {
  initializeDatabase
};
