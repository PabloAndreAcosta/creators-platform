/**
 * Arbetsgivaravgifter för anställda kreatörer.
 *
 * Satserna ändras med budgeten, ibland mitt i året. De ligger därför i en
 * tabell per år och inte som konstanter utspridda i koden. Ett år som saknas i
 * tabellen kastar fel i stället för att tyst räkna med fjolårets siffror: en
 * fel avgift blir ett fel i varje arbetsgivardeklaration.
 *
 * Källa: Skatteverket, Arbetsgivaravgifter 2026 (kontrollerat 2026-10-27).
 *
 * Åldern räknas vid ÅRETS INGÅNG, inte på utbetalningsdagen. En person som
 * fyller 67 i mars betalas med full avgift hela året.
 */

export interface YearRates {
  /** Full avgift, decimal. */
  full: number;
  /** Bara ålderspensionsavgift — för den som fyllt 67 vid årets ingång. */
  senior: number;
  /** Födda detta år eller tidigare betalar ingen avgift. */
  noFeeBornOnOrBefore: number;
  /** Tillfälligt nedsatt avgift för unga, om den gäller någon del av året. */
  youth?: {
    rate: number;
    /** Ålder vid årets ingång, inklusive båda gränserna. */
    minAge: number;
    maxAge: number;
    /** Nedsättningen gäller bara upp till detta belopp per person och månad. */
    monthlyCapOre: number;
    /** Utbetalningsdagar som omfattas, ISO-datum, inklusive båda. */
    from: string;
    to: string;
  };
}

export const RATES_BY_YEAR: Record<number, YearRates> = {
  2026: {
    full: 0.3142,
    senior: 0.1021,
    noFeeBornOnOrBefore: 1937,
    youth: {
      rate: 0.2081,
      minAge: 18,
      maxAge: 22,
      monthlyCapOre: 2_500_000,
      from: "2026-04-01",
      to: "2027-09-30",
    },
  },
};

/** Avgiftsfritt om en person får under 1 000 kr från oss under hela året. */
export const ANNUAL_FEE_THRESHOLD_ORE = 100_000;

export function ratesFor(year: number): YearRates {
  const r = RATES_BY_YEAR[year];
  if (!r) {
    throw new Error(
      `Arbetsgivaravgifter för ${year} saknas i RATES_BY_YEAR — lägg in årets satser från Skatteverket innan lön körs.`,
    );
  }
  return r;
}

export interface FeeInput {
  birthYear: number;
  /** Utbetalningsdag, ISO-datum. Avgiften följer utbetalningen, inte passet. */
  paidOn: string;
  /** Lön inklusive semesterersättning som avgiften ska beräknas på. */
  grossOre: number;
  /**
   * Vad samma person redan fått från oss tidigare samma månad. Behövs för
   * ungdomstaket, som gäller per månad och inte per pass.
   */
  monthToDateGrossOre?: number;
}

export interface Fee {
  feeOre: number;
  /** Vilken regel som användes — sparas med lönen så att AGI går att förklara. */
  basis: "full" | "senior" | "none" | "youth";
}

export function employerFee(input: FeeInput): Fee {
  const { birthYear, paidOn, grossOre } = input;
  const monthToDate = input.monthToDateGrossOre ?? 0;
  if (!Number.isInteger(grossOre) || grossOre < 0) {
    throw new Error("grossOre måste vara ett heltal ≥ 0 (öre)");
  }

  const year = Number(paidOn.slice(0, 4));
  const r = ratesFor(year);
  const ageAtYearStart = year - 1 - birthYear;

  if (birthYear <= r.noFeeBornOnOrBefore) return { feeOre: 0, basis: "none" };
  if (ageAtYearStart >= 67) {
    return { feeOre: Math.round(grossOre * r.senior), basis: "senior" };
  }

  const y = r.youth;
  if (
    y &&
    paidOn >= y.from &&
    paidOn <= y.to &&
    ageAtYearStart >= y.minAge &&
    ageAtYearStart <= y.maxAge
  ) {
    // Bara den del av lönen som ryms under månadstaket får den lägre satsen.
    const roomOre = Math.max(0, y.monthlyCapOre - monthToDate);
    const reducedOre = Math.min(grossOre, roomOre);
    const fullOre = grossOre - reducedOre;
    return {
      feeOre: Math.round(reducedOre * y.rate + fullOre * r.full),
      basis: "youth",
    };
  }

  return { feeOre: Math.round(grossOre * r.full), basis: "full" };
}

/**
 * För UPPSKATTNINGAR (offerter, scenarier): ett utbetalningsår utan inlagda
 * satser räknas med senast kända år, samma dag. Födelseåret flyttas lika
 * mycket så att åldersreglerna fortfarande träffar rätt. Lönekörningen ska
 * aldrig använda den här — där ska ett saknat år stoppa.
 */
export function projectedRateInput(paidOn: string, birthYear: number): {
  paidOn: string;
  birthYear: number;
  projected: boolean;
} {
  const year = Number(paidOn.slice(0, 4));
  if (year in RATES_BY_YEAR) return { paidOn, birthYear, projected: false };
  const latest = Math.max(...Object.keys(RATES_BY_YEAR).map(Number));
  return { paidOn: `${latest}${paidOn.slice(4)}`, birthYear: birthYear - (year - latest), projected: true };
}
