export type GageStatus = "proposed" | "agreed" | "paid" | "canceled";
export type GageProposedBy = "host" | "crew";

export interface GageAgreement {
  id: string;
  listing_id: string;
  host_id: string;
  collaborator_user_id: string;
  amount_ore: number;
  proposed_by: GageProposedBy;
  status: GageStatus;
  note: string | null;
  created_at: string;
  agreed_at: string | null;
  paid_at: string | null;
}

export const GAGE_MIN_SEK = 10;
export const GAGE_MAX_SEK = 100000;

export function gageKr(amountOre: number): string {
  return `${Math.round(amountOre / 100).toLocaleString("sv-SE")} kr`;
}

export function gageStatusLabel(status: GageStatus): string {
  switch (status) {
    case "proposed":
      return "Föreslaget";
    case "agreed":
      return "Överenskommet";
    case "paid":
      return "Betald";
    case "canceled":
      return "Avbrutet";
  }
}
