import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
const profileLookupMock = vi.fn();
const dupCheckMock = vi.fn();
const adminUpdateMock = vi.fn();
const subcategoryRevertMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (_table: string) => ({
      select: (cols: string) => {
        if (cols === "creator_subcategory") {
          return { eq: () => ({ maybeSingle: profileLookupMock }) };
        }
        return {
          eq: () => ({
            neq: () => ({ maybeSingle: dupCheckMock }),
          }),
        };
      },
      update: (payload: Record<string, unknown>) => {
        const isSubcategoryRevert =
          Object.keys(payload).length === 1 && payload.creator_subcategory === "general";
        return {
          eq: (_col: string, _val: string) =>
            isSubcategoryRevert
              ? subcategoryRevertMock(payload)
              : adminUpdateMock(payload),
        };
      },
    }),
  }),
}));

vi.mock("@/lib/signicat/crypto", () => ({
  verifyCookieValue: vi.fn(),
}));

import { verifyCookieValue } from "@/lib/signicat/crypto";
import { POST } from "../route";

const verifyCookieValueMock = verifyCookieValue as unknown as ReturnType<typeof vi.fn>;

function makeRequest(cookieValue?: string) {
  const headers = new Headers();
  if (cookieValue !== undefined) {
    headers.set("cookie", `bankid_verified=${cookieValue}`);
  }
  return new NextRequest("https://usha.se/api/auth/signup/apply-verification", {
    method: "POST",
    headers,
  });
}

const validVerifiedData = {
  name: "Anna Andersson",
  firstName: "Anna",
  lastName: "Andersson",
  dateOfBirth: "1990-01-01",
  hashedNin: "real-hashed-nin",
  verifiedAt: "2026-04-21T10:00:00.000Z",
  role: "creator" as const,
};

beforeEach(() => {
  getUserMock.mockReset();
  profileLookupMock.mockReset();
  dupCheckMock.mockReset();
  adminUpdateMock.mockReset();
  subcategoryRevertMock.mockReset();
  verifyCookieValueMock.mockReset();

  // Default: profile is not taxi_dancer, so age gate is skipped
  profileLookupMock.mockResolvedValue({ data: { creator_subcategory: "general" } });
});

describe("POST /api/auth/signup/apply-verification", () => {
  it("returns 401 when user is not authenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeRequest("some-cookie"));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Inte autentiserad" });
    expect(verifyCookieValueMock).not.toHaveBeenCalled();
    expect(adminUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 400 when bankid_verified cookie is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const res = await POST(makeRequest());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Ingen BankID-verifiering hittad" });
    expect(verifyCookieValueMock).not.toHaveBeenCalled();
    expect(adminUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 400 when cookie signature is invalid (forged/tampered)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    verifyCookieValueMock.mockReturnValue(null);

    const res = await POST(makeRequest("tampered.signature"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Ogiltig verifieringsdata" });
    expect(adminUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 409 and clears cookie when personal number already registered to another user", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    verifyCookieValueMock.mockReturnValue(validVerifiedData);
    dupCheckMock.mockResolvedValue({ data: { id: "other-user" } });

    const res = await POST(makeRequest("signed-cookie"));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Personnummer redan registrerat" });
    expect(adminUpdateMock).not.toHaveBeenCalled();
    expect(res.cookies.get("bankid_verified")?.value).toBe("");
    expect(res.cookies.get("bankid_verified")?.maxAge).toBe(0);
  });

  it("returns 500 when profile update fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    verifyCookieValueMock.mockReturnValue(validVerifiedData);
    dupCheckMock.mockResolvedValue({ data: null });
    adminUpdateMock.mockResolvedValue({ error: { message: "db exploded" } });

    const res = await POST(makeRequest("signed-cookie"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Kunde inte spara verifiering" });
  });

  it("writes profile fields from the signed cookie only, not from any other source", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    verifyCookieValueMock.mockReturnValue(validVerifiedData);
    dupCheckMock.mockResolvedValue({ data: null });
    adminUpdateMock.mockResolvedValue({ error: null });

    const res = await POST(makeRequest("signed-cookie"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(adminUpdateMock).toHaveBeenCalledTimes(1);
    // Only BankID identity fields are written — never role (set at signup).
    expect(adminUpdateMock).toHaveBeenCalledWith({
      bankid_verified_at: validVerifiedData.verifiedAt,
      bankid_personal_number: validVerifiedData.hashedNin,
      bankid_name: validVerifiedData.name,
    });
    expect(res.cookies.get("bankid_verified")?.value).toBe("");
    expect(res.cookies.get("bankid_verified")?.maxAge).toBe(0);
  });

  it("ignores forged bankid fields on the request body / elsewhere — only cookie payload reaches the db", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    verifyCookieValueMock.mockReturnValue(validVerifiedData);
    dupCheckMock.mockResolvedValue({ data: null });
    adminUpdateMock.mockResolvedValue({ error: null });

    const forgedBody = JSON.stringify({
      bankid_personal_number: "attacker-supplied-hash",
      bankid_name: "Attacker Namn",
      bankid_verified_at: "1999-01-01T00:00:00.000Z",
      role: "venue",
    });

    const req = new NextRequest("https://usha.se/api/auth/signup/apply-verification", {
      method: "POST",
      headers: {
        cookie: "bankid_verified=signed-cookie",
        "content-type": "application/json",
      },
      body: forgedBody,
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    const updateArg = adminUpdateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.bankid_personal_number).toBe(validVerifiedData.hashedNin);
    expect(updateArg.bankid_name).toBe(validVerifiedData.name);
    expect(updateArg.bankid_verified_at).toBe(validVerifiedData.verifiedAt);
    // role is never written by this route — not from the cookie, not from the body
    expect(updateArg.role).toBeUndefined();
    expect(updateArg.bankid_personal_number).not.toBe("attacker-supplied-hash");
  });

  it("does not verify cookie signature when no user is authenticated (fail-fast)", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    await POST(makeRequest("signed-cookie"));

    expect(verifyCookieValueMock).not.toHaveBeenCalled();
  });

  it("rejects with 403 and reverts subcategory when taxi_dancer profile is under 18", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    verifyCookieValueMock.mockReturnValue({
      ...validVerifiedData,
      dateOfBirth: "2010-06-15", // ~15 years old in 2026
    });
    profileLookupMock.mockResolvedValue({ data: { creator_subcategory: "taxi_dancer" } });

    const res = await POST(makeRequest("signed-cookie"));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Du måste vara minst 18 år för att registrera dig som taxidansare",
    });
    expect(subcategoryRevertMock).toHaveBeenCalledWith({ creator_subcategory: "general" });
    expect(adminUpdateMock).not.toHaveBeenCalled();
    expect(dupCheckMock).not.toHaveBeenCalled();
    expect(res.cookies.get("bankid_verified")?.value).toBe("");
  });

  it("allows taxi_dancer profile when age is exactly 18", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    verifyCookieValueMock.mockReturnValue({
      ...validVerifiedData,
      dateOfBirth: "2008-01-01", // 18 in 2026
    });
    profileLookupMock.mockResolvedValue({ data: { creator_subcategory: "taxi_dancer" } });
    dupCheckMock.mockResolvedValue({ data: null });
    adminUpdateMock.mockResolvedValue({ error: null });

    const res = await POST(makeRequest("signed-cookie"));

    expect(res.status).toBe(200);
    expect(subcategoryRevertMock).not.toHaveBeenCalled();
    expect(adminUpdateMock).toHaveBeenCalledTimes(1);
  });

  it("does not run age gate for non-taxi_dancer profiles even when DOB indicates < 18", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    verifyCookieValueMock.mockReturnValue({
      ...validVerifiedData,
      dateOfBirth: "2010-06-15",
    });
    profileLookupMock.mockResolvedValue({ data: { creator_subcategory: "general" } });
    dupCheckMock.mockResolvedValue({ data: null });
    adminUpdateMock.mockResolvedValue({ error: null });

    const res = await POST(makeRequest("signed-cookie"));

    expect(res.status).toBe(200);
    expect(subcategoryRevertMock).not.toHaveBeenCalled();
  });
});
