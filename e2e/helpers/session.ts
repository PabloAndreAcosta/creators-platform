import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { BrowserContext, Cookie } from "@playwright/test";

// Loggar in en testkörning utan lösenord.
//
// Supabase admin mintar en magic link, engångskoden växlas in till en session,
// och sessionen skrivs som den SSR-cookie appen själv läser. Det är samma
// mekanism som @supabase/ssr använder, inklusive att långa värden delas i
// .0/.1-chunkar — utan chunkningen tappas cookien tyst och sidan renderas som
// utloggad.

const CHUNK_SIZE = 3180;

function readEnvLocal(): Record<string, string> {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) {
    throw new Error(
      ".env.local saknas. E2E-testerna behöver NEXT_PUBLIC_SUPABASE_URL, " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY och SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const i = line.indexOf("=");
        return [
          line.slice(0, i).trim(),
          line.slice(i + 1).trim().replace(/^["']|["']$/g, ""),
        ];
      })
  );
}

export interface TestUser {
  email: string;
  /** Rollen kontot har i databasen, för test som beror på den. */
  role: string;
}

/** Kontot testerna loggar in som. Läsande test — inget skrivs. */
export const TEST_USER: TestUser = {
  email: process.env.E2E_EMAIL ?? "pablo.acosta@usha.se",
  role: "creator",
};

export async function signIn(context: BrowserContext, baseURL: string): Promise<void> {
  const env = readEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey || !anonKey) {
    throw new Error("Saknar Supabase-nycklar i .env.local för E2E-inloggning.");
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: TEST_USER.email,
  });
  if (linkError) throw linkError;

  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: session, error: otpError } = await anon.auth.verifyOtp({
    email: TEST_USER.email,
    token: link.properties.email_otp,
    type: "email",
  });
  if (otpError) throw otpError;
  if (!session.session) throw new Error("Ingen session returnerades vid inloggning.");

  const projectRef = url.match(/https:\/\/([^.]+)\./)?.[1];
  if (!projectRef) throw new Error(`Kunde inte läsa projekt-ref ur ${url}`);

  const payload = JSON.stringify({
    access_token: session.session.access_token,
    refresh_token: session.session.refresh_token,
    expires_at: session.session.expires_at,
    token_type: "bearer",
    user: session.user,
  });
  const value = "base64-" + Buffer.from(payload).toString("base64");

  const domain = new URL(baseURL).hostname;
  const base = {
    domain,
    path: "/",
    httpOnly: false,
    secure: baseURL.startsWith("https"),
    sameSite: "Lax" as const,
  };

  const cookies: Cookie[] = [];
  if (value.length > CHUNK_SIZE) {
    for (let i = 0, n = 0; i < value.length; i += CHUNK_SIZE, n++) {
      cookies.push({
        name: `sb-${projectRef}-auth-token.${n}`,
        value: value.slice(i, i + CHUNK_SIZE),
        expires: -1,
        ...base,
      });
    }
  } else {
    cookies.push({
      name: `sb-${projectRef}-auth-token`,
      value,
      expires: -1,
      ...base,
    });
  }

  await context.addCookies(cookies);
}
