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

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        // Leaflet — matches the integrity hash in map/nearby templates
        "'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='"
      ],
      styleSrc: [
        "'self'",
        "https://fonts.googleapis.com",
        // Leaflet CSS — matches integrity hash in map/nearby templates
        "'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='",
        "'unsafe-inline'" // Leaflet injects inline styles for marker positioning
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: [
        "'self'",
        "https://*.basemaps.cartocdn.com",
        "data:" // Leaflet uses data URIs for default marker icons
      ],
      connectSrc: ["'self'", "https://*.basemaps.cartocdn.com"]
    }
  },
  permissionsPolicy: {
    features: {
      geolocation: ["self"],
      camera: [],
      microphone: [],
      displayCapture: []
    }
  }
}));
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
