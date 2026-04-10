import { createAdminClient } from '@/lib/supabase/admin';
import { getServerTranslation } from '@/lib/i18n/server';
import type { Locale } from '@/i18n/config';

interface CreateNotificationParams {
  userId: string;
  type: 'booking_new' | 'booking_confirmed' | 'booking_canceled' | 'payout' | 'review' | 'queue_promoted' | 'new_post' | 'new_message';
  title: string;
  message: string;
  link?: string;
}

/**
 * Creates an in-app notification for a user.
 * Uses admin client so it can be called from server actions and API routes
 * without needing the user's session.
 */
export async function createNotification(params: CreateNotificationParams) {
  const supabase = createAdminClient();

  const { error } = await supabase.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link ?? null,
  });

  if (error) {
    console.error('Failed to create notification:', error);
  }
}

// Helper to get user's preferred locale (defaults to 'sv')
async function getUserLocale(userId: string): Promise<Locale> {
  // For now, default to 'sv'. In the future, read from profiles.locale column.
  return 'sv';
}

const ns = 'serverNotifications';

/**
 * Notify a creator about a new booking.
 */
export async function notifyNewBooking(creatorId: string, customerName: string, serviceName: string) {
  const locale = await getUserLocale(creatorId);
  const title = await getServerTranslation(ns, 'newBookingTitle', locale);
  const message = await getServerTranslation(ns, 'newBookingMsg', locale, { customer: customerName, service: serviceName });

  await createNotification({
    userId: creatorId,
    type: 'booking_new',
    title,
    message,
    link: '/dashboard/bookings',
  });
}

/**
 * Notify a customer that their booking was confirmed.
 */
export async function notifyBookingConfirmed(customerId: string, serviceName: string) {
  const locale = await getUserLocale(customerId);
  const title = await getServerTranslation(ns, 'bookingConfirmedTitle', locale);
  const message = await getServerTranslation(ns, 'bookingConfirmedMsg', locale, { service: serviceName });

  await createNotification({
    userId: customerId,
    type: 'booking_confirmed',
    title,
    message,
    link: '/dashboard/bookings',
  });
}

/**
 * Notify a user that their booking was canceled.
 */
export async function notifyBookingCanceled(userId: string, serviceName: string) {
  const locale = await getUserLocale(userId);
  const title = await getServerTranslation(ns, 'bookingCanceledTitle', locale);
  const message = await getServerTranslation(ns, 'bookingCanceledMsg', locale, { service: serviceName });

  await createNotification({
    userId,
    type: 'booking_canceled',
    title,
    message,
    link: '/dashboard/bookings',
  });
}

/**
 * Notify a creator about a payout.
 */
export async function notifyPayout(creatorId: string, amount: number, type: 'batch' | 'instant') {
  const locale = await getUserLocale(creatorId);
  const title = await getServerTranslation(
    ns,
    type === 'instant' ? 'instantPayoutTitle' : 'payoutTitle',
    locale
  );
  const message = await getServerTranslation(ns, 'payoutMsg', locale, {
    amount: amount.toLocaleString('sv-SE'),
  });

  await createNotification({
    userId: creatorId,
    type: 'payout',
    title,
    message,
    link: '/dashboard/payouts',
  });
}

/**
 * Notify a creator about a new review.
 */
export async function notifyNewReview(creatorId: string, reviewerName: string, rating: number) {
  const locale = await getUserLocale(creatorId);
  const title = await getServerTranslation(ns, 'newReviewTitle', locale);
  const message = await getServerTranslation(ns, 'newReviewMsg', locale, {
    reviewer: reviewerName,
    rating,
  });

  await createNotification({
    userId: creatorId,
    type: 'review',
    title,
    message,
    link: '/app/profile',
  });
}

/**
 * Notify a user that they've been promoted from the queue.
 */
export async function notifyQueuePromoted(userId: string, serviceName: string) {
  const locale = await getUserLocale(userId);
  const title = await getServerTranslation(ns, 'queuePromotedTitle', locale);
  const message = await getServerTranslation(ns, 'queuePromotedMsg', locale, { service: serviceName });

  await createNotification({
    userId,
    type: 'queue_promoted',
    title,
    message,
    link: '/app',
  });
}

/**
 * Notify a user about a new message.
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
