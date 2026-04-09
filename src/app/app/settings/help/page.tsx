"use client";

import { ArrowLeft, HelpCircle, MessageCircle, Mail, FileText } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function HelpPage() {
  const t = useTranslations("help");
  const tc = useTranslations("common");
  const ts = useTranslations("settings");

  const faqs = [
    { q: t("q1"), a: t("a1") },
    { q: t("q2"), a: t("a2") },
    { q: t("q3"), a: t("a3") },
    { q: t("q4"), a: t("a4") },
    { q: t("q5"), a: t("a5") },
  ];

  return (
    <div className="px-4 py-6 space-y-6 md:max-w-2xl md:mx-auto">
      <div>
        <Link
          href="/app/profile"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          {tc("back")}
        </Link>
        <div className="flex items-center gap-3">
          <HelpCircle size={20} className="text-[var(--usha-gold)]" />
          <h1 className="text-2xl font-bold">{t("title")}</h1>
        </div>
      </div>

      {/* Contact options */}
      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href="mailto:support@usha.se"
          className="flex items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition-colors hover:border-[var(--usha-gold)]/20"
        >
          <Mail size={20} className="text-[var(--usha-gold)]" />
          <div>
            <p className="text-sm font-medium">{t("email")}</p>
            <p className="text-xs text-[var(--usha-muted)]">support@usha.se</p>
          </div>
        </a>
        <a
          href="https://instagram.com/ushaplatform"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition-colors hover:border-[var(--usha-gold)]/20"
        >
          <MessageCircle size={20} className="text-[var(--usha-gold)]" />
          <div>
            <p className="text-sm font-medium">Instagram DM</p>
            <p className="text-xs text-[var(--usha-muted)]">@ushaplatform</p>
          </div>
        </a>
      </div>

      {/* FAQ */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <FileText size={16} className="text-[var(--usha-gold)]" />
          <h2 className="text-lg font-bold">{t("faq")}</h2>
        </div>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] overflow-hidden"
            >
              <summary className="flex cursor-pointer items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-[var(--usha-card-hover)] [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{faq.q}</span>
                <span className="text-[var(--usha-muted)] transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="border-t border-[var(--usha-border)] px-4 py-3">
                <p className="text-sm text-[var(--usha-muted)]">{faq.a}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Legal links */}
      <div className="flex flex-wrap justify-center gap-4 text-xs text-[var(--usha-muted)]">
        <Link href="/privacy" className="underline hover:text-white">{ts("privacyPolicy")}</Link>
        <Link href="/terms" className="underline hover:text-white">{ts("terms")}</Link>
        <Link href="/cookies" className="underline hover:text-white">{ts("cookiePolicy")}</Link>
      </div>
    </div>
  );
}
