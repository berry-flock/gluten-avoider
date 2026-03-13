require("dotenv").config();

const { initializeDatabase } = require("../db/init");
const { dbFile } = require("../db/connection");

initializeDatabase()
  .then(() => {
    console.log(`Database initialized at ${dbFile}`);
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
