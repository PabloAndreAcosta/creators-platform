"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/toaster";

/**
 * Surfaces the `?bankid=<status>` outcome that the BankID callback
 * (`/api/auth/bankid/callback`) redirects back with. Without this the page
 * just reloads unchanged — which makes a blocked verification (e.g. the
 * personal number already sitting on another account → `duplicate`) look like
 * nothing happened at all.
 */
export function BankIdResultToast() {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    const status = searchParams.get("bankid");
    if (!status || handled.current) return;
    handled.current = true;

    switch (status) {
      case "success":
        toast.success("BankID verifierat", "Din identitet är bekräftad.");
        break;
      case "duplicate":
        toast.error(
          "Personnumret är redan registrerat",
          "Det här personnumret är kopplat till ett annat konto. Ett personnummer kan bara verifiera ett konto."
        );
        break;
      case "aborted":
        toast.info("BankID avbröts", "Verifieringen avbröts. Försök igen när du vill.");
        break;
      case "age_restricted":
        toast.error("Åldersgräns", "Du måste vara minst 18 år för den här rollen.");
        break;
      case "unauthenticated":
        toast.error("Inte inloggad", "Logga in och försök igen.");
        break;
      case "failed":
      case "error":
      default:
        toast.error("BankID misslyckades", "Något gick fel. Försök igen.");
        break;
    }

    // Strip the param so a refresh doesn't re-fire the toast.
    router.replace(pathname, { scroll: false });
  }, [searchParams, toast, router, pathname]);

  return null;
}
