import type { WatchlistSnapshot } from "@/lib/watchlist";

export interface WatchlistService {
  getSnapshot(): Promise<WatchlistSnapshot>;
  refresh(): Promise<WatchlistSnapshot>;
}

/**
 * Browser-facing adapter. The browser never imports the fixture dataset;
 * every snapshot crosses the server visibility boundary first. The route
 * resolves the current fictional demo profile and returns public or protected
 * prototype data.
 */
class WatchlistApiService implements WatchlistService {
  private async requestSnapshot(): Promise<WatchlistSnapshot> {
    const response = await fetch("/api/watchlist", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Watchlist request failed (${response.status})`);
    return response.json() as Promise<WatchlistSnapshot>;
  }

  async getSnapshot(): Promise<WatchlistSnapshot> {
    return this.requestSnapshot();
  }

  async refresh(): Promise<WatchlistSnapshot> {
    return this.requestSnapshot();
  }
}

export const watchlistService: WatchlistService = new WatchlistApiService();
