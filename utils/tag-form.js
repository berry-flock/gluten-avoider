const { TAG_GROUP_DEFINITIONS, isValidTagGroup } = require("./tag-groups");

function buildTagFormData(tag = {}) {
  return {
    name: tag.name || "",
    tag_group: tag.tag_group || "category"
  };
}

function parseTagForm(body) {
  return {
    name: String(body.name || "").trim(),
    tag_group: String(body.tag_group || "").trim()
  };
}

function validateTagForm(formData) {
  const errors = {};

  if (!formData.name) {
    errors.name = "Tag name is required.";
  }

  if (!isValidTagGroup(formData.tag_group)) {
    errors.tag_group = "Choose a valid tag group.";
  }

  return errors;
}

module.exports = {
  buildTagFormData,
  parseTagForm,
  validateTagForm
};
