interface ListingForPost {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  slug: string | null;
}

/**
 * The text used when publishing a listing as a Facebook page post — shared by
 * the manual "Publicera på Facebook" action and the auto-reminder cron so the
 * "Boka här" link and formatting stay identical in one place.
 */
export function buildListingPostMessage(listing: ListingForPost, appUrl: string): string {
  const priceText = listing.price ? `\n💰 Pris: ${listing.price} SEK` : "\n🆓 Gratis";
  const eventUrl = `${appUrl}/listing/${listing.slug || listing.id}`;
  return `${listing.title}\n\n${listing.description ?? ""}${priceText}\n\n👉 Boka här: ${eventUrl}`;
}
