/** What Stripe reports about a Connect account, as the status route returns it. */
export interface ConnectStatusFlags {
  connected?: boolean;
  payoutsEnabled?: boolean;
  cardPaymentsEnabled?: boolean;
}

/**
 * Whether a seller's Connect setup is finished.
 *
 * `card_payments` is part of the definition, not an extra. Checkout reads that
 * capability to decide whether the organizer becomes merchant of record, and
 * the onboarding checklist reads it to decide whether the Stripe step is done.
 * A status card that called an account complete without it would report "all
 * set" while the checklist still asked for the step — and, since the card hides
 * its own guide once complete, would hide the only button that could grant it.
 */
export function isConnectComplete(status: ConnectStatusFlags | null | undefined): boolean {
  return !!status?.connected && !!status?.payoutsEnabled && !!status?.cardPaymentsEnabled;
}
