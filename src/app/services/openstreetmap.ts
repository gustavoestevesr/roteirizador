import { Service, signal } from '@angular/core';

export interface AddressSearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

@Service()
export class OpenstreetmapService {
  private lastAddressSearched = signal<string>('');

  async searchAddresses(addressQuery: string): Promise<AddressSearchResult[]> {
    const query = addressQuery.trim();

    if (!query) {
      throw new Error('Digite um endereço para pesquisar.');
    }

    const sameLastQuery = this.lastAddressSearched().includes(query);
    if (sameLastQuery) {
      return Promise.resolve([]);
    }

    this.lastAddressSearched.set(query);

    const params = new URLSearchParams({
      format: 'jsonv2',
      limit: '5',
      'accept-language': 'pt-BR',
      q: query,
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);

    if (!response.ok) {
      throw new Error(`Address search failed with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  }
}
