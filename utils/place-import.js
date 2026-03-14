async function enrichPlaceFormFromShareLink(formData) {
  if (!formData.share_url) {
    return { errorMessage: "", formData };
  }

  try {
    const response = await fetch(formData.share_url, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 GlutenAvoider/1.0"
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
    return enrichWithMetadata(extractAppleMapsData(url, responseText), responseText);
  }

  if (url.hostname.includes("google")) {
    return enrichWithMetadata(extractGoogleMapsData(url, responseText), responseText);
  }

  return emptyImportResult();
}

function extractAppleMapsData(url, responseText = "") {
  const coordinatePair = findCoordinatePair([
    url.searchParams.get("ll"),
    url.searchParams.get("sll"),
    url.searchParams.get("near"),
    url.searchParams.get("address"),
    url.toString(),
    responseText
  ]);
  const query = url.searchParams.get("q") || "";
  const address = url.searchParams.get("address") || extractAddressFromMetadata(responseText) || "";

  return {
    address: streetAddressFromAddress(address),
    latitude: coordinatePair[0],
    longitude: coordinatePair[1],
    name: query && query !== address ? query : "",
    suburb: suburbFromAddress(address || query)
  };
}

function extractGoogleMapsData(url, responseText = "") {
  const pathMatch = url.pathname.match(/\/maps\/place\/([^/]+)/) || url.pathname.match(/\/place\/([^/]+)/);
  const queryValue = url.searchParams.get("q") || url.searchParams.get("query") || "";
  const coordinatePair = findCoordinatePair([
    url.pathname,
    url.search,
    queryValue,
    url.toString(),
    responseText
  ]);
  const metadataAddress = extractAddressFromMetadata(responseText);
  const decodedPathName = pathMatch ? decodeURIComponent(pathMatch[1]).replace(/\+/g, " ") : "";

  return {
    address: streetAddressFromAddress(metadataAddress),
    latitude: coordinatePair[0],
    longitude: coordinatePair[1],
    name: decodedPathName,
    suburb: suburbFromAddress(metadataAddress)
  };
}

function findCoordinatePair(sources) {
  for (const source of sources) {
    const pair = parseCoordinatePair(source);
    if (pair[0] !== null && pair[1] !== null) {
      return pair;
    }
  }

  return [null, null];
}

function parseCoordinatePair(value) {
  const source = String(value || "");

  if (!source) {
    return [null, null];
  }

  const patterns = [
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    /(?:ll|sll|center|near|coordinate)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/i,
    /(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) {
      continue;
    }

    const latitude = Number(match[1]);
    const longitude = Number(match[2]);

    if (isValidCoordinatePair(latitude, longitude)) {
      return [latitude, longitude];
    }
  }

  return [null, null];
}

function isValidCoordinatePair(latitude, longitude) {
  return (
    Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
  );
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

  const title = extractMetaContent(responseText, "property", "og:title")
    || extractMetaContent(responseText, "name", "title")
    || extractTitle(responseText);

  if (!imported.name && title && !/apple maps|google maps/i.test(title)) {
    imported.name = title.replace(/\s*[-|].*$/, "").trim();
  }

  if (!imported.address) {
    const address = extractAddressFromMetadata(responseText);
    if (address) {
      imported.address = streetAddressFromAddress(address);
    }
  }

  if (!imported.suburb && imported.address) {
    imported.suburb = suburbFromAddress(extractAddressFromMetadata(responseText));
  }

  return imported;
}

function extractAddressFromMetadata(html) {
  const candidates = [
    extractMetaContent(html, "property", "og:description"),
    extractMetaContent(html, "name", "description"),
    extractMetaContent(html, "itemprop", "description"),
    extractTitle(html)
  ].filter(Boolean);

  for (const candidate of candidates) {
    const address = parseAddressCandidate(candidate);
    if (address) {
      return address;
    }
  }

  return "";
}

function parseAddressCandidate(value) {
  const candidate = decodeHtml(String(value || ""))
    .replace(/\s+/g, " ")
    .trim();

  if (!candidate) {
    return "";
  }

  const pieces = candidate.split(/[·|]/).map((part) => part.trim()).filter(Boolean);

  for (const piece of pieces) {
    if (looksLikeStreetAddress(piece)) {
      return piece;
    }
  }

  const directMatch = candidate.match(/\b\d+[A-Za-z/-]*\s+[^,]+,\s*[^,]+(?:,\s*(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s*\d{4})?(?:,\s*Australia)?/i);
  return directMatch ? directMatch[0].trim() : "";
}

function looksLikeStreetAddress(value) {
  return /\b\d+[A-Za-z/-]*\s+.+\b(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Boulevard|Blvd|Place|Pl|Way|Court|Ct)\b/i.test(value);
}

function extractMetaContent(html, attributeName, attributeValue) {
  const patterns = [
    new RegExp(`<meta[^>]+${attributeName}=(["'])${escapeRegex(attributeValue)}\\1[^>]+content=(["'])(.*?)\\2`, "is"),
    new RegExp(`<meta[^>]+content=(["'])(.*?)\\1[^>]+${attributeName}=(["'])${escapeRegex(attributeValue)}\\3`, "is")
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const content = match[3] || match[2];
      return decodeHtml(content);
    }
  }

  return "";
}

function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? decodeHtml(titleMatch[1].trim()) : "";
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/gi, "'");
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
