import { MediaItem } from "@/types/media";

type IdentityInput = Partial<MediaItem> & {
  Id?: string;
  Name?: string;
  ProductionYear?: number;
};

export class MediaIdentityService {
  static resolveCanonicalId(input: IdentityInput | null | undefined): string | null {
    if (!input) return null;

    const fromProviderIds = this.fromProviderIds(input.ProviderIds);
    if (fromProviderIds) return fromProviderIds;

    const fromGuid = this.fromGuid(input.Guid);
    if (fromGuid) return fromGuid;

    // TMDB items use numeric IDs directly.
    if (input.Id && /^\d+$/.test(input.Id)) {
      return `tmdb:${input.Id}`;
    }

    // Fallback for providers without stable external refs.
    const title = this.normalizeTitle(input.Name || "");
    const year = Number.isFinite(input.ProductionYear) ? String(input.ProductionYear) : "0";
    if (!title) return null;
    return `title:${title}:${year}`;
  }

  static matchByCanonicalOrExternal(itemId: string, canonicalId: string | null): {
    externalId: string;
    canonicalId: string | null;
  } {
    return { externalId: itemId, canonicalId };
  }

  private static fromProviderIds(providerIds?: MediaItem["ProviderIds"]): string | null {
    if (!providerIds) return null;
    if (providerIds.Tmdb) return `tmdb:${providerIds.Tmdb}`;
    if (providerIds.Imdb) return `imdb:${providerIds.Imdb.toLowerCase()}`;
    if (providerIds.Tvdb) return `tvdb:${providerIds.Tvdb}`;
    return null;
  }

  private static fromGuid(guid?: string): string | null {
    if (!guid) return null;

    const trimmed = guid.trim();
    if (!trimmed) return null;

    // Handles guid-like strings such as:
    // - imdb://tt1234567
    // - tmdb://12345
    // - com.plexapp.agents.imdb://tt1234567?lang=en
    const imdbMatch = trimmed.match(/imdb[:/]+(tt\d+)/i);
    if (imdbMatch?.[1]) return `imdb:${imdbMatch[1].toLowerCase()}`;

    const tmdbMatch = trimmed.match(/tmdb[:/]+(\d+)/i);
    if (tmdbMatch?.[1]) return `tmdb:${tmdbMatch[1]}`;

    const tvdbMatch = trimmed.match(/tvdb[:/]+(\d+)/i);
    if (tvdbMatch?.[1]) return `tvdb:${tvdbMatch[1]}`;

    return null;
  }

  private static normalizeTitle(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }
}

