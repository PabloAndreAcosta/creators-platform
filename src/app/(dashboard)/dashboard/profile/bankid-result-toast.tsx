"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("bankidToast");
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
        toast.success(t("successTitle"), t("successMessage"));
        break;
      case "duplicate":
        toast.error(t("duplicateTitle"), t("duplicateMessage"));
        break;
      case "aborted":
        toast.info(t("abortedTitle"), t("abortedMessage"));
        break;
      case "age_restricted":
        toast.error(t("ageRestrictedTitle"), t("ageRestrictedMessage"));
        break;
      case "unauthenticated":
        toast.error(t("unauthenticatedTitle"), t("unauthenticatedMessage"));
        break;
      case "failed":
      case "error":
      default:
        toast.error(t("failedTitle"), t("failedMessage"));
        break;
    }

    // Strip the param so a refresh doesn't re-fire the toast.
    router.replace(pathname, { scroll: false });
  }, [searchParams, toast, router, pathname, t]);

  return null;
}
