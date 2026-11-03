import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const dateOfBirth = vi.hoisted(() => ({ value: "1990-01-01" }));
const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/signicat/client", () => ({
  getBankIdSessionResult: async () => ({
    status: "SUCCESS",
    subject: { firstName: "A", lastName: "B", name: "A B", dateOfBirth: dateOfBirth.value, nin: { value: "199001011234" } },
  }),
}));
vi.mock("@/lib/signicat/crypto", () => ({
  verifyCookieValue: () => ({ sessionId: "s1", mode: "games", ret: "/spel/?kod=ABCDE" }),
  signCookieValue: () => "signed",
  hashPersonalNumber: () => "hash",
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { GET } from "../route";

const req = (status = "success") =>
  new NextRequest(`https://usha.se/api/auth/bankid/callback?status=${status}`, { headers: { cookie: "bankid_session=x" } });

describe("BankID-callback, vuxenspelen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://usha.se";
    process.env.GAMES_AGE_SECRET = "hemligt";
    dateOfBirth.value = "1990-01-01";
  });

  it("skickar en vuxen tillbaka till spelet med ett bevis, utan att röra databasen", async () => {
    const res = await GET(req());
    expect(res.headers.get("location")).toMatch(/^https:\/\/ushagames\.se\/spel\/\?kod=ABCDE#legitimering=[\w-]+\.[\w-]+$/);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(res.cookies.get("bankid_session")?.value).toBe("");
  });

  it("släpper inte in den som är under 18", async () => {
    const y = new Date().getFullYear() - 17;
    dateOfBirth.value = `${y}-01-01`;
    const res = await GET(req());
    expect(res.headers.get("location")).toBe("https://ushagames.se/spel/?kod=ABCDE#legitimering-fel=under18");
  });

  it("säger avbrutet när BankID avbryts", async () => {
    const res = await GET(req("abort"));
    expect(res.headers.get("location")).toBe("https://ushagames.se/spel/?kod=ABCDE#legitimering-fel=avbrutet");
  });

  it("ger inget bevis utan hemlighet", async () => {
    delete process.env.GAMES_AGE_SECRET;
    const res = await GET(req());
    expect(res.headers.get("location")).toBe("https://ushagames.se/spel/?kod=ABCDE#legitimering-fel=fel");
  });
});
