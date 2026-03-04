import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
          await supabase
            .from("profiles")
            .update({ role: pendingRole })
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
        const destination = (!role || role === "customer") ? "/app" : "/dashboard";
        const redirectUrl = next || destination;
        const response = NextResponse.redirect(`${origin}${redirectUrl}`);
        response.cookies.set("pending_role", "", { path: "/", maxAge: 0 });
        return response;
      }

      return NextResponse.redirect(`${origin}/app`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
