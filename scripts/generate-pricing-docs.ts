/**
 * Generates marketing-ready .docx and .xlsx from src/lib/stripe/config.ts.
 * Source of truth: PLANS + GRATIS_PLAN. Break-even tier model mirrors
 * src/app/(dashboard)/dashboard/billing/break-even-calculator.tsx.
 *
 * Run:   npm run docs:pricing
 * Out:   marketing/generated/Usha_Planer_Tier-listor.docx
 *        marketing/generated/Usha_Planer_Jamforelse.xlsx
 */

import { mkdir } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} from "docx";
import ExcelJS from "exceljs";
import { PLANS, GRATIS_PLAN, getGratisPlan } from "../src/lib/stripe/config";
import type { MemberRole } from "../src/types/database";

// Mirror of break-even-calculator.tsx — keep these in sync if commission changes
const COMMISSION = { gratis: 0.15, guld: 0.08, premium: 0.03 } as const;
const SUB_PRICE = { gratis: 0, guld: 299, premium: 599 } as const;

const ROLE_LABEL: Record<MemberRole, string> = {
  publik: "Publik",
  kreator: "Kreatör",
  upplevelse: "Upplevelse",
};

const ROLES: MemberRole[] = ["publik", "kreator", "upplevelse"];

const OUT_DIR = path.resolve(__dirname, "..", "marketing", "generated");
const DOCX_PATH = path.join(OUT_DIR, "Usha_Planer_Tier-listor.docx");
const XLSX_PATH = path.join(OUT_DIR, "Usha_Planer_Jamforelse.xlsx");

// -------------------- helpers --------------------

function fmtSek(n: number) {
  return `${Math.round(n).toLocaleString("sv-SE")} kr`;
}

/** Smallest monthly volume where a tier yields strictly higher net than gratis. */
function breakEvenVsGratis(tier: "guld" | "premium") {
  // volume*0.85 - SUB > volume*0.85 ... wait: net = volume - (volume*c + price)
  // For tier vs gratis: volume - volume*c_t - p_t  >  volume - volume*c_g - 0
  // -> volume*(c_g - c_t) > p_t
  // -> volume > p_t / (c_g - c_t)
  const delta = COMMISSION.gratis - COMMISSION[tier];
  return SUB_PRICE[tier] / delta;
}

// -------------------- DOCX --------------------

function plainParagraph(text: string, opts: { bold?: boolean; size?: number } = {}) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: opts.bold ?? false,
        size: opts.size ?? 22,
      }),
    ],
  });
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({
    heading: level,
    children: [new TextRun({ text, bold: true })],
  });
}

function bullet(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function planFeatureBlock(title: string, priceLine: string, description: string, features: string[]) {
  return [
    heading(title, HeadingLevel.HEADING_3),
    plainParagraph(priceLine, { bold: true }),
    plainParagraph(description),
    ...features.map(bullet),
    new Paragraph({ text: "" }),
  ];
}

function buildBreakEvenTable() {
  const volumes = [0, 1000, 2500, 5000, 7500, 10000, 15000, 20000];
  const header = ["Månadsvolym (kr)", "Netto Gratis", "Netto Guld", "Netto Premium", "Bäst för dig"];

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: header.map(
        (h) =>
          new TableCell({
            width: { size: 100 / header.length, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
          })
      ),
    }),
  ];

  for (const v of volumes) {
    const net = {
      gratis: v - (v * COMMISSION.gratis + SUB_PRICE.gratis),
      guld: v - (v * COMMISSION.guld + SUB_PRICE.guld),
      premium: v - (v * COMMISSION.premium + SUB_PRICE.premium),
    };
    const best =
      net.premium >= net.guld && net.premium >= net.gratis
        ? "Premium"
        : net.guld >= net.gratis
          ? "Guld"
          : "Gratis";

    rows.push(
      new TableRow({
        children: [
          fmtSek(v),
          fmtSek(net.gratis),
          fmtSek(net.guld),
          fmtSek(net.premium),
          best,
        ].map(
          (val) =>
            new TableCell({
              children: [new Paragraph(val)],
            })
        ),
      })
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
    },
  });
}

async function generateDocx() {
  const now = new Date().toISOString().slice(0, 10);

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Usha — Planer & Tier-listor", bold: true, size: 36 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Genererad ${now} från src/lib/stripe/config.ts`, italics: true, size: 18 })],
    }),
    new Paragraph({ text: "" }),
  ];

  for (const role of ROLES) {
    children.push(heading(ROLE_LABEL[role], HeadingLevel.HEADING_1));

    // Gratis (role-aware)
    const gratis = getGratisPlan(role);
    children.push(
      ...planFeatureBlock(
        "Gratis",
        `${fmtSek(gratis.price)}/mån`,
        gratis.description,
        gratis.features
      )
    );

    // Paid plans for this role
    for (const [, plan] of Object.entries(PLANS).filter(([, p]) => p.role === role)) {
      const popular = plan.popular ? " (populär)" : "";
      children.push(
        ...planFeatureBlock(
          `${plan.name}${popular}`,
          `${fmtSek(plan.price)}/mån`,
          plan.description,
          plan.features
        )
      );
    }
  }

  // Break-even section (only meaningful for kreator/upplevelse)
  children.push(heading("Break-even för kreatörer och upplevelser", HeadingLevel.HEADING_1));
  children.push(
    plainParagraph(
      `Vid ${fmtSek(breakEvenVsGratis("guld"))}/mån börjar Guld löna sig mer än Gratis. ` +
        `Vid ${fmtSek(breakEvenVsGratis("premium"))}/mån går Premium om Gratis. ` +
        `Tabellen nedan visar netto-inkomst efter Ushas kommission och eventuellt abonnemang.`
    )
  );
  children.push(new Paragraph({ text: "" }));
  children.push(buildBreakEvenTable());

  const doc = new Document({
    creator: "Usha AB",
    title: "Usha — Planer & Tier-listor",
    sections: [{ children }],
  });

  const buf = await Packer.toBuffer(doc);
  await writeFile(DOCX_PATH, buf);
  console.log(`✓ ${path.relative(process.cwd(), DOCX_PATH)}`);
}

// -------------------- XLSX --------------------

async function generateXlsx() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Usha AB";
  wb.created = new Date();

  // Sheet 1: Planer (one row per plan, all roles)
  const planer = wb.addWorksheet("Planer");
  planer.columns = [
    { header: "Roll", key: "role", width: 14 },
    { header: "Plan", key: "name", width: 14 },
    { header: "Tier", key: "tier", width: 10 },
    { header: "Pris (kr/mån)", key: "price", width: 16 },
    { header: "Populär", key: "popular", width: 10 },
    { header: "Beskrivning", key: "description", width: 40 },
    { header: "Antal features", key: "fcount", width: 14 },
  ];
  planer.getRow(1).font = { bold: true };

  for (const role of ROLES) {
    const gratis = getGratisPlan(role);
    planer.addRow({
      role: ROLE_LABEL[role],
      name: gratis.name,
      tier: gratis.tier,
      price: gratis.price,
      popular: "",
      description: gratis.description,
      fcount: gratis.features.length,
    });
  }
  for (const [, plan] of Object.entries(PLANS)) {
    planer.addRow({
      role: ROLE_LABEL[plan.role],
      name: plan.name,
      tier: plan.tier,
      price: plan.price,
      popular: plan.popular ? "ja" : "",
      description: plan.description,
      fcount: plan.features.length,
    });
  }

  // Sheet 2: Features (one row per feature)
  const features = wb.addWorksheet("Features");
  features.columns = [
    { header: "Roll", key: "role", width: 14 },
    { header: "Plan", key: "name", width: 14 },
    { header: "Feature", key: "feature", width: 60 },
  ];
  features.getRow(1).font = { bold: true };

  for (const role of ROLES) {
    const gratis = getGratisPlan(role);
    for (const f of gratis.features) {
      features.addRow({ role: ROLE_LABEL[role], name: "Gratis", feature: f });
    }
  }
  for (const [, plan] of Object.entries(PLANS)) {
    for (const f of plan.features) {
      features.addRow({ role: ROLE_LABEL[plan.role], name: plan.name, feature: f });
    }
  }

  // Sheet 3: Break-even (volym → netto per tier, formler så användaren kan ändra)
  const be = wb.addWorksheet("Break-even");
  be.columns = [
    { header: "Månadsvolym (kr)", key: "vol", width: 20 },
    { header: "Netto Gratis", key: "gratis", width: 16 },
    { header: "Netto Guld", key: "guld", width: 16 },
    { header: "Netto Premium", key: "premium", width: 18 },
    { header: "Bäst för dig", key: "best", width: 14 },
    { header: "Δ Guld vs Gratis", key: "dguld", width: 18 },
    { header: "Δ Premium vs Gratis", key: "dprem", width: 20 },
  ];
  be.getRow(1).font = { bold: true };

  // Parametrar (synliga, redigerbara) i en parameter-flik
  const params = wb.addWorksheet("Parametrar");
  params.columns = [
    { header: "Parameter", key: "k", width: 28 },
    { header: "Värde", key: "v", width: 14 },
  ];
  params.getRow(1).font = { bold: true };
  params.addRow({ k: "Kommission Gratis", v: COMMISSION.gratis });
  params.addRow({ k: "Kommission Guld", v: COMMISSION.guld });
  params.addRow({ k: "Kommission Premium", v: COMMISSION.premium });
  params.addRow({ k: "Pris Guld (kr/mån)", v: SUB_PRICE.guld });
  params.addRow({ k: "Pris Premium (kr/mån)", v: SUB_PRICE.premium });
  params.addRow({ k: "Break-even Guld vs Gratis (kr/mån)", v: Math.round(breakEvenVsGratis("guld")) });
  params.addRow({ k: "Break-even Premium vs Gratis (kr/mån)", v: Math.round(breakEvenVsGratis("premium")) });

  const volumes = [0, 1000, 2500, 5000, 7500, 10000, 12500, 15000, 17500, 20000];
  volumes.forEach((v, i) => {
    const r = i + 2; // header on row 1
    be.addRow({
      vol: v,
      gratis: { formula: `A${r}-A${r}*Parametrar!B2` },
      guld: { formula: `A${r}-A${r}*Parametrar!B3-Parametrar!B5` },
      premium: { formula: `A${r}-A${r}*Parametrar!B4-Parametrar!B6` },
      best: {
        formula: `IF(AND(D${r}>=C${r},D${r}>=B${r}),"Premium",IF(C${r}>=B${r},"Guld","Gratis"))`,
      },
      dguld: { formula: `C${r}-B${r}` },
      dprem: { formula: `D${r}-B${r}` },
    });
  });

  // Currency format
  ["B", "C", "D", "F", "G"].forEach((col) => {
    be.getColumn(col).numFmt = '#,##0" kr"';
  });
  be.getColumn("A").numFmt = '#,##0" kr"';

  await wb.xlsx.writeFile(XLSX_PATH);
  console.log(`✓ ${path.relative(process.cwd(), XLSX_PATH)}`);
}

// -------------------- main --------------------

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await generateDocx();
  await generateXlsx();
  console.log("\nKlart. Filerna ligger i marketing/generated/.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
