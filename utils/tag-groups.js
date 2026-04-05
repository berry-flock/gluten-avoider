const TAG_GROUP_DEFINITIONS = [
  {
    key: "category",
    label: "Category",
    question: "What kind of place is this?"
  },
  {
    key: "menu_items",
    label: "Menu items",
    question: "What stands out on the menu?"
  },
  {
    key: "gluten_features",
    label: "Gluten features",
    question: "How do they cater for GF?"
  }
];

const TAG_PRIORITY = new Map();
const TAG_GROUP_KEYS = new Set(TAG_GROUP_DEFINITIONS.map((group) => group.key));
const TAG_CATEGORY_BY_GROUP = {
  category: "meal",
  menu_items: "meal",
  gluten_features: "dietary"
};

TAG_GROUP_DEFINITIONS.forEach((group, groupIndex) => {
  TAG_PRIORITY.set(group.key, groupIndex);
});

function getGroupedTags(tags) {
  return TAG_GROUP_DEFINITIONS.map((group) => ({
    key: group.key,
    label: group.label,
    question: group.question,
    tags: tags
      .filter((tag) => (tag.tag_group || "category") === group.key)
      .sort((left, right) => left.name.localeCompare(right.name))
  })).filter((group) => group.tags.length > 0);
}

function sortTagsForDisplay(tags) {
  return [...tags].sort((left, right) => {
    const leftPriority = TAG_PRIORITY.has(left.tag_group || "category")
      ? TAG_PRIORITY.get(left.tag_group || "category")
      : 9999;
    const rightPriority = TAG_PRIORITY.has(right.tag_group || "category")
      ? TAG_PRIORITY.get(right.tag_group || "category")
      : 9999;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.name.localeCompare(right.name);
  });
}

function isValidTagGroup(tagGroup) {
  return TAG_GROUP_KEYS.has(tagGroup);
}

function categoryForTagGroup(tagGroup) {
  return TAG_CATEGORY_BY_GROUP[tagGroup] || TAG_CATEGORY_BY_GROUP.category;
}

module.exports = {
  TAG_GROUP_DEFINITIONS,
  categoryForTagGroup,
  getGroupedTags,
  isValidTagGroup,
  sortTagsForDisplay
};
