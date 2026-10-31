import { Component, inject, signal } from '@angular/core';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import * as Leaflet from 'leaflet';

@Component({
  imports: [LeafletModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('roteirizador');

  private readonly navigation = inject(Navigator);

  options: Leaflet.MapOptions = {
    layers: getLayers(),
    zoomAnimation: true,
    zoomControl: true,
    doubleClickZoom: true,
    dragging: true,
    zoom: 12,
    center: new Leaflet.LatLng(43.530147, 16.488932),
  };

  getMyLocation(): void {
    this.navigation.geolocation.getCurrentPosition
  }
}

export const getLayers = (): Leaflet.Layer[] => {
  return [
    new Leaflet.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    } as Leaflet.TileLayerOptions),
    ...getMarkers(),
    ...getRoutes(),
    ...getPolygons()
  ] as Leaflet.Layer[];
};

export const getPolygons = (): Leaflet.Polygon[] => {
  return [
    new Leaflet.Polygon([
      new Leaflet.LatLng(43.5181349, 16.4537963),
      new Leaflet.LatLng(43.517890, 16.439939),
      new Leaflet.LatLng(43.515599, 16.446556),
      new Leaflet.LatLng(43.518025, 16.463492)
    ] as Leaflet.LatLng[],
      {
        fillColor: '#eb530d',
        color: '#eb780d'
      } as Leaflet.PolylineOptions)
  ] as Leaflet.Polygon[];
};

export const getMarkers = (): Leaflet.Marker[] => {
  return [
    new Leaflet.Marker(new Leaflet.LatLng(43.5121264, 16.4700729), {
      icon: new Leaflet.Icon({
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        iconUrl: 'assets/blue-marker.svg',
      }),
      title: 'Workspace'
    } as Leaflet.MarkerOptions),
    new Leaflet.Marker(new Leaflet.LatLng(43.5074826, 16.4390046), {
      icon: new Leaflet.Icon({
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        iconUrl: 'assets/red-marker.svg',
      }),
      title: 'Riva'
    } as Leaflet.MarkerOptions),
  ] as Leaflet.Marker[];
};

export const getRoutes = (): Leaflet.Polyline[] => {
  return [
    new Leaflet.Polyline([
      new Leaflet.LatLng(43.5121264, 16.4700729),
      new Leaflet.LatLng(43.5074826, 16.4390046),
    ] as Leaflet.LatLng[], {
      color: '#0d9148'
    } as Leaflet.PolylineOptions)
  ] as Leaflet.Polyline[];
};
