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
          tier: string | null;
          stripe_account_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at" | "is_public" | "tier"> & {
          is_public?: boolean;
          tier?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          plan: "basic" | "premium" | "enterprise" | "creator_gold" | "creator_platinum";
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
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["bookings"]["Row"], "id" | "created_at" | "updated_at" | "status"> & {
          id?: string;
          status?: "pending" | "confirmed" | "completed" | "canceled";
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Insert"]>;
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
          status: "pending" | "processing" | "completed" | "failed";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["payouts"]["Row"], "id" | "created_at" | "updated_at" | "status"> & {
          id?: string;
          status?: "pending" | "processing" | "completed" | "failed";
        };
        Update: Partial<Database["public"]["Tables"]["payouts"]["Insert"]>;
      };
    };
  };
}
