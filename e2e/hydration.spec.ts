import { test, expect } from "@playwright/test";
import { signIn } from "./helpers/session";
import { collectConsole, meaningfulErrors } from "./helpers/console";

// Hydreringsfel syns bara i en webbläsare. Serverrenderad HTML kan se helt
// korrekt ut medan React kastar hela markupen och ritar om på klienten, vilket
// ger hopp i gränssnittet och tappade interaktioner. Vitest kan inte se det
// här, och det var därför flera navigationsbuggar levde vidare oupptäckta.

const PAGES = [
  { path: "/app", name: "appens startsida" },
  { path: "/app/tools", name: "Mer-griden" },
  { path: "/app/profile", name: "profilen" },
  { path: "/app/settings/connections", name: "kopplingar" },
  { path: "/app/events", name: "eventlistan" },
  { path: "/app/tickets", name: "biljetter" },
];

test.describe("inga hydreringsfel i appen", () => {
  for (const { path, name } of PAGES) {
    test(`${name} (${path})`, async ({ page, context, baseURL }) => {
      await signIn(context, baseURL!);
      const collected = collectConsole(page);

      await page.goto(path, { waitUntil: "networkidle" });
      // Hydreringen sker efter first paint; ge React tid att klaga.
      await page.waitForTimeout(1500);

      expect(
        collected.hydration,
        `Hydreringsfel på ${path}:\n${collected.hydration.join("\n")}`
      ).toEqual([]);

      const errors = meaningfulErrors(collected);
      expect(errors, `Konsolfel på ${path}:\n${errors.join("\n")}`).toEqual([]);
    });
  }
});

test.describe("publika sidor", () => {
  for (const path of ["/", "/om", "/upplevelser"]) {
    test(`utan inloggning: ${path}`, async ({ page }) => {
      const collected = collectConsole(page);
      await page.goto(path, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);

      expect(
        collected.hydration,
        `Hydreringsfel på ${path}:\n${collected.hydration.join("\n")}`
      ).toEqual([]);
    });
  }
});
