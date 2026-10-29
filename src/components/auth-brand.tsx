/**
 * Loggan överst på inloggning och registrering: logotypen med ordet USHA ur
 * brandpaketet (usha-logotyper/logotyp). Riktlinjen: USHA_USHA_gradient där
 * namnet ska synas, nattläget som standard, _dag på ljust underlag.
 *
 * Som <img src> och inte inline: brandfilernas SVG:er delar gradient-ID, och
 * inline på samma sida ritar den ena med den andras gradient.
 */
export function AuthBrand() {
  return (
    <div className="mb-6 flex justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- statisk SVG, ingen optimering att vinna */}
      <img src="/brand/USHA_USHA_gradient_dag.svg" alt="Usha" width={107} height={100} className="h-24 w-auto dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element -- statisk SVG, ingen optimering att vinna */}
      <img src="/brand/USHA_USHA_gradient.svg" alt="Usha" width={107} height={100} className="hidden h-24 w-auto dark:block" />
    </div>
  );
}
