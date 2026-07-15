import { forwardRef, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { formatDisplayDate, nowDateInputValue, toDateInputValue } from "../lib/date-field-utils";
import { CalendarMonthView, monthKeyFromValue } from "./CalendarMonthView";

type DateFieldProps = {
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  name?: string;
  id?: string;
  placeholder?: string;
};

export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(function DateField(
  {
    value = "",
    onChange,
    onBlur,
    disabled = false,
    className = "",
    name,
    id,
    placeholder = "Select date"
  },
  ref
) {
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => toDateInputValue(value));
  const [visibleMonth, setVisibleMonth] = useState(() => monthKeyFromValue(value));
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!open) {
      const next = toDateInputValue(value);
      setDraft(next);
      setVisibleMonth(monthKeyFromValue(next || value));
    }
  }, [open, value]);

  useEffect(() => {
    if (!open || !triggerRef.current) {
      return;
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const width = 320;
      let left = rect.left;
      if (left + width > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - width - 12);
      }

      let top = rect.bottom + 6;
      const estimatedHeight = 390;
      if (top + estimatedHeight > window.innerHeight - 12) {
        top = Math.max(12, rect.top - estimatedHeight - 6);
      }

      setPopoverStyle({
        position: "fixed",
        top,
        left,
        width,
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

  const applyValue = (nextValue: string) => {
    onChange(nextValue);
    onBlur?.();
    setOpen(false);
  };

  const handleSet = () => {
    if (!draft) {
      return;
    }
    applyValue(draft);
  };

  const handleClear = () => {
    applyValue("");
  };

  const handleToday = () => {
    const today = nowDateInputValue();
    setDraft(today);
    setVisibleMonth(monthKeyFromValue(today));
  };

  const displayValue = formatDisplayDate(value);

  return (
    <div className={`crm-date-field${open ? " is-open" : ""}`} ref={rootRef}>
      <input ref={ref} type="hidden" name={name} value={toDateInputValue(value)} readOnly />
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-labelledby={fieldId}
        className={`crm-date-field-trigger crm-input${className ? ` ${className}` : ""}`}
        disabled={disabled}
        id={fieldId}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <span className={displayValue ? undefined : "crm-date-field-placeholder"}>{displayValue || placeholder}</span>
        <span aria-hidden className="crm-date-field-icon" />
      </button>

      {open ? (
        <div className="crm-date-field-popover" role="dialog" aria-label="Choose date" style={popoverStyle}>
          <div className="crm-date-field-popover-body">
            <CalendarMonthView
              onSelect={(next) => {
                setDraft(next);
                setVisibleMonth(monthKeyFromValue(next));
              }}
              onVisibleMonthChange={setVisibleMonth}
              value={draft}
              visibleMonth={visibleMonth}
            />
          </div>
          <div className="crm-date-field-actions">
            <div className="crm-date-field-actions-start">
              <button className="crm-inline-text-button" onClick={handleClear} type="button">
                Clear
              </button>
              <button className="crm-inline-text-button" onClick={handleToday} type="button">
                Today
              </button>
            </div>
            <button className="crm-primary-button crm-date-field-set-button" disabled={!draft} onClick={handleSet} type="button">
              Set
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});
