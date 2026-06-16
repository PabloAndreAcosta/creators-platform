import { Building2, ShieldAlert } from "lucide-react";
import { CompanyVerifyForm } from "./company-verify-form";

interface Props {
  companyVerifiedAt: string | null;
  companyName: string | null;
  orgNumber: string | null;
}

/** Org-nr (company) verification status for venues. Primary marketplace gate
 *  for venues; BankID is optional and handled separately. */
export function CompanyStatus({ companyVerifiedAt, companyName, orgNumber }: Props) {
  if (companyVerifiedAt) {
    const formatted = new Date(companyVerifiedAt).toLocaleDateString("sv-SE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return (
      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
            <Building2 size={24} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-blue-400">Bolag verifierat</h2>
            <p className="mt-1 text-sm text-[var(--usha-muted)]">
              {companyName ? (
                <>
                  <span className="text-[var(--usha-white)]">{companyName}</span>
                  {orgNumber ? ` (${orgNumber})` : ""} verifierades {formatted}.
                </>
              ) : (
                <>Verifierat {formatted}.</>
              )}
            </p>
            <p className="mt-2 text-xs text-[var(--usha-muted)]">
              Du visas med badgen ”Verifierat bolag” på marknadsplatsen.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-amber-500/60 bg-amber-500/10 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
          <ShieldAlert size={24} className="text-amber-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-amber-400">Verifiera ditt bolag</h2>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            Ange ditt organisationsnummer för att synas på marknadsplatsen. Vi verifierar mot
            EU:s företagsregister (VIES). Mobilt BankID är frivilligt och ger en extra badge.
          </p>
          <CompanyVerifyForm />
        </div>
      </div>
    </div>
  );
}
