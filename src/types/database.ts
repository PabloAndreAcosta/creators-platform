export type MemberTier = 'gratis' | 'guld' | 'premium';
export type MemberRole = 'publik' | 'kreator' | 'upplevelse';
export type PlanKey =
  | 'publik_guld' | 'publik_premium'
  | 'kreator_guld' | 'kreator_premium'
  | 'upplevelse_guld' | 'upplevelse_premium';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          website: string | null;
          category: string | null;
          location: string | null;
          hourly_rate: number | null;
          is_public: boolean;
          tier: MemberTier | null;
          role: MemberRole;
          stripe_account_id: string | null;
          calendar_sync_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at" | "is_public" | "tier" | "role"> & {
          is_public?: boolean;
          tier?: MemberTier | null;
          role?: MemberRole;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          plan: PlanKey;
          status: "active" | "canceled" | "past_due" | "trialing";
          current_period_start: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["subscriptions"]["Row"], "id" | "created_at" | "updated_at" | "status"> & {
          id?: string;
          status?: "active" | "canceled" | "past_due" | "trialing";
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          stripe_payment_id: string | null;
          amount: number;
          currency: string;
          status: "succeeded" | "pending" | "failed";
          description: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["payments"]["Row"], "id" | "created_at" | "currency"> & {
          id?: string;
          currency?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
      };
      listings: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          category: string;
          price: number | null;
          duration_minutes: number | null;
          is_active: boolean;
          event_tier: string | null;
          event_date: string | null;
          event_time: string | null;
          event_location: string | null;
          release_to_gold_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["listings"]["Row"], "id" | "created_at" | "updated_at" | "is_active"> & {
          id?: string;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["listings"]["Insert"]>;
      };
      bookings: {
        Row: {
          id: string;
          listing_id: string;
          creator_id: string;
          customer_id: string;
          status: "pending" | "confirmed" | "completed" | "canceled";
          scheduled_at: string;
          notes: string | null;
          stripe_payment_id: string | null;
          amount_paid: number | null;
          booking_type: "manual" | "ticket";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["bookings"]["Row"], "id" | "created_at" | "updated_at" | "status" | "booking_type"> & {
          id?: string;
          status?: "pending" | "confirmed" | "completed" | "canceled";
          booking_type?: "manual" | "ticket";
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Insert"]>;
      };
      promo_codes: {
        Row: {
          id: string;
          code: string;
          description: string | null;
          discount_type: "percent" | "fixed";
          discount_value: number;
          scope: "subscription" | "ticket" | "both";
          allowed_plans: string[] | null;
          max_uses: number | null;
          current_uses: number;
          max_uses_per_user: number;
          valid_from: string;
          valid_until: string | null;
          is_active: boolean;
          stripe_coupon_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["promo_codes"]["Row"], "id" | "created_at" | "updated_at" | "current_uses" | "is_active" | "max_uses_per_user"> & {
          id?: string;
          current_uses?: number;
          is_active?: boolean;
          max_uses_per_user?: number;
        };
        Update: Partial<Database["public"]["Tables"]["promo_codes"]["Insert"]>;
      };
      promo_code_uses: {
        Row: {
          id: string;
          promo_code_id: string;
          user_id: string;
          used_for: "subscription" | "ticket";
          reference_id: string | null;
          discount_amount: number | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["promo_code_uses"]["Row"], "id" | "created_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["promo_code_uses"]["Insert"]>;
      };
      payouts: {
        Row: {
          id: string;
          creator_id: string;
          amount_gross: number;
          amount_commission: number;
          amount_net: number;
          payout_type: "batch" | "instant";
          stripe_payout_id: string | null;
          status: "pending" | "in_transit" | "paid" | "failed";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["payouts"]["Row"], "id" | "created_at" | "updated_at" | "status"> & {
          id?: string;
          status?: "pending" | "in_transit" | "paid" | "failed";
        };
        Update: Partial<Database["public"]["Tables"]["payouts"]["Insert"]>;
      };
    };
  };
}
