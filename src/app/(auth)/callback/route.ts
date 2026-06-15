import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCookieValue } from "@/lib/signicat/crypto";
import type { BankIdVerifiedData } from "@/types/bankid";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const admin = createAdminClient();

        // 1. Apply pending role from OAuth signup (if present).
        //    Uses admin client because the privileged-columns trigger blocks
        //    role/tier/is_admin/bankid_* changes from user-context updates.
        const pendingRole = req.cookies.get("pending_role")?.value;
        const validRoles = ["creator", "venue", "customer"];
        if (pendingRole && validRoles.includes(pendingRole)) {
          await admin
            .from("profiles")
            .update({ role: pendingRole })
            .eq("id", user.id);
        }

        // 2. Apply BankID verification cookie if present — independent of
        //    pending_role so it works for existing-user merge logins too.
        const bankidCookie = req.cookies.get("bankid_verified")?.value;
        if (bankidCookie) {
          const bankidData = verifyCookieValue<BankIdVerifiedData>(bankidCookie);
          if (bankidData) {
            // Defense-in-depth dup check: another profile already claims this pno.
            const { data: dup } = await admin
              .from("profiles")
              .select("id")
              .eq("bankid_personal_number", bankidData.hashedNin)
              .neq("id", user.id)
              .maybeSingle();

            if (!dup) {
              const update: Record<string, unknown> = {
                bankid_verified_at: bankidData.verifiedAt,
                bankid_personal_number: bankidData.hashedNin,
                bankid_name: bankidData.name,
                role: bankidData.role,
              };
              if (bankidData.subcategory) {
                update.creator_subcategory = bankidData.subcategory;
              }
              await admin.from("profiles").update(update).eq("id", user.id);
            }
          }
        }

        const destination = "/app";
        const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
        const redirectUrl = safeNext || destination;
        const response = NextResponse.redirect(`${origin}${redirectUrl}`);
        response.cookies.set("pending_role", "", { path: "/", maxAge: 0 });
        response.cookies.set("bankid_verified", "", { path: "/", maxAge: 0 });
        return response;
      }

      return NextResponse.redirect(`${origin}/app`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
