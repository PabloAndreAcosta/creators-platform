import { createAdminClient } from '@/lib/supabase/admin';
import { getServerTranslator } from '@/lib/i18n/server';
import { sendPushToUser } from '@/lib/push/send';
import { NOTIFICATION_NS, renderNotification, type NotificationParams } from './text';

export type NotificationType =
  | 'booking_new'
  | 'booking_confirmed'
  | 'booking_canceled'
  | 'payout'
  | 'review'
  | 'queue_promoted'
  | 'new_post'
  | 'new_message'
  | 'buddy_match'
  | 'ticket_sold'
  | 'event_sold_out'
  | 'waitlist_join'
  | 'shop_sale'
  | 'gage_proposed'
  | 'gage_agreed'
  | 'gage_canceled'
  | 'gage_paid'
  | 'collab_invite'
  // En arrangör vill hålla sitt evenemang hos en lokal. Kopplingen händer inte
  // förrän lokalen svarar ja, så lokalen måste få veta att den ligger och väntar.
  | 'venue_request';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  /**
   * Keys under the `serverNotifications` namespace. Prefer these: the row then
   * stores what happened rather than a finished sentence, so the reader sees it
   * in whatever language their UI is set to.
   */
  titleKey?: string;
  bodyKey?: string;
  params?: NotificationParams;
  /**
   * Literal text, for the few notifications with nothing to translate — a chat
   * preview, an ops note pushed in from another service. Also accepted as an
   * override when a caller has already rendered the strings.
   */
  title?: string;
  message?: string;
  link?: string;
}

/**
 * The language a row's frozen `title`/`message` are rendered in. Those columns
 * are a fallback for clients that predate `title_key` — everything current
 * translates the key at render time — so this is deliberately not Swedish:
 * an untranslated fallback should land on the app's neutral language.
 */
const FALLBACK_LOCALE = 'en';

/**
 * Creates an in-app notification for a user, and mirrors it as a Web Push so
 * they're updated without opening the app. Push is best-effort (no-op until
 * VAPID keys are configured, or if the user hasn't enabled push).
 * Uses admin client so it can be called from server actions and API routes
 * without needing the user's session.
 */
export async function createNotification(params: CreateNotificationParams) {
  const supabase = createAdminClient();

  // Rendered once, only so the row is readable without the message bundle.
  const t = await getServerTranslator(NOTIFICATION_NS, FALLBACK_LOCALE);
  const { title, message } = renderNotification(
    {
      title: params.title ?? '',
      message: params.message ?? '',
      title_key: params.titleKey ?? null,
      body_key: params.bodyKey ?? null,
      params: params.params ?? null,
    },
    t
  );

  const { error } = await supabase.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title,
    message,
    title_key: params.titleKey ?? null,
    body_key: params.bodyKey ?? null,
    params: params.params ?? null,
    link: params.link ?? null,
  });

  if (error) {
    console.error('Failed to create notification:', error);
  }

  await sendPushToUser(params.userId, {
    title,
    body: message,
    titleKey: params.titleKey,
    bodyKey: params.bodyKey,
    params: params.params,
    url: params.link,
    tag: params.type,
  });
}

/**
 * Notify a creator about a new booking.
 */
export async function notifyNewBooking(creatorId: string, customerName: string, serviceName: string) {
  await createNotification({
    userId: creatorId,
    type: 'booking_new',
    titleKey: 'newBookingTitle',
    bodyKey: 'newBookingMsg',
    params: { customer: customerName, service: serviceName },
    link: '/dashboard/bookings',
  });
}

/**
 * Notify a customer that their booking was confirmed.
 */
export async function notifyBookingConfirmed(customerId: string, serviceName: string) {
  await createNotification({
    userId: customerId,
    type: 'booking_confirmed',
    titleKey: 'bookingConfirmedTitle',
    bodyKey: 'bookingConfirmedMsg',
    params: { service: serviceName },
    link: '/dashboard/bookings',
  });
}

/**
 * Notify a user that their booking was canceled.
 */
export async function notifyBookingCanceled(userId: string, serviceName: string) {
  await createNotification({
    userId,
    type: 'booking_canceled',
    titleKey: 'bookingCanceledTitle',
    bodyKey: 'bookingCanceledMsg',
    params: { service: serviceName },
    link: '/dashboard/bookings',
  });
}

/**
 * Notify a creator about a payout.
 */
export async function notifyPayout(creatorId: string, amount: number, type: 'batch' | 'instant') {
  await createNotification({
    userId: creatorId,
    type: 'payout',
    titleKey: type === 'instant' ? 'instantPayoutTitle' : 'payoutTitle',
    bodyKey: 'payoutMsg',
    // Formatted here rather than in the message so every locale gets the same
    // Swedish-krona grouping — the amount is an SEK payout regardless of UI.
    params: { amount: amount.toLocaleString('sv-SE') },
    link: '/dashboard/payouts',
  });
}

/**
 * Notify a creator about a new review.
 */
export async function notifyNewReview(creatorId: string, reviewerName: string, rating: number) {
  await createNotification({
    userId: creatorId,
    type: 'review',
    titleKey: 'newReviewTitle',
    bodyKey: 'newReviewMsg',
    params: { reviewer: reviewerName, rating },
    link: '/app/profile',
  });
}

/**
 * Notify a user that they've been promoted from the queue.
 */
export async function notifyQueuePromoted(userId: string, serviceName: string) {
  await createNotification({
    userId,
    type: 'queue_promoted',
    titleKey: 'queuePromotedTitle',
    bodyKey: 'queuePromotedMsg',
    params: { service: serviceName },
    link: '/app',
  });
}

/**
 * Notify a user about a new message. The sender's name and their own words are
 * the content here, so there is nothing to translate.
 */
export async function notifyNewMessage(recipientId: string, senderName: string, preview: string) {
  await createNotification({
    userId: recipientId,
    type: 'new_message',
    title: `${senderName}`,
    message: preview.length > 80 ? preview.slice(0, 80) + '...' : preview,
    link: '/app/messages',
  });
}
