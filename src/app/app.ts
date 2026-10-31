import { Component, signal } from '@angular/core';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import * as Leaflet from 'leaflet';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';

@Component({
  imports: [LeafletModule, MatListModule, MatIconModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('roteirizador');

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

    const sameLastQuery = this.lastAddressSearched().includes(query);
    if (sameLastQuery) {
      return;
    }

    this.lastAddressSearched.set(query);

    this.isSearching.set(true);
    this.searchError.set(null);
    this.addressResults.set([]);
    this.hasSearched.set(false);

    const params = new URLSearchParams({
      format: 'jsonv2',
      limit: '5',
      'accept-language': 'pt-BR',
      q: query,
    });

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      if (!response.ok) {
        throw new Error(`Address search failed with status ${response.status}`);
      }

      const payload: unknown = await response.json();
      if (!Array.isArray(payload) || !payload.every(isAddressSearchResult)) {
        throw new Error('Address search returned an invalid response');
      }

      this.addressResults.set(payload);
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
        this.map.setView(location, Math.max(this.map.getZoom(), 12));

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

interface AddressSearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

const isAddressSearchResult = (value: unknown): value is AddressSearchResult => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const result = value as Record<string, unknown>;
  return (
    typeof result['place_id'] === 'number' &&
    typeof result['display_name'] === 'string' &&
    typeof result['lat'] === 'string' &&
    Number.isFinite(Number(result['lat'])) &&
    typeof result['lon'] === 'string' &&
    Number.isFinite(Number(result['lon']))
  );
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
