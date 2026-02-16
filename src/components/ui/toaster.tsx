"use client";

import { createContext, useCallback, useContext, useState } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "error";
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((opts: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...opts, id }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            open
            onOpenChange={(open) => {
              if (!open) dismiss(t.id);
            }}
            duration={4000}
            className={cn(
              "rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-5 py-4 shadow-lg",
              "data-[state=open]:animate-fade-up data-[state=closed]:opacity-0",
              t.variant === "error" && "border-red-500/30"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <ToastPrimitive.Title className="text-sm font-semibold">
                  {t.title}
                </ToastPrimitive.Title>
                {t.description && (
                  <ToastPrimitive.Description className="mt-1 text-sm text-[var(--usha-muted)]">
                    {t.description}
                  </ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close className="rounded p-1 text-[var(--usha-muted)] transition-colors hover:text-white">
                <X size={14} />
              </ToastPrimitive.Close>
            </div>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-6 right-6 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
