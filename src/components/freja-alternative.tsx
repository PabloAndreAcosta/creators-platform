"use client";

/**
 * Länk under BankID-knappen för den som saknar svenskt BankID: Freja eID,
 * som också kan utfärdas med biometriskt pass från andra länder.
 * Syns bara när NEXT_PUBLIC_FREJA_ENABLED är på (Freja aktiverat i Signicat).
 */
export function FrejaAlternative({
  label,
  onClick,
  disabled,
  className = "",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  if (process.env.NEXT_PUBLIC_FREJA_ENABLED !== "true") return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-center text-xs font-medium text-[var(--usha-muted)] underline underline-offset-2 hover:text-[var(--usha-white)] disabled:opacity-60 ${className}`}
    >
      {label}
    </button>
  );
}
