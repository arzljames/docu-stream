import * as React from "react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "default";

type ToastInput = {
  description?: string;
  title: string;
  variant?: ToastVariant;
};

type ToastItem = ToastInput & {
  id: number;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (toast: ToastInput) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = React.useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const nextToastId = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = React.useCallback(
    (input: ToastInput) => {
      const id = nextToastId.current;
      nextToastId.current += 1;

      setToasts((current) => [
        ...current,
        {
          ...input,
          id,
          variant: input.variant ?? "default",
        },
      ]);

      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((item) => (
          <div
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border bg-white px-4 py-3 text-sm text-slate-900 shadow-xl",
              item.variant === "success" &&
                "border-emerald-200 bg-emerald-50 text-emerald-950",
            )}
            key={item.id}
            role="status"
          >
            {item.variant === "success" ? (
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <IconCheck className="size-3.5" stroke={2.5} />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-5">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 text-sm leading-5 text-slate-600">
                  {item.description}
                </p>
              ) : null}
            </div>
            <Button
              aria-label="Dismiss notification"
              className="-mr-2 -mt-1 size-7 text-slate-500 hover:bg-black/5 hover:text-slate-900"
              onClick={() => dismiss(item.id)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <IconX className="size-4" stroke={2} />
            </Button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
