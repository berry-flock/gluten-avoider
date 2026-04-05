require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const path = require("path");
const adminRoutes = require("./routes/admin");
const publicRoutes = require("./routes/public");
const { installViewHelpers } = require("./utils/view-helpers");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 8 * 60 * 60 * 1000,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production"
    }
  })
);
app.use(express.static(path.join(__dirname, "public")));

installViewHelpers(app);

app.use((req, res, next) => {
  res.locals.currentAdmin = req.session.adminUser || null;
  res.locals.flashError = req.session.flashError || "";
  res.locals.flashNotice = req.session.flashNotice || "";
  delete req.session.flashError;
  delete req.session.flashNotice;
  next();
});

app.use(adminRoutes);
app.use(publicRoutes);

app.use((req, res) => {
  res.status(404).render("errors/404", {
    pageTitle: "Page not found"
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("errors/500", {
    pageTitle: "Something went wrong"
  });
});

module.exports = app;
