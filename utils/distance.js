function haversineDistanceKm(fromLat, fromLng, toLat, toLng) {
  const earthRadiusKm = 6371;
  const latDelta = degreesToRadians(toLat - fromLat);
  const lngDelta = degreesToRadians(toLng - fromLng);
  const fromLatRadians = degreesToRadians(fromLat);
  const toLatRadians = degreesToRadians(toLat);

  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(fromLatRadians)
    * Math.cos(toLatRadians)
    * Math.sin(lngDelta / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

module.exports = {
  haversineDistanceKm
};
