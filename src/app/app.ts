import { Component, inject, signal } from '@angular/core';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import * as Leaflet from 'leaflet';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { AddressSearchResult, OpenstreetmapService } from './services/openstreetmap';

@Component({
  imports: [LeafletModule, MatListModule, MatIconModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('roteirizador');

  private readonly openstreetmapService = inject(OpenstreetmapService);

  readonly isOrdering = signal(false);
  readonly isLocating = signal(false);
  readonly locationError = signal<string | null>(null);
  readonly isSearching = signal(false);
  readonly lastAddressSearched = signal<string>('');
  readonly searchError = signal<string | null>(null);
  readonly addressResults = signal<AddressSearchResult[]>([]);
  readonly hasSearched = signal(false);
  readonly selectedAddresses = signal<AddressSearchResult[]>([]);

  private map: Leaflet.Map | null = null;
  private currentLocationMarker: Leaflet.CircleMarker | null = null;
  private routePolygon: Leaflet.Polygon | null = null;
  readonly markers: Leaflet.Marker[] = [];

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
    this.updateRoutePolygon();
  }

  async searchAddresses(event: SubmitEvent, addressQuery: string): Promise<void> {
    event.preventDefault();
    const query = addressQuery.trim();

    if (!query) {
      this.searchError.set('Digite um endereço para pesquisar.');
      this.addressResults.set([]);
      this.hasSearched.set(false);
      return;
    }

    this.isSearching.set(true);
    this.searchError.set(null);
    this.addressResults.set([]);
    this.hasSearched.set(false);

    try {
      const results = await this.openstreetmapService.searchAddresses(query);

      this.addressResults.set(results);

      this.hasSearched.set(true);
    } catch {
      this.searchError.set(
        'Não foi possível pesquisar endereços. Verifique sua conexão e tente novamente.',
      );
    } finally {
      this.isSearching.set(false);
    }
  }

  removeSelectedAddress(selected: AddressSearchResult): void {
    const addresses = this.selectedAddresses();
    const selectedIndex = addresses.findIndex((address) => address.place_id === selected.place_id);

    if (selectedIndex === -1) {
      return;
    }

    this.markers.splice(selectedIndex, 1)[0]?.remove();
    const remainingAddresses = addresses.filter(
      (address) => address.place_id !== selected.place_id,
    );
    this.selectedAddresses.set(remainingAddresses);
    this.updateRoutePolygon();

    this.markers.forEach((marker, index) => {
      const description = `${index + 1}° Rota - ${remainingAddresses[index].display_name}`;
      marker.options.title = description;
      marker.options.alt = description;
      marker.getElement()?.setAttribute('title', description);
      marker.getElement()?.setAttribute('alt', description);
    });
  }

  selectAddress(result: AddressSearchResult): void {
    if (!this.map) {
      this.searchError.set('O mapa ainda não está pronto. Tente novamente.');
      return;
    }

    const location = new Leaflet.LatLng(Number(result.lat), Number(result.lon));
    this.map.setView(location, 12);

    if (this.selectedAddresses().some((address) => address.place_id === result.place_id)) {
      return;
    }

    const index = this.selectedAddresses().length + 1;
    const description = `${index}° Rota - ${result.display_name}`;
    const marker = Leaflet.marker(location, {
      icon: new Leaflet.Icon({
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        iconUrl: 'assets/blue-marker.svg',
      }),
      title: description,
      alt: description,
    }).addTo(this.map);

    this.markers.push(marker);
    this.selectedAddresses.update((addresses) => [...addresses, result]);
    this.updateRoutePolygon();
  }

  getMyLocation(): void {
    void this.locateMyLocation();
  }

  private locateMyLocation(): Promise<Leaflet.LatLng | null> {
    if (!navigator.geolocation) {
      this.locationError.set('A geolocalização não está disponível neste navegador.');
      return Promise.resolve(null);
    }

    this.isLocating.set(true);
    this.locationError.set(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          this.isLocating.set(false);

          if (!this.map) {
            this.locationError.set('O mapa ainda não está pronto. Tente novamente.');
            resolve(null);
            return;
          }

          const location = new Leaflet.LatLng(coords.latitude, coords.longitude);
          this.map.setView(location, 12);

          if (this.currentLocationMarker) {
            this.currentLocationMarker.setLatLng(location);
          } else {
            this.currentLocationMarker = Leaflet.circleMarker(location, {
              radius: 9,
              color: '#ffffff',
              weight: 3,
              fillColor: '#2563eb',
              fillOpacity: 1,
            }).addTo(this.map);
            this.currentLocationMarker.bindPopup('Sua localização');
          }

          this.updateRoutePolygon();
          resolve(location);
        },
        (error) => {
          this.isLocating.set(false);
          this.locationError.set(getGeolocationErrorMessage(error));
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });
  }

  async orderAddresses(): Promise<void> {
    if (this.selectedAddresses().length < 2 || this.isOrdering()) {
      return;
    }

    this.isOrdering.set(true);
    try {
      const location = await this.locateMyLocation();
      if (!location) {
        return;
      }

      const remainingAddresses = this.selectedAddresses().map((address, index) => ({
        address,
        marker: this.markers[index],
      }));
      const orderedAddresses: AddressSearchResult[] = [];
      const orderedMarkers: Leaflet.Marker[] = [];
      let currentLocation = location;

      while (remainingAddresses.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;

        remainingAddresses.forEach(({ address }, index) => {
          const distance = getDistanceInMeters(
            currentLocation.lat,
            currentLocation.lng,
            Number(address.lat),
            Number(address.lon),
          );
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        });

        const [nearest] = remainingAddresses.splice(nearestIndex, 1);
        orderedAddresses.push(nearest.address);
        orderedMarkers.push(nearest.marker);
        currentLocation = new Leaflet.LatLng(
          Number(nearest.address.lat),
          Number(nearest.address.lon),
        );
      }

      this.selectedAddresses.set(orderedAddresses);
      this.markers.splice(0, this.markers.length, ...orderedMarkers);

      this.markers.forEach((marker, index) => {
        const description = `${index + 1}° Rota - ${orderedAddresses[index].display_name}`;
        marker.options.title = description;
        marker.options.alt = description;
        marker.getElement()?.setAttribute('title', description);
        marker.getElement()?.setAttribute('alt', description);
      });
      this.updateRoutePolygon();
    } finally {
      this.isOrdering.set(false);
    }
  }

  private updateRoutePolygon(): void {
    if (!this.map || !this.currentLocationMarker || this.selectedAddresses().length < 2) {
      this.routePolygon?.remove();
      this.routePolygon = null;
      return;
    }

    const routePoints = [
      this.currentLocationMarker.getLatLng(),
      ...this.selectedAddresses().map(
        (address) => new Leaflet.LatLng(Number(address.lat), Number(address.lon)),
      ),
    ];

    if (this.routePolygon) {
      this.routePolygon.setLatLngs(routePoints);
      return;
    }

    this.routePolygon = Leaflet.polygon(routePoints, {
      color: '#2563eb',
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      weight: 3,
    }).addTo(this.map);
  }
}

const getDistanceInMeters = (
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
): number => {
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const latitudeDifference = toRadians(endLatitude - startLatitude);
  const longitudeDifference = toRadians(endLongitude - startLongitude);
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(startLatitude)) *
      Math.cos(toRadians(endLatitude)) *
      Math.sin(longitudeDifference / 2) ** 2;

  return 2 * 6371000 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

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
      attribution: '&copy; OpenStreetMap contributors',
    } as Leaflet.TileLayerOptions),
  ] as Leaflet.Layer[];
};
