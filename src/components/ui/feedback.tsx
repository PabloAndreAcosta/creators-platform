import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Info, AlertCircle } from "lucide-react";

interface FeedbackProps {
  message: string;
  className?: string;
}

export function SuccessMessage({ message, className }: FeedbackProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2.5 text-sm text-green-400",
        className
      )}
      role="status"
    >
      <CheckCircle2 size={16} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function ErrorMessage({ message, className }: FeedbackProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-400",
        className
      )}
      role="alert"
    >
      <XCircle size={16} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function InfoMessage({ message, className }: FeedbackProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-2.5 text-sm text-blue-400",
        className
      )}
      role="status"
    >
      <Info size={16} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function WarningMessage({ message, className }: FeedbackProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg bg-yellow-500/10 px-3 py-2.5 text-sm text-yellow-400",
        className
      )}
      role="status"
    >
      <AlertCircle size={16} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}
