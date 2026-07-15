import { useMemo } from "react";
import { nowDateInputValue, toDateInputValue } from "../lib/date-field-utils";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const YEAR_START = 1900;
const YEAR_END_OFFSET = 30;

type CalendarMonthViewProps = {
  value: string;
  visibleMonth: string;
  onVisibleMonthChange: (monthKey: string) => void;
  onSelect: (value: string) => void;
};

function parseYearMonth(monthKey: string) {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) {
    const today = nowDateInputValue();
    return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  }
  return { year, month };
}

function toMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function shiftMonth(monthKey: string, delta: number) {
  const { year, month } = parseYearMonth(monthKey);
  const next = new Date(year, month - 1 + delta, 1);
  return toMonthKey(next.getFullYear(), next.getMonth() + 1);
}

function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildYearOptions(currentYear: number) {
  const endYear = Math.max(new Date().getFullYear() + YEAR_END_OFFSET, currentYear);
  const startYear = Math.min(YEAR_START, currentYear);
  const years: number[] = [];
  for (let year = endYear; year >= startYear; year -= 1) {
    years.push(year);
  }
  return years;
}

export function monthKeyFromValue(value: string) {
  const normalized = toDateInputValue(value) || nowDateInputValue();
  return normalized.slice(0, 7);
}

export function CalendarMonthView({
  value,
  visibleMonth,
  onVisibleMonthChange,
  onSelect
}: CalendarMonthViewProps) {
  const selected = toDateInputValue(value);
  const today = nowDateInputValue();
  const { year, month } = parseYearMonth(visibleMonth);
  const yearOptions = useMemo(() => buildYearOptions(year), [year]);

  const days = useMemo(() => {
    const firstOfMonth = new Date(year, month - 1, 1);
    // Monday-first index: Sun=0 -> 6, Mon=1 -> 0, ... Sat=6 -> 5
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];

    for (let index = 0; index < startOffset; index += 1) {
      const date = new Date(year, month - 1, -startOffset + index + 1);
      cells.push({
        iso: toIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate()),
        day: date.getDate(),
        inMonth: false
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({
        iso: toIsoDate(year, month, day),
        day,
        inMonth: true
      });
    }

    while (cells.length % 7 !== 0 || cells.length < 42) {
      const last = cells[cells.length - 1];
      const date = new Date(`${last.iso}T00:00:00`);
      date.setDate(date.getDate() + 1);
      cells.push({
        iso: toIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate()),
        day: date.getDate(),
        inMonth: false
      });
      if (cells.length >= 42) {
        break;
      }
    }

    return cells;
  }, [year, month]);

  return (
    <div className="crm-calendar-month">
      <div className="crm-calendar-month-header">
        <button
          aria-label="Previous month"
          className="crm-calendar-nav-button"
          onClick={() => onVisibleMonthChange(shiftMonth(visibleMonth, -1))}
          type="button"
        >
          ‹
        </button>
        <div className="crm-calendar-month-pickers">
          <label className="crm-calendar-picker">
            <span className="crm-sr-only">Month</span>
            <select
              aria-label="Month"
              className="crm-calendar-select crm-calendar-select-month"
              onChange={(event) => onVisibleMonthChange(toMonthKey(year, Number(event.target.value)))}
              onMouseDown={(event) => event.stopPropagation()}
              value={month}
            >
              {MONTH_LABELS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-calendar-picker">
            <span className="crm-sr-only">Year</span>
            <select
              aria-label="Year"
              className="crm-calendar-select crm-calendar-select-year"
              onChange={(event) => onVisibleMonthChange(toMonthKey(Number(event.target.value), month))}
              onMouseDown={(event) => event.stopPropagation()}
              value={year}
            >
              {yearOptions.map((optionYear) => (
                <option key={optionYear} value={optionYear}>
                  {optionYear}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          aria-label="Next month"
          className="crm-calendar-nav-button"
          onClick={() => onVisibleMonthChange(shiftMonth(visibleMonth, 1))}
          type="button"
        >
          ›
        </button>
      </div>

      <div className="crm-calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="crm-calendar-grid" role="grid" aria-label={`${MONTH_LABELS[month - 1]} ${year}`}>
        {days.map((cell) => {
          const isSelected = Boolean(selected) && cell.iso === selected;
          const isToday = cell.iso === today;
          return (
            <button
              aria-pressed={isSelected}
              className={[
                "crm-calendar-day",
                cell.inMonth ? "" : " is-outside",
                isSelected ? " is-selected" : "",
                isToday ? " is-today" : ""
              ].join("")}
              key={cell.iso}
              onClick={() => onSelect(cell.iso)}
              type="button"
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
