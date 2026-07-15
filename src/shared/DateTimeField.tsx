import { forwardRef, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import {
  formatDisplayDateTime,
  joinDateTimeLocal,
  nowDateTimeLocal,
  splitDateTimeLocal
} from "../lib/date-field-utils";
import { CalendarMonthView, monthKeyFromValue } from "./CalendarMonthView";

type DateTimeFieldProps = {
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  name?: string;
  id?: string;
  placeholder?: string;
};

export const DateTimeField = forwardRef<HTMLInputElement, DateTimeFieldProps>(function DateTimeField(
  {
    value = "",
    onChange,
    onBlur,
    disabled = false,
    className = "",
    name,
    id,
    placeholder = "Select date and time"
  },
  ref
) {
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => splitDateTimeLocal(value));
  const [visibleMonth, setVisibleMonth] = useState(() => monthKeyFromValue(splitDateTimeLocal(value).date));
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!open) {
      const next = splitDateTimeLocal(value);
      setDraft(next);
      setVisibleMonth(monthKeyFromValue(next.date));
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
      const estimatedHeight = 460;
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
    if (!draft.date) {
      return;
    }
    applyValue(joinDateTimeLocal(draft.date, draft.time));
  };

  const handleClear = () => {
    applyValue("");
  };

  const handleToday = () => {
    const next = splitDateTimeLocal(nowDateTimeLocal());
    setDraft(next);
    setVisibleMonth(monthKeyFromValue(next.date));
  };

  const displayValue = formatDisplayDateTime(value);

  return (
    <div className={`crm-date-field${open ? " is-open" : ""}`} ref={rootRef}>
      <input ref={ref} type="hidden" name={name} value={value} readOnly />
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
        <div className="crm-date-field-popover" role="dialog" aria-label="Choose date and time" style={popoverStyle}>
          <div className="crm-date-field-popover-body">
            <CalendarMonthView
              onSelect={(nextDate) => {
                setDraft((current) => ({ ...current, date: nextDate }));
                setVisibleMonth(monthKeyFromValue(nextDate));
              }}
              onVisibleMonthChange={setVisibleMonth}
              value={draft.date}
              visibleMonth={visibleMonth}
            />
            <label className="crm-field crm-date-field-time">
              <span className="crm-label">Time</span>
              <input
                className="crm-input"
                onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSet();
                  }
                }}
                step={60}
                type="time"
                value={draft.time}
              />
            </label>
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
            <button className="crm-primary-button crm-date-field-set-button" disabled={!draft.date} onClick={handleSet} type="button">
              Set
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});
