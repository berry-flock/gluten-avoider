function requireAdmin(req, res, next) {
  if (req.session.adminUser) {
    next();
    return;
  }

  req.session.flashError = "Please log in to continue.";
  res.redirect("/admin/login");
}

module.exports = {
  requireAdmin
};
