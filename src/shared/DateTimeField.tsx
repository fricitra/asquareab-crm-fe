import { forwardRef, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import {
  formatDisplayDateTime,
  joinDateTimeLocal,
  nowDateTimeLocal,
  splitDateTimeLocal
} from "../lib/date-field-utils";

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
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!open) {
      setDraft(splitDateTimeLocal(value));
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

      setPopoverStyle({
        position: "fixed",
        top: rect.bottom + 6,
        left: rect.left,
        width: Math.max(rect.width, 300),
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
            <label className="crm-field">
              <span className="crm-label">Date</span>
              <input
                className="crm-input"
                onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSet();
                  }
                }}
                type="date"
                value={draft.date}
              />
            </label>
            <label className="crm-field">
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
            <button className="crm-inline-text-button" onClick={handleClear} type="button">
              Clear
            </button>
            <button className="crm-inline-text-button" onClick={handleToday} type="button">
              Today
            </button>
            <button className="crm-primary-button crm-date-field-set-button" disabled={!draft.date} onClick={handleSet} type="button">
              Set
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});
