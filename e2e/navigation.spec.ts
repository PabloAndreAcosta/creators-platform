import { test, expect } from "@playwright/test";
import { signIn } from "./helpers/session";
import { APP_DESTINATIONS } from "../src/lib/navigation/registry";

// Navigationen har gått sönder på två sätt i den här kodbasen, och båda var
// osynliga i enhetstester:
//
// 1. Sidor byggdes utan att någon meny länkade dit. Coverage-testet i
//    src/lib/navigation fångar det statiskt; här kontrolleras att rutterna
//    dessutom faktiskt svarar när man går till dem.
// 2. Menyn visade fel roll tills hydreringen hann ikapp, så en tryckning kunde
//    gå till fel sida. Det syns bara i serverrenderingen — därför testet med
//    avstängt JavaScript nedan.

test.describe("rollen är rätt redan i serverrenderingen", () => {
  test.use({ javaScriptEnabled: false });

  test("kreatörens sidomeny renderas utan att JavaScript kört", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!);
    await page.goto("/app");

    // Utan JS ser vi exakt vad servern skickade. Innan rollen seedades från
    // servern startade RoleProvider alltid på "customer", och de här länkarna
    // saknades här — kreatören fick kundens meny tills hydreringen bytte ut den.
    const sidebar = page.locator("aside");
    for (const href of ["/app/events", "/app/scan", "/app/courses"]) {
      await expect(
        sidebar.locator(`a[href="${href}"]`),
        `Sidomenyn saknar ${href} i serverrenderingen — rollflimret är tillbaka.`
      ).toHaveCount(1);
    }
  });

  test("bottennavet pekar inte kreatören mot marknadsplatsen", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!);
    await page.goto("/app");

    // Kundens Evenemang-flik går till /marketplace, kreatörens till /app/events.
    // Under flimret fick kreatören kundens flik och hamnade utanför appskalet.
    await expect(page.locator('nav a[href="/marketplace"]')).toHaveCount(0);
  });
});

test.describe("registrets destinationer svarar", () => {
  // Externa mål och rutter som kräver ett id testas inte här.
  const targets = APP_DESTINATIONS.filter(
    (d) => !d.external && !d.path.includes("[")
  );

  test(`alla ${targets.length} destinationer svarar`, async ({ context, baseURL }) => {
    // Dev-servern kompilerar varje rutt första gången den efterfrågas, så ett
    // svep över trettiotalet sidor tar minuter. Mot en byggd deploy går det på
    // sekunder.
    test.setTimeout(6 * 60 * 1000);
    await signIn(context, baseURL!);

    // Hämtar svaret utan att rendera sidan. Att navigera genom trettiotalet
    // rutter i en webbläsare mot dev-servern ger avbrutna navigeringar när
    // Next kompilerar on demand — det säger inget om rutten och gör testet
    // flakigt. Statuskoden är det vi faktiskt vill veta här; att sidorna
    // renderar utan fel täcks av hydreringstesterna.
    const broken: string[] = [];
    for (const dest of targets) {
      const response = await context.request.get(dest.path, { maxRedirects: 0 });
      const status = response.status();

      if (status >= 400) {
        broken.push(`${dest.path} → HTTP ${status}`);
        continue;
      }
      // En omdirigering till /login betyder att sidan inte är åtkomlig för den
      // inloggade rollen — precis den sortens tyst brutna ingång vi vill hitta.
      const location = response.headers()["location"] ?? "";
      if (location.includes("/login")) {
        broken.push(`${dest.path} → skickade till /login`);
      }
    }

    expect(broken, `Trasiga destinationer:\n${broken.join("\n")}`).toEqual([]);
  });
});
