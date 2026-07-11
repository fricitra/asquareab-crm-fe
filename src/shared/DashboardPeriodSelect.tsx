import { useEffect, useRef, useState, type CSSProperties } from "react";
import { NavIcon } from "./NavIcons";

type DashboardPeriodSelectProps<T extends string> = {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
};

export function DashboardPeriodSelect<T extends string>({
  value,
  options,
  onChange
}: DashboardPeriodSelectProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});

  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open || !triggerRef.current) {
      return;
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const menuWidth = Math.max(rect.width, 208);
      let left = rect.left;
      if (left + menuWidth > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - menuWidth - 12);
      }

      setPopoverStyle({
        position: "fixed",
        top: rect.bottom + 6,
        left,
        width: menuWidth,
        zIndex: 1200
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selectOption = (nextValue: T) => {
    onChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="crm-dashboard-period" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Period"
        className={`crm-dashboard-action crm-dashboard-period-action${open ? " is-open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <span className="crm-dashboard-action-icon">
          <NavIcon name="calendar" />
        </span>
        <span className="crm-dashboard-action-label">{selectedOption?.label}</span>
        <span aria-hidden="true" className="crm-dashboard-period-chevron">
          <NavIcon name="chevron" />
        </span>
      </button>

      {open ? (
        <div
          aria-activedescendant={`dashboard-period-${value}`}
          aria-label="Period"
          className="crm-dashboard-period-menu"
          role="listbox"
          style={popoverStyle}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                aria-selected={isSelected}
                className={`crm-dashboard-period-option${isSelected ? " is-selected" : ""}`}
                id={`dashboard-period-${option.value}`}
                key={option.value}
                onClick={() => selectOption(option.value)}
                role="option"
                type="button"
              >
                <span>{option.label}</span>
                {isSelected ? (
                  <span aria-hidden="true" className="crm-dashboard-period-option-check">
                    <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
                      <path
                        d="M3.5 8.5 6.5 11.5 12.5 4.5"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
