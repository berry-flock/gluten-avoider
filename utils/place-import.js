async function enrichPlaceFormFromShareLink(formData) {
  if (!formData.share_url) {
    return { errorMessage: "", formData };
  }

  try {
    const response = await fetch(formData.share_url, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 TrustedPlaces/1.0"
      }
    });

    const finalUrl = new URL(response.url);
    const responseText = response.headers.get("content-type")?.includes("text/html")
      ? await response.text()
      : "";
    const imported = extractPlaceData(finalUrl, responseText);

    if (!formData.name && imported.name) {
      formData.name = imported.name;
    }

    if (!formData.address && imported.address) {
      formData.address = imported.address;
    }

    if (!formData.latitude && imported.latitude !== null) {
      formData.latitude = String(imported.latitude);
    }

    if (!formData.longitude && imported.longitude !== null) {
      formData.longitude = String(imported.longitude);
    }

    if (!formData.suburb && imported.suburb) {
      formData.suburb = imported.suburb;
    }

    return { errorMessage: "", formData };
  } catch (error) {
    return {
      errorMessage: "Could not read that map share link. You can still fill the fields manually.",
      formData
    };
  }
}

function extractPlaceData(url, responseText = "") {
  if (url.hostname.includes("apple.com")) {
    return enrichWithMetadata(extractAppleMapsData(url), responseText);
  }

  if (url.hostname.includes("google")) {
    return enrichWithMetadata(extractGoogleMapsData(url), responseText);
  }

  return emptyImportResult();
}

function extractAppleMapsData(url) {
  const ll = url.searchParams.get("ll") || url.searchParams.get("sll") || "";
  const query = url.searchParams.get("q") || "";
  const address = url.searchParams.get("address") || "";
  const [latitude, longitude] = parseCoordinatePair(ll);

  return {
    address: streetAddressFromAddress(address),
    latitude,
    longitude,
    name: query && query !== address ? query : "",
    suburb: suburbFromAddress(address || query)
  };
}

function extractGoogleMapsData(url) {
  const pathMatch = url.pathname.match(/\/maps\/place\/([^/]+)/) || url.pathname.match(/\/place\/([^/]+)/);
  const atMatch = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const queryValue = url.searchParams.get("q") || url.searchParams.get("query") || "";
  const [queryLat, queryLng] = parseCoordinatePair(queryValue);

  return {
    address: "",
    latitude: atMatch ? Number(atMatch[1]) : queryLat,
    longitude: atMatch ? Number(atMatch[2]) : queryLng,
    name: pathMatch ? decodeURIComponent(pathMatch[1]).replace(/\+/g, " ") : "",
    suburb: ""
  };
}

function parseCoordinatePair(value) {
  const match = String(value).match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);

  if (!match) {
    return [null, null];
  }

  return [Number(match[1]), Number(match[2])];
}

function suburbFromAddress(value) {
  const parts = String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return "";
  }

  return parts[1]
    .replace(/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b.*$/i, "")
    .trim();
}

function streetAddressFromAddress(value) {
  const firstPart = String(value).split(",")[0].trim();

  return firstPart
    .replace(/\bSt\b/g, "Street")
    .replace(/\bRd\b/g, "Road")
    .replace(/\bAve\b/g, "Avenue")
    .replace(/\bDr\b/g, "Drive");
}

function enrichWithMetadata(imported, responseText) {
  if (!responseText) {
    return imported;
  }

  const title = extractMetaContent(responseText, "og:title")
    || extractTitle(responseText);

  if (!imported.name && title && !/apple maps|google maps/i.test(title)) {
    imported.name = title.replace(/\s*[-|].*$/, "").trim();
  }

  return imported;
}

function extractMetaContent(html, propertyName) {
  const metaMatch = html.match(
    new RegExp(`<meta[^>]+property=["']${propertyName}["'][^>]+content=["']([^"']+)["']`, "i")
  );

  return metaMatch ? decodeHtml(metaMatch[1]) : "";
}

function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? decodeHtml(titleMatch[1]) : "";
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function emptyImportResult() {
  return {
    address: "",
    latitude: null,
    longitude: null,
    name: "",
    suburb: ""
  };
}

module.exports = {
  enrichPlaceFormFromShareLink
};
