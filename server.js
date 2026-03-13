require("dotenv").config();

const app = require("./app");
const { initializeDatabase } = require("./db/init");

const port = Number(process.env.PORT) || 3000;

async function startServer() {
  await initializeDatabase();

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
