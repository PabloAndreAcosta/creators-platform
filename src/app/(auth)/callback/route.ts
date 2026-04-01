import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
        // Check if a pending role was set during OAuth signup
        const pendingRole = req.cookies.get("pending_role")?.value;
        const validRoles = ["creator", "experience", "customer"];

        if (pendingRole && validRoles.includes(pendingRole)) {
          // Update profile with the selected role
          const profileUpdate: Record<string, unknown> = { role: pendingRole };

          // Apply BankID verification data if present
          const bankidCookie = req.cookies.get("bankid_verified")?.value;
          if (bankidCookie) {
            const bankidData = verifyCookieValue<BankIdVerifiedData>(bankidCookie);
            if (bankidData) {
              profileUpdate.bankid_verified_at = bankidData.verifiedAt;
              profileUpdate.bankid_personal_number = bankidData.hashedNin;
              profileUpdate.bankid_name = bankidData.name;
            }
          }

          await supabase
            .from("profiles")
            .update(profileUpdate)
            .eq("id", user.id);
        }

        // Fetch the (possibly updated) role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        const role = pendingRole && validRoles.includes(pendingRole)
          ? pendingRole
          : profile?.role;

        // Clear the pending_role cookie
        const destination = "/app";
        // Validate `next` to prevent open redirect attacks
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
