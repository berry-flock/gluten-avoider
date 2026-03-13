const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbFile = path.resolve(
  process.cwd(),
  process.env.DB_FILE || "./data/trusted-places.sqlite"
);

let dbInstance;

function ensureDataDirectory() {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
}

function getDb() {
  if (!dbInstance) {
    ensureDataDirectory();
    dbInstance = new sqlite3.Database(dbFile);
    dbInstance.exec("PRAGMA foreign_keys = ON");
  }

  return dbInstance;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }

      resolve({
        lastID: this.lastID,
        changes: this.changes
      });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    getDb().exec(sql, (err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

async function withTransaction(callback) {
  await exec("BEGIN TRANSACTION");

  try {
    const result = await callback();
    await exec("COMMIT");
    return result;
  } catch (error) {
    await exec("ROLLBACK");
    throw error;
  }
}

module.exports = {
  all,
  dbFile,
  exec,
  get,
  getDb,
  run,
  withTransaction
};
