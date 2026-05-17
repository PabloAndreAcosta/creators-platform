"use client";

import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";

interface Props {
  userRole: "kreator" | "upplevelse";
}

const COMMISSION = {
  gratis: 0.15,
  guld: 0.08,
  premium: 0.03,
} as const;

const PRICE = {
  gratis: 0,
  guld: 299,
  premium: 599,
} as const;

const STEP = 500;
const MIN = 0;
const MAX = 20000;

function fmt(n: number) {
  return Math.round(n).toLocaleString("sv-SE");
}

export function BreakEvenCalculator({ userRole }: Props) {
  const [volume, setVolume] = useState(5000);

  const cost = useMemo(
    () => ({
      gratis: volume * COMMISSION.gratis + PRICE.gratis,
      guld: volume * COMMISSION.guld + PRICE.guld,
      premium: volume * COMMISSION.premium + PRICE.premium,
    }),
    [volume]
  );

  // Net to you = volume minus what Usha takes (commission + subscription)
  const net = {
    gratis: volume - cost.gratis,
    guld: volume - cost.guld,
    premium: volume - cost.premium,
  };

  const bestTier =
    net.premium >= net.guld && net.premium >= net.gratis
      ? "premium"
      : net.guld >= net.gratis
        ? "guld"
        : "gratis";

  const noun = userRole === "kreator" ? "tjänster" : "events";

  return (
    <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--usha-gold)]/10">
          <TrendingUp size={20} className="text-[var(--usha-gold)]" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Räkna ut vilken plan som lönar sig</h2>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            Hur mycket säljer du för i {noun} per månad? Vi visar vad du får
            kvar efter Ushas kommission och eventuellt abonnemang.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <label htmlFor="volume" className="text-sm text-[var(--usha-muted)]">
            Månadsvolym
          </label>
          <span className="text-2xl font-bold">{fmt(volume)} kr</span>
        </div>
        <input
          id="volume"
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="mt-3 w-full accent-[var(--usha-gold)]"
        />
        <div className="mt-1 flex justify-between text-xs text-[var(--usha-muted)]">
          <span>0 kr</span>
          <span>{fmt(MAX)} kr</span>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <TierRow
          label="Gratis"
          price={0}
          commission={15}
          net={net.gratis}
          best={bestTier === "gratis"}
        />
        <TierRow
          label="Guld"
          price={299}
          commission={8}
          net={net.guld}
          delta={net.guld - net.gratis}
          best={bestTier === "guld"}
        />
        <TierRow
          label="Premium"
          price={599}
          commission={3}
          net={net.premium}
          delta={net.premium - net.gratis}
          best={bestTier === "premium"}
        />
      </div>

      <p className="mt-4 text-xs text-[var(--usha-muted)]">
        Räknat på en månads volym. Vid större volymer ökar besparingen
        proportionellt. Break-even för Guld inträffar vid ca 4 270 kr/mån,
        för Premium vid ca 4 990 kr/mån.
      </p>
    </div>
  );
}

function TierRow({
  label,
  price,
  commission,
  net,
  delta,
  best,
}: {
  label: string;
  price: number;
  commission: number;
  net: number;
  delta?: number;
  best?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl px-4 py-3 ${
        best
          ? "border-2 border-[var(--usha-gold)]/50 bg-[var(--usha-gold)]/5"
          : "border border-[var(--usha-border)] bg-[var(--usha-card)]"
      }`}
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{label}</span>
          {best && (
            <span className="rounded-full bg-[var(--usha-gold)]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--usha-gold)]">
              Bäst för dig
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--usha-muted)]">
          {price === 0 ? "Gratis" : `${price} kr/mån`} · {commission}% kommission
        </div>
      </div>
      <div className="text-right">
        <div className="font-bold">{fmt(net)} kr</div>
        {delta !== undefined && delta !== 0 && (
          <div
            className={`text-xs ${delta > 0 ? "text-green-400" : "text-red-400"}`}
          >
            {delta > 0 ? "+" : ""}
            {fmt(delta)} kr vs gratis
          </div>
        )}
      </div>
    </div>
  );
}
