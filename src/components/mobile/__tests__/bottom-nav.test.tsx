import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Bottenmenyns flikar styrs av roll och sökväg. Hookarna mockas så att
// komponenten kan renderas till HTML utan Next eller providers.
const state = vi.hoisted(() => ({
  pathname: "/app",
  role: "customer" as string,
  extraNavPaths: [] as string[],
}));

vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../role-context", () => ({
  useRole: () => ({ role: state.role, extraNavPaths: state.extraNavPaths }),
}));
vi.mock("@/lib/subscription/context", () => ({ useSubscription: () => ({ tier: "free" }) }));

import { BottomNav } from "../bottom-nav";

function hrefs(): string[] {
  const html = renderToStaticMarkup(<BottomNav />);
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
}

function activeHref(): string | undefined {
  const html = renderToStaticMarkup(<BottomNav />);
  // Varje <a> för sig, oavsett i vilken ordning attributen skrivs ut.
  const active = [...html.matchAll(/<a\b[^>]*>/g)]
    .map((m) => m[0])
    .find((tag) => /class="[^"]*\btext-\[var\(--usha-gold\)\]/.test(tag));
  return active?.match(/href="([^"]+)"/)?.[1];
}

describe("BottomNav – Evenemang-fliken", () => {
  beforeEach(() => {
    state.pathname = "/app";
    state.role = "customer";
    state.extraNavPaths = [];
  });

  it("publiken går till evenemangslistan, inte marknadsplatsen", () => {
    const h = hrefs();
    expect(h).toContain("/upplevelser");
    expect(h).not.toContain("/marketplace");
  });

  it("fliken markeras på evenemangslistan och dess undersidor", () => {
    state.pathname = "/upplevelser";
    expect(activeHref()).toBe("/upplevelser");
    state.pathname = "/upplevelser/stockholm";
    expect(activeHref()).toBe("/upplevelser");
  });

  it("värdar behåller sina egna evenemang", () => {
    state.role = "creator";
    const h = hrefs();
    expect(h).toContain("/app/events");
    expect(h).not.toContain("/upplevelser");
  });

  it("publik med lokalteamets evenemangsrätt får värdfliken", () => {
    state.extraNavPaths = ["/app/events"];
    expect(hrefs()).toContain("/app/events");
  });
});
