export function splitDateTimeLocal(value: string) {
  if (!value) {
    return { date: "", time: "" };
  }

  const [date, timePart] = value.split("T");
  return {
    date: date ?? "",
    time: (timePart ?? "").slice(0, 5)
  };
}

export function joinDateTimeLocal(date: string, time: string) {
  if (!date) {
    return "";
  }

  return `${date}T${time || "00:00"}`;
}

export function toDateInputValue(value: string) {
  if (!value) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return value.split("T")[0] ?? "";
}

export function formatDisplayDateTime(value: string) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(parsed);
}

export function formatDisplayDate(value: string) {
  if (!value) {
    return "";
  }

  const normalized = toDateInputValue(value);
  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(parsed);
}

export function nowDateTimeLocal() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function nowDateInputValue() {
  return nowDateTimeLocal().slice(0, 10);
}
