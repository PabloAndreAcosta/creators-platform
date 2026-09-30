import { describe, it, expect } from "vitest";
import { benefitKeys } from "../plan-benefits";
import { PLANS, getPlanList } from "@/lib/stripe/config";
import { readFileSync } from "fs";
import { join } from "path";

const LOCALES = ["sv", "en", "es"] as const;

describe("nivåernas förmåner hänger ihop med koden", () => {
  it("varje köpbar nivå har en förmånslista lika lång som PLANS", () => {
    // Faller den här har någon lagt till en förmån i config.ts utan att skriva
    // den på landningssidan — och då säger mejlet och sidan olika saker.
    for (const { key } of getPlanList()) {
      expect(benefitKeys(key).length, key).toBe(PLANS[key].features.length);
    }
  });

  it("avvecklade nivåer har ingen lista", () => {
    for (const key of Object.keys(PLANS) as (keyof typeof PLANS)[]) {
      if (!PLANS[key].retired) continue;
      expect(benefitKeys(key), key).toEqual([]);
    }
  });

  it("nycklarna finns i alla tre språk", () => {
    for (const l of LOCALES) {
      const m = JSON.parse(readFileSync(join(process.cwd(), `src/i18n/messages/${l}.json`), "utf8"));
      for (const { key } of getPlanList()) {
        for (const nyckel of benefitKeys(key)) {
          expect(m.landing.pricing[nyckel], `${l}.json saknar ${nyckel}`).toBeTruthy();
        }
      }
    }
  });
});
