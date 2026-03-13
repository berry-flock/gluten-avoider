const { TAG_GROUP_DEFINITIONS } = require("./tag-groups");

const TAG_GROUP_KEYS = new Set(TAG_GROUP_DEFINITIONS.map((group) => group.key));

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

  if (!TAG_GROUP_KEYS.has(formData.tag_group)) {
    errors.tag_group = "Choose a valid tag group.";
  }

  return errors;
}

module.exports = {
  buildTagFormData,
  parseTagForm,
  validateTagForm
};
