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
  const priceText = listing.price ? `\n💰 Price: ${listing.price} SEK` : "\n🆓 Free entry";
  const eventUrl = listing.slug
    ? `${appUrl}/event/${listing.slug}`
    : `${appUrl}/listing/${listing.id}`;
  return `${listing.title}\n\n${listing.description ?? ""}${priceText}\n\n👉 Reserve your spot: ${eventUrl}`;
}
