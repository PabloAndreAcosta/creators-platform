import { defineConfig, devices } from "@playwright/test";

// End-to-end-tester som körs i en riktig webbläsare.
//
// Poängen är det vitest inte kan se: hydreringsfel, konsolfel och vad som
// faktiskt renderas efter att JavaScript har kört. Flera buggar den här
// kodbasen haft — rollflimret, den försvunna menyn — var osynliga i
// serverrenderad HTML och syntes först i webbläsaren.
//
// VIKTIGT: testerna loggar in mot den RIKTIGA databasen med service-role och
// ett befintligt konto. De är därför avsiktligt LÄSANDE — de klickar aldrig på
// något som skapar bokningar, skickar mejl eller rör pengar. Lägg inte till
// sådana test här utan en separat testdatabas.
//
// Körs inte i CI: de kräver .env.local med service-role-nyckeln, som inte
// finns där (och inte bör finnas).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "sv-SE",
    timezoneId: "Europe/Stockholm",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],

  // Startar dev-servern automatiskt vid lokal körning. Pekar E2E_BASE_URL på en
  // deploy körs testerna mot den i stället, utan lokal server.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
