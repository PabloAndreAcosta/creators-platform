export interface BankIdVerifiedData {
  name: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  hashedNin: string;
  verifiedAt: string;
  role: "creator" | "venue" | "customer";
  subcategory?: "general" | "taxi_dancer";
}

export interface SignicatSession {
  id: string;
  authenticationUrl: string;
  status: string;
}

export interface SignicatSessionResult {
  status: "SUCCESS" | "ABORT" | "ERROR" | "EXPIRED" | string;
  subject?: {
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    dateOfBirth: string;
    /** Saknas för Freja-användare med pass utan nationellt ID-nummer. */
    nin?: {
      value: string;
      issuingCountry: string;
      type: string;
    };
  };
}
