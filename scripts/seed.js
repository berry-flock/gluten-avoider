require("dotenv").config();

const bcrypt = require("bcrypt");
const { initializeDatabase } = require("../db/init");
const { all, get, run } = require("../db/connection");
const { slugify } = require("../utils/slugify");

const TAGS = [
  { name: "Breakfast", slug: "breakfast", category: "meal" },
  { name: "Lunch", slug: "lunch", category: "meal" },
  { name: "Dinner", slug: "dinner", category: "meal" },
  { name: "Drinks", slug: "drinks", category: "meal" },
  { name: "Takeaway", slug: "takeaway", category: "meal" },
  { name: "Cafe", slug: "cafe", category: "meal" },
  { name: "Fried Chicken", slug: "fried-chicken", category: "meal" },
  { name: "Sandwich", slug: "sandwich", category: "meal" },
  { name: "Noodles", slug: "noodles", category: "meal" },
  { name: "Laksa", slug: "laksa", category: "meal" },
  { name: "San Choi Bao", slug: "san-choi-bao", category: "meal" },
  { name: "Casual", slug: "casual", category: "style" },
  { name: "Fancy", slug: "fancy", category: "style" },
  { name: "Quick", slug: "quick", category: "style" },
  { name: "Group Friendly", slug: "group-friendly", category: "style" },
  { name: "Date Night", slug: "date-night", category: "style" },
  { name: "Gluten Free Menu", slug: "gluten-free-menu", category: "dietary" },
  { name: "GF Bread Available", slug: "gf-bread-available", category: "dietary" },
  { name: "Dedicated Fryer", slug: "dedicated-fryer", category: "dietary" },
  { name: "Gluten Free Soy Sauce", slug: "gluten-free-soy-sauce", category: "dietary" },
  { name: "Coeliac Aware", slug: "coeliac-aware", category: "dietary" },
  { name: "Uncertain GF", slug: "uncertain-gf", category: "dietary" },
  { name: "Near Station", slug: "near-station", category: "logistics" },
  { name: "Good Backup", slug: "good-backup", category: "logistics" },
  { name: "Booking Helpful", slug: "booking-helpful", category: "logistics" },
  { name: "Quiet", slug: "quiet", category: "vibe" },
  { name: "Lively", slug: "lively", category: "vibe" },
  { name: "Special Occasion", slug: "special-occasion", category: "vibe" }
];

const PLACES = [
  {
    name: "Harbour Pantry",
    suburb: "Circular Quay",
    address: "12 Ferry Lane, Circular Quay NSW",
    latitude: -33.8609,
    longitude: 151.2127,
    website_url: "https://example.com/harbour-pantry",
    google_maps_url: "",
    status: "trusted",
    gf_confidence: "strong",
    notes_public: "Reliable breakfast and lunch option with staff who understand cross-contact.",
    notes_private: "Ask for the separate toast setup if ordering eggs.",
    featured: 1,
    is_public: 1,
    tags: ["breakfast", "cafe", "sandwich", "casual", "gluten-free-menu", "gf-bread-available", "coeliac-aware", "near-station", "good-backup"],
    opening_hours: weekdayCafeHours()
  },
  {
    name: "Laneway Bento",
    suburb: "Surry Hills",
    address: "88 Albion Street, Surry Hills NSW",
    latitude: -33.884,
    longitude: 151.209,
    website_url: "https://example.com/laneway-bento",
    google_maps_url: "",
    status: "want_to_try",
    gf_confidence: "partial",
    notes_public: "Looks promising for quick lunches with marked gluten free options.",
    notes_private: "Need to confirm soy sauce handling before trusting it.",
    featured: 0,
    is_public: 1,
    tags: ["lunch", "quick", "takeaway", "noodles", "gluten-free-soy-sauce", "near-station"],
    opening_hours: weekdayLunchHours()
  },
  {
    name: "Northside Supper Club",
    suburb: "Neutral Bay",
    address: "44 Waters Road, Neutral Bay NSW",
    latitude: -33.8308,
    longitude: 151.2181,
    website_url: "https://example.com/northside-supper-club",
    google_maps_url: "",
    status: "trusted",
    gf_confidence: "strong",
    notes_public: "Great dinner choice with clear allergy notes and strong mains.",
    notes_private: "Worth booking on Fridays.",
    featured: 1,
    is_public: 1,
    tags: ["dinner", "fancy", "fried-chicken", "date-night", "gluten-free-menu", "coeliac-aware", "booking-helpful", "special-occasion"],
    opening_hours: dinnerHours()
  },
  {
    name: "Station Taco Bar",
    suburb: "Newtown",
    address: "7 Wilson Street, Newtown NSW",
    latitude: -33.8972,
    longitude: 151.179,
    website_url: "https://example.com/station-taco-bar",
    google_maps_url: "",
    status: "trusted",
    gf_confidence: "partial",
    notes_public: "Good casual backup if you want something lively and fast.",
    notes_private: "Check fryer status each visit.",
    featured: 0,
    is_public: 1,
    tags: ["dinner", "fried-chicken", "casual", "quick", "group-friendly", "good-backup", "lively"],
    opening_hours: dinnerHours({ fridayClose: "22:30", saturdayClose: "22:30" })
  },
  {
    name: "Garden Terrace Cafe",
    suburb: "Paddington",
    address: "25 Glenmore Road, Paddington NSW",
    latitude: -33.8846,
    longitude: 151.2276,
    website_url: "https://example.com/garden-terrace",
    google_maps_url: "",
    status: "trusted",
    gf_confidence: "strong",
    notes_public: "Calm cafe with good coffee and a dependable gluten free breakfast menu.",
    notes_private: "Best earlier in the day before it gets busy.",
    featured: 1,
    is_public: 1,
    tags: ["breakfast", "cafe", "quiet", "sandwich", "gluten-free-menu", "dedicated-fryer", "casual"],
    opening_hours: weekdayCafeHours({ weekdayOpen: "08:00", weekdayClose: "15:30" })
  },
  {
    name: "Late Plate Kitchen",
    suburb: "Darlinghurst",
    address: "130 Crown Street, Darlinghurst NSW",
    latitude: -33.876,
    longitude: 151.2218,
    website_url: "https://example.com/late-plate-kitchen",
    google_maps_url: "",
    status: "want_to_try",
    gf_confidence: "uncertain",
    notes_public: "Useful late option to investigate for drinks and a snack.",
    notes_private: "Need to ask about fryer and sauce prep.",
    featured: 0,
    is_public: 1,
    tags: ["drinks", "dinner", "laksa", "lively", "uncertain-gf"],
    opening_hours: dinnerHours({ weekdayOpen: "17:30", sundayClosed: false, sundayOpen: "17:30", sundayClose: "21:00" })
  },
  {
    name: "Riverside Grill",
    suburb: "Parramatta",
    address: "10 Riverbank Walk, Parramatta NSW",
    latitude: -33.815,
    longitude: 151.0011,
    website_url: "https://example.com/riverside-grill",
    google_maps_url: "",
    status: "trusted",
    gf_confidence: "partial",
    notes_public: "Dependable larger-group dinner place with some GF substitutions.",
    notes_private: "Bread substitute available if requested early.",
    featured: 0,
    is_public: 1,
    tags: ["dinner", "group-friendly", "gf-bread-available", "booking-helpful", "casual"],
    opening_hours: dinnerHours({ weekdayOpen: "18:00", weekdayClose: "21:30", saturdayClose: "22:00" })
  },
  {
    name: "Moonlight Dining Room",
    suburb: "Potts Point",
    address: "19 Macleay Street, Potts Point NSW",
    latitude: -33.8734,
    longitude: 151.2254,
    website_url: "https://example.com/moonlight-dining-room",
    google_maps_url: "",
    status: "trusted",
    gf_confidence: "strong",
    notes_public: "A polished dinner spot for when you want something special and reliable.",
    notes_private: "Keep in mind for anniversaries and birthdays.",
    featured: 1,
    is_public: 1,
    tags: ["dinner", "fancy", "san-choi-bao", "date-night", "coeliac-aware", "quiet", "special-occasion"],
    opening_hours: dinnerHours({ weekdayOpen: "18:30", weekdayClose: "22:00", fridayClose: "23:00", saturdayClose: "23:00" })
  },
  {
    name: "Platform Noodle House",
    suburb: "Chatswood",
    address: "5 Archer Street, Chatswood NSW",
    latitude: -33.7963,
    longitude: 151.1832,
    website_url: "https://example.com/platform-noodle-house",
    google_maps_url: "",
    status: "avoid",
    gf_confidence: "uncertain",
    notes_public: "Previously looked convenient near the station.",
    notes_private: "Staff advice has been inconsistent. Keep hidden from public by default.",
    featured: 0,
    is_public: 0,
    tags: ["noodles", "near-station", "uncertain-gf", "quick"],
    opening_hours: weekdayLunchHours()
  },
  {
    name: "Weekend Picnic Deli",
    suburb: "Balmain",
    address: "55 Darling Street, Balmain NSW",
    latitude: -33.8574,
    longitude: 151.1783,
    website_url: "https://example.com/weekend-picnic-deli",
    google_maps_url: "",
    status: "want_to_try",
    gf_confidence: "unknown",
    notes_public: "Looks like a good plan-ahead deli stop for takeaway and picnic supplies.",
    notes_private: "Need to inspect labelling in person.",
    featured: 0,
    is_public: 1,
    tags: ["takeaway", "cafe", "sandwich", "casual", "good-backup", "quiet"],
    opening_hours: weekdayCafeHours({ saturdayOpen: "09:00", saturdayClose: "16:00", sundayOpen: "09:00", sundayClose: "16:00" })
  }
];

async function seedDatabase() {
  await initializeDatabase();

  await run("DELETE FROM opening_hours");
  await run("DELETE FROM place_tags");
  await run("DELETE FROM places");
  await run("DELETE FROM tags");

  for (const tag of TAGS) {
    await run(
      `INSERT INTO tags (name, slug, category, tag_group) VALUES (?, ?, ?, ?)`,
      [tag.name, tag.slug, tag.category, getTagGroupForSlug(tag.slug)]
    );
  }

  const tags = await all(`SELECT id, slug FROM tags`);
  const tagIdBySlug = new Map(tags.map((tag) => [tag.slug, tag.id]));

  for (const place of PLACES) {
    const slug = slugify(place.name);
    const insertResult = await run(
      `INSERT INTO places (
        name,
        slug,
        suburb,
        address,
        latitude,
        longitude,
        website_url,
        google_maps_url,
        status,
        gf_confidence,
        notes_public,
        notes_private,
        featured,
        is_public,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        place.name,
        slug,
        place.suburb,
        place.address,
        place.latitude,
        place.longitude,
        place.website_url,
        place.google_maps_url,
        place.status,
        place.gf_confidence,
        place.notes_public,
        place.notes_private,
        place.featured,
        place.is_public
      ]
    );

    for (const tagSlug of place.tags) {
      const tagId = tagIdBySlug.get(tagSlug);

      if (!tagId) {
        continue;
      }

      await run(
        `INSERT INTO place_tags (place_id, tag_id) VALUES (?, ?)`,
        [insertResult.lastID, tagId]
      );
    }

    for (const hours of place.opening_hours) {
      await run(
        `INSERT INTO opening_hours (place_id, day_of_week, open_time, close_time, is_closed)
         VALUES (?, ?, ?, ?, ?)`,
        [
          insertResult.lastID,
          hours.day_of_week,
          hours.open_time,
          hours.close_time,
          hours.is_closed ? 1 : 0
        ]
      );
    }
  }

  await seedAdminUser();
}

async function seedAdminUser() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.log("Skipping admin user seed because ADMIN_USERNAME or ADMIN_PASSWORD is missing.");
    return;
  }

  const existingAdmin = await get(
    `SELECT id FROM admin_users WHERE username = ?`,
    [username]
  );

  const passwordHash = await bcrypt.hash(password, 10);

  if (existingAdmin) {
    await run(
      `UPDATE admin_users SET password_hash = ? WHERE id = ?`,
      [passwordHash, existingAdmin.id]
    );
    return;
  }

  await run(
    `INSERT INTO admin_users (username, password_hash) VALUES (?, ?)`,
    [username, passwordHash]
  );
}

function weekdayCafeHours(overrides = {}) {
  return buildWeekSchedule({
    0: [overrides.sundayOpen || "08:00", overrides.sundayClose || "15:00"],
    1: [overrides.weekdayOpen || "07:30", overrides.weekdayClose || "15:00"],
    2: [overrides.weekdayOpen || "07:30", overrides.weekdayClose || "15:00"],
    3: [overrides.weekdayOpen || "07:30", overrides.weekdayClose || "15:00"],
    4: [overrides.weekdayOpen || "07:30", overrides.weekdayClose || "15:00"],
    5: [overrides.weekdayOpen || "07:30", overrides.weekdayClose || "15:00"],
    6: [overrides.saturdayOpen || "08:00", overrides.saturdayClose || "15:00"]
  });
}

function weekdayLunchHours() {
  return buildWeekSchedule({
    0: null,
    1: ["11:30", "15:00"],
    2: ["11:30", "15:00"],
    3: ["11:30", "15:00"],
    4: ["11:30", "15:00"],
    5: ["11:30", "15:00"],
    6: ["11:30", "15:30"]
  });
}

function dinnerHours(overrides = {}) {
  return buildWeekSchedule({
    0: overrides.sundayClosed === false
      ? [overrides.sundayOpen || "17:00", overrides.sundayClose || "21:00"]
      : null,
    1: [overrides.weekdayOpen || "17:00", overrides.weekdayClose || "21:00"],
    2: [overrides.weekdayOpen || "17:00", overrides.weekdayClose || "21:00"],
    3: [overrides.weekdayOpen || "17:00", overrides.weekdayClose || "21:00"],
    4: [overrides.weekdayOpen || "17:00", overrides.weekdayClose || "21:00"],
    5: [overrides.weekdayOpen || "17:00", overrides.fridayClose || "22:00"],
    6: [overrides.saturdayOpen || overrides.weekdayOpen || "17:00", overrides.saturdayClose || "22:00"]
  });
}

function buildWeekSchedule(dayMap) {
  const schedule = [];

  for (let day = 0; day < 7; day += 1) {
    const hours = dayMap[day];

    if (!hours) {
      schedule.push({
        day_of_week: day,
        open_time: "",
        close_time: "",
        is_closed: true
      });
      continue;
    }

    schedule.push({
      day_of_week: day,
      open_time: hours[0],
      close_time: hours[1],
      is_closed: false
    });
  }

  return schedule;
}

function getTagGroupForSlug(slug) {
  if (["sandwich", "noodles", "laksa", "fried-chicken", "san-choi-bao"].includes(slug)) {
    return "menu_items";
  }

  if (["gf-bread-available", "dedicated-fryer", "gluten-free-menu", "gluten-free-soy-sauce", "coeliac-aware", "uncertain-gf"].includes(slug)) {
    return "gluten_features";
  }

  return "category";
}

seedDatabase()
  .then(() => {
    console.log("Seed data created.");
  })
  .catch((error) => {
    console.error("Failed to seed database:", error);
    process.exit(1);
  });
