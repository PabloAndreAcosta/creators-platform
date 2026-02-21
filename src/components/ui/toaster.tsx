"use client";

import { createContext, useCallback, useContext, useState } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { cn } from "@/lib/utils";
import { X, CheckCircle2, XCircle, Info } from "lucide-react";

type ToastVariant = "default" | "success" | "error" | "info";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastFn {
  (opts: Omit<Toast, "id">): void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

interface ToastContextValue {
  toast: ToastFn;
}

const ToastContext = createContext<ToastContextValue>({
  toast: Object.assign(() => {}, {
    success: () => {},
    error: () => {},
    info: () => {},
  }),
});

export function useToast() {
  return useContext(ToastContext);
}

const VARIANT_STYLES: Record<ToastVariant, { border: string; icon: React.ReactNode }> = {
  default: {
    border: "border-[var(--usha-border)]",
    icon: null,
  },
  success: {
    border: "border-green-500/30",
    icon: <CheckCircle2 size={16} className="shrink-0 text-green-400" />,
  },
  error: {
    border: "border-red-500/30",
    icon: <XCircle size={16} className="shrink-0 text-red-400" />,
  },
  info: {
    border: "border-blue-500/30",
    icon: <Info size={16} className="shrink-0 text-blue-400" />,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((opts: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...opts, id }]);
  }, []);

  const toast = useCallback(
    Object.assign(addToast, {
      success: (title: string, description?: string) =>
        addToast({ title, description, variant: "success" }),
      error: (title: string, description?: string) =>
        addToast({ title, description, variant: "error" }),
      info: (title: string, description?: string) =>
        addToast({ title, description, variant: "info" }),
    }),
    [addToast]
  ) as ToastFn;

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => {
          const variant = t.variant ?? "default";
          const styles = VARIANT_STYLES[variant];
          return (
            <ToastPrimitive.Root
              key={t.id}
              open
              onOpenChange={(open) => {
                if (!open) dismiss(t.id);
              }}
              duration={5000}
              className={cn(
                "rounded-xl border bg-[var(--usha-card)] px-5 py-4 shadow-lg",
                "data-[state=open]:animate-fade-up data-[state=closed]:opacity-0",
                styles.border
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  {styles.icon}
                  <div className="flex-1 min-w-0">
                    <ToastPrimitive.Title className="text-sm font-semibold">
                      {t.title}
                    </ToastPrimitive.Title>
                    {t.description && (
                      <ToastPrimitive.Description className="mt-1 text-sm text-[var(--usha-muted)]">
                        {t.description}
                      </ToastPrimitive.Description>
                    )}
                  </div>
                </div>
                <ToastPrimitive.Close className="rounded p-1 text-[var(--usha-muted)] transition-colors hover:text-white shrink-0">
                  <X size={14} />
                </ToastPrimitive.Close>
              </div>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport className="fixed bottom-6 right-6 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
