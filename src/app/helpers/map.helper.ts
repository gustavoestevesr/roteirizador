import * as Leaflet from 'leaflet';

export function diffBetweenCoordinates(coord1: Leaflet.LatLng, coord2: Leaflet.LatLng): number {
  const latDiff = coord1.lat - coord2.lat;
  const lngDiff = coord1.lng - coord2.lng;
  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
}
