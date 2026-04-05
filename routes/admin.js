const bcrypt = require("bcrypt");
const express = require("express");
const rateLimit = require("express-rate-limit");
const { exportPlacesCsv, importPlacesCsv } = require("../db/admin-backup");
const {
  createAdminPlace,
  deleteAdminPlace,
  getAdminPlaceById,
  listAdminPlaces,
  updateAdminPlace
} = require("../db/admin-places");
const {
  createAdminTag,
  deleteAdminTag,
  getAdminTagById,
  listAdminTags,
  updateAdminTag
} = require("../db/admin-tags");
const {
  findAdminUserByUsername,
  getAdminDashboardStats,
  listPlacesMissingOpeningHours
} = require("../db/admin-users");
const { STATUS_VALUES } = require("../db/places");
const { listAllTags } = require("../db/tags");
const { requireAdmin } = require("../middleware/require-admin");
const { TAG_GROUP_DEFINITIONS, getGroupedTags } = require("../utils/tag-groups");
const {
  buildPlaceFormData,
  parsePlaceForm,
  preparePlaceForSave,
  validatePlaceForm
} = require("../utils/place-form");
const { enrichPlaceFormFromShareLink } = require("../utils/place-import");
const { buildTagFormData, parseTagForm, validateTagForm } = require("../utils/tag-form");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render("admin/login", {
      errorMessage: "Too many login attempts. Please try again in 15 minutes.",
      formData: { username: String(req.body.username || "") },
      pageTitle: "Admin login"
    });
  }
});

router.get("/admin/login", (req, res) => {
  if (req.session.adminUser) {
    res.redirect("/admin");
    return;
  }

  res.render("admin/login", {
    formData: {
      username: ""
    },
    pageTitle: "Admin login"
  });
});

router.post("/admin/login", loginLimiter, async (req, res, next) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (!username || !password) {
    res.status(400).render("admin/login", {
      errorMessage: "Username and password are required.",
      formData: { username },
      pageTitle: "Admin login"
    });
    return;
  }

  try {
    const adminUser = await findAdminUserByUsername(username);

    if (!adminUser) {
      res.status(401).render("admin/login", {
        errorMessage: "Invalid username or password.",
        formData: { username },
        pageTitle: "Admin login"
      });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, adminUser.password_hash);

    if (!passwordMatches) {
      res.status(401).render("admin/login", {
        errorMessage: "Invalid username or password.",
        formData: { username },
        pageTitle: "Admin login"
      });
      return;
    }

    req.session.adminUser = {
      id: adminUser.id,
      username: adminUser.username
    };

    res.redirect("/admin");
  } catch (error) {
    next(error);
  }
});

router.post("/admin/logout", requireAdmin, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }

    res.clearCookie("connect.sid");
    res.redirect("/admin/login");
  });
});

router.get("/admin", requireAdmin, async (req, res, next) => {
  try {
    const [stats, placesMissingOpeningHours] = await Promise.all([
      getAdminDashboardStats(),
      listPlacesMissingOpeningHours()
    ]);

    res.render("admin/dashboard", {
      backupError: res.locals.flashError,
      backupNotice: res.locals.flashNotice,
      pageTitle: "Admin dashboard",
      placesMissingOpeningHours,
      stats
    });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/backup.csv", requireAdmin, async (req, res, next) => {
  try {
    const csv = await exportPlacesCsv();
    const dateStamp = new Date().toISOString().slice(0, 10);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="gluten-avoider-backup-${dateStamp}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

router.post("/admin/backup/import", requireAdmin, async (req, res, next) => {
  try {
    const csvText = String(req.body.csv_backup || "").trim();

    if (!csvText) {
      req.session.flashError = "Choose a backup CSV file before restoring.";
      res.redirect("/admin");
      return;
    }

    const importedCount = await importPlacesCsv(csvText);
    req.session.flashNotice = `Restored ${importedCount} place${importedCount === 1 ? "" : "s"} from backup.`;
    res.redirect("/admin");
  } catch (error) {
    req.session.flashError = error.message || "Could not restore that backup file.";
    res.redirect("/admin");
  }
});

router.get("/admin/places", requireAdmin, async (req, res, next) => {
  try {
    const places = await listAdminPlaces();

    res.render("admin/places/index", {
      notice: getNoticeMessage(req.query.notice),
      pageTitle: "Manage places",
      places
    });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/places/new", requireAdmin, async (req, res, next) => {
  try {
    const allTags = await listAllTags();

    res.render("admin/places/form", buildPlaceFormViewModel({
      allTags,
      formAction: "/admin/places",
      formData: buildPlaceFormData(),
      pageTitle: "Add place",
      submitLabel: "Create place"
    }));
  } catch (error) {
    next(error);
  }
});

router.post("/admin/places", requireAdmin, async (req, res, next) => {
  const importResult = await enrichPlaceFormFromShareLink(parsePlaceForm(req.body));
  const formData = importResult.formData;
  const errors = validatePlaceForm(formData);

  if (importResult.errorMessage) {
    errors.share_url = importResult.errorMessage;
  }

  if (Object.keys(errors).length > 0) {
    try {
      const allTags = await listAllTags();
      res.status(400).render("admin/places/form", buildPlaceFormViewModel({
        allTags,
        errors,
        formAction: "/admin/places",
        formData,
        pageTitle: "Add place",
        submitLabel: "Create place"
      }));
    } catch (error) {
      next(error);
    }
    return;
  }

  try {
    await createAdminPlace(preparePlaceForSave(formData));
    res.redirect("/admin/places?notice=created");
  } catch (error) {
    if (error.code === "TAG_GROUP_CONFLICT") {
      try {
        const allTags = await listAllTags();
        res.status(400).render("admin/places/form", buildPlaceFormViewModel({
          allTags,
          errors,
          formAction: "/admin/places",
          formData,
          formError: error.message,
          pageTitle: "Add place",
          submitLabel: "Create place"
        }));
      } catch (renderError) {
        next(renderError);
      }
      return;
    }

    next(error);
  }
});

router.get("/admin/places/:id/edit", requireAdmin, async (req, res, next) => {
  try {
    const [place, allTags] = await Promise.all([
      getAdminPlaceById(req.params.id),
      listAllTags()
    ]);

    if (!place) {
      res.status(404).render("errors/404", {
        pageTitle: "Place not found"
      });
      return;
    }

    res.render("admin/places/form", buildPlaceFormViewModel({
      allTags,
      formAction: `/admin/places/${place.id}`,
      formData: buildPlaceFormData(place),
      pageTitle: `Edit ${place.name}`,
      submitLabel: "Save changes"
    }));
  } catch (error) {
    next(error);
  }
});

router.post("/admin/places/:id", requireAdmin, async (req, res, next) => {
  const importResult = await enrichPlaceFormFromShareLink(parsePlaceForm(req.body));
  const formData = importResult.formData;
  const errors = validatePlaceForm(formData);

  if (importResult.errorMessage) {
    errors.share_url = importResult.errorMessage;
  }

  if (Object.keys(errors).length > 0) {
    try {
      const allTags = await listAllTags();
      res.status(400).render("admin/places/form", buildPlaceFormViewModel({
        allTags,
        errors,
        formAction: `/admin/places/${req.params.id}`,
        formData,
        pageTitle: "Edit place",
        submitLabel: "Save changes"
      }));
    } catch (error) {
      next(error);
    }
    return;
  }

  try {
    const existingPlace = await getAdminPlaceById(req.params.id);

    if (!existingPlace) {
      res.status(404).render("errors/404", {
        pageTitle: "Place not found"
      });
      return;
    }

    await updateAdminPlace(existingPlace.id, preparePlaceForSave(formData));
    res.redirect("/admin/places?notice=updated");
  } catch (error) {
    if (error.code === "TAG_GROUP_CONFLICT") {
      try {
        const allTags = await listAllTags();
        res.status(400).render("admin/places/form", buildPlaceFormViewModel({
          allTags,
          errors,
          formAction: `/admin/places/${req.params.id}`,
          formData,
          formError: error.message,
          pageTitle: "Edit place",
          submitLabel: "Save changes"
        }));
      } catch (renderError) {
        next(renderError);
      }
      return;
    }

    next(error);
  }
});

router.get("/admin/places/:id/delete", requireAdmin, async (req, res, next) => {
  try {
    const place = await getAdminPlaceById(req.params.id);

    if (!place) {
      res.status(404).render("errors/404", {
        pageTitle: "Place not found"
      });
      return;
    }

    res.render("admin/places/delete", {
      pageTitle: `Delete ${place.name}`,
      place
    });
  } catch (error) {
    next(error);
  }
});

router.post("/admin/places/:id/delete", requireAdmin, async (req, res, next) => {
  try {
    const place = await getAdminPlaceById(req.params.id);

    if (!place) {
      res.status(404).render("errors/404", {
        pageTitle: "Place not found"
      });
      return;
    }

    await deleteAdminPlace(place.id);
    res.redirect("/admin/places?notice=deleted");
  } catch (error) {
    next(error);
  }
});

router.get("/admin/tags", requireAdmin, async (req, res, next) => {
  try {
    const tags = await listAdminTags();

    res.render("admin/tags/index", {
      groupedTags: getGroupedTags(tags),
      notice: getNoticeMessage(req.query.notice),
      pageTitle: "Manage tags",
      tagError: getTagErrorMessage(req.query.error)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/tags/new", requireAdmin, (req, res) => {
  res.render("admin/tags/form", {
    errors: {},
    formAction: "/admin/tags",
    formData: buildTagFormData(),
    pageTitle: "Add tag",
    submitLabel: "Create tag",
    tagGroups: TAG_GROUP_DEFINITIONS
  });
});

router.post("/admin/tags", requireAdmin, async (req, res, next) => {
  const formData = parseTagForm(req.body);
  const errors = validateTagForm(formData);

  if (Object.keys(errors).length > 0) {
    res.status(400).render("admin/tags/form", {
      errors,
      formAction: "/admin/tags",
      formData,
      pageTitle: "Add tag",
      submitLabel: "Create tag",
      tagGroups: TAG_GROUP_DEFINITIONS
    });
    return;
  }

  try {
    await createAdminTag(formData);
    res.redirect("/admin/tags?notice=tag-created");
  } catch (error) {
    if (error.code === "TAG_NAME_EXISTS") {
      res.status(400).render("admin/tags/form", {
        errors: { name: error.message },
        formAction: "/admin/tags",
        formData,
        pageTitle: "Add tag",
        submitLabel: "Create tag",
        tagGroups: TAG_GROUP_DEFINITIONS
      });
      return;
    }

    next(error);
  }
});

router.get("/admin/tags/:id/edit", requireAdmin, async (req, res, next) => {
  try {
    const tag = await getAdminTagById(req.params.id);

    if (!tag) {
      res.status(404).render("errors/404", {
        pageTitle: "Tag not found"
      });
      return;
    }

    res.render("admin/tags/form", {
      errors: {},
      formAction: `/admin/tags/${tag.id}`,
      formData: buildTagFormData(tag),
      pageTitle: `Edit ${tag.name}`,
      submitLabel: "Save tag",
      tagGroups: TAG_GROUP_DEFINITIONS
    });
  } catch (error) {
    next(error);
  }
});

router.post("/admin/tags/:id", requireAdmin, async (req, res, next) => {
  const formData = parseTagForm(req.body);
  const errors = validateTagForm(formData);

  if (Object.keys(errors).length > 0) {
    res.status(400).render("admin/tags/form", {
      errors,
      formAction: `/admin/tags/${req.params.id}`,
      formData,
      pageTitle: "Edit tag",
      submitLabel: "Save tag",
      tagGroups: TAG_GROUP_DEFINITIONS
    });
    return;
  }

  try {
    const existingTag = await getAdminTagById(req.params.id);

    if (!existingTag) {
      res.status(404).render("errors/404", {
        pageTitle: "Tag not found"
      });
      return;
    }

    await updateAdminTag(existingTag.id, formData);
    res.redirect("/admin/tags?notice=tag-updated");
  } catch (error) {
    if (error.code === "TAG_NAME_EXISTS") {
      res.status(400).render("admin/tags/form", {
        errors: { name: error.message },
        formAction: `/admin/tags/${req.params.id}`,
        formData,
        pageTitle: "Edit tag",
        submitLabel: "Save tag",
        tagGroups: TAG_GROUP_DEFINITIONS
      });
      return;
    }

    next(error);
  }
});

router.post("/admin/tags/:id/delete", requireAdmin, async (req, res, next) => {
  try {
    const existingTag = await getAdminTagById(req.params.id);

    if (!existingTag) {
      res.status(404).render("errors/404", {
        pageTitle: "Tag not found"
      });
      return;
    }

    await deleteAdminTag(existingTag.id);
    res.redirect("/admin/tags?notice=tag-deleted");
  } catch (error) {
    if (error.code === "TAG_IN_USE") {
      res.redirect("/admin/tags?error=tag-in-use");
      return;
    }

    next(error);
  }
});

function getNoticeMessage(value) {
  return {
    created: "Place created.",
    updated: "Place updated.",
    deleted: "Place deleted.",
    "tag-created": "Tag created.",
    "tag-updated": "Tag updated.",
    "tag-deleted": "Tag deleted."
  }[value] || "";
}

function getTagErrorMessage(value) {
  return {
    "tag-in-use": "This tag is still assigned to one or more places, so it cannot be deleted yet."
  }[value] || "";
}

function buildPlaceFormViewModel({
  allTags,
  errors = {},
  formAction,
  formData,
  formError = "",
  pageTitle,
  submitLabel
}) {
  return {
    STATUS_VALUES,
    allTags,
    errors,
    formAction,
    formData,
    formError,
    groupedTags: getGroupedTags(allTags),
    pageTitle,
    submitLabel
  };
}

module.exports = router;
