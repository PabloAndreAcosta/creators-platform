import { createAdminClient } from '@/lib/supabase/admin';

interface CreateNotificationParams {
  userId: string;
  type: 'booking_new' | 'booking_confirmed' | 'booking_canceled' | 'payout' | 'review' | 'queue_promoted' | 'new_post';
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

/**
 * Notify a creator about a new booking.
 */
export async function notifyNewBooking(creatorId: string, customerName: string, serviceName: string) {
  await createNotification({
    userId: creatorId,
    type: 'booking_new',
    title: 'Ny bokning',
    message: `${customerName} har bokat "${serviceName}"`,
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
    title: 'Bokning bekräftad',
    message: `Din bokning för "${serviceName}" har bekräftats`,
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
    title: 'Bokning avbokad',
    message: `Bokningen för "${serviceName}" har avbokats`,
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
    title: type === 'instant' ? 'Direktutbetalning' : 'Utbetalning',
    message: `${amount.toLocaleString('sv-SE')} kr har betalats ut till ditt konto`,
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
    title: 'Ny recension',
    message: `${reviewerName} gav dig ${rating}/5 stjärnor`,
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
    title: 'Din tur i kön!',
    message: `En plats har öppnats för "${serviceName}" — boka nu!`,
    link: '/app',
  });
}
