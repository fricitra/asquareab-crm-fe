import { useEffect } from "react";

type UseModalEscapeOptions = {
  disabled?: boolean;
};

export function useModalEscape(open: boolean, onClose: () => void, options?: UseModalEscapeOptions) {
  const disabled = options?.disabled ?? false;

  useEffect(() => {
    if (!open || disabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, onClose, open]);
}
