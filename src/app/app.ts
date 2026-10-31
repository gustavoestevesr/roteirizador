import { Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import * as Leaflet from 'leaflet';

@Component({
  imports: [LeafletModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatFormFieldModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('roteirizador');

  readonly isLocating = signal(false);
  readonly locationError = signal<string | null>(null);

  private map: Leaflet.Map | null = null;
  private currentLocationMarker: Leaflet.CircleMarker | null = null;

  options: Leaflet.MapOptions = {
    layers: getLayers(),
    zoomAnimation: true,
    zoomControl: true,
    doubleClickZoom: true,
    dragging: true,
    zoom: 12,
    center: new Leaflet.LatLng(43.530147, 16.488932),
  };

  onMapReady(map: Leaflet.Map): void {
    this.map = map;
  }

  getMyLocation(): void {
    if (!navigator.geolocation) {
      this.locationError.set('A geolocalização não está disponível neste navegador.');
      return;
    }

    this.isLocating.set(true);
    this.locationError.set(null);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.isLocating.set(false);

        if (!this.map) {
          this.locationError.set('O mapa ainda não está pronto. Tente novamente.');
          return;
        }

        const location = new Leaflet.LatLng(coords.latitude, coords.longitude);
        this.map.setView(location, Math.max(this.map.getZoom(), 15));

        if (this.currentLocationMarker) {
          this.currentLocationMarker.setLatLng(location);
        } else {
          this.currentLocationMarker = Leaflet.circleMarker(location, {
            radius: 8,
            color: '#ffffff',
            weight: 3,
            fillColor: '#2563eb',
            fillOpacity: 1,
          }).addTo(this.map);
          this.currentLocationMarker.bindPopup('Sua localização');
        }
      },
      (error) => {
        this.isLocating.set(false);
        this.locationError.set(getGeolocationErrorMessage(error));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }
}

const getGeolocationErrorMessage = (error: GeolocationPositionError): string => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Permita o acesso à localização no navegador para continuar.';
    case error.POSITION_UNAVAILABLE:
      return 'Não foi possível determinar sua localização.';
    case error.TIMEOUT:
      return 'A localização demorou demais. Tente novamente.';
    default:
      return 'Ocorreu um erro ao obter sua localização.';
  }
};

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
