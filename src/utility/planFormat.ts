import { currencySymbol } from "../services/plan";

// Display helpers shared by every Study Plan panel. Money and credits show up
// in a dozen places, so they format in exactly one.

export const formatMoney = (amount: number, currency: string): string => {
  const symbol = currencySymbol(currency);
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}${symbol}${Math.abs(rounded).toLocaleString("en-US")}`;
};

// 4 -> "4", 3.5 -> "3.5". Credits are half-points at most in practice.
export const formatCredits = (credits: number): string =>
  Number.isInteger(credits) ? String(credits) : credits.toFixed(1);

export const formatGrade = (grade: number | null): string =>
  grade === null ? "—" : Number.isInteger(grade) ? String(grade) : grade.toFixed(1);

// "Semester A" -> "Sem A"; anything else passes through.
export const shortSemester = (semester?: string): string =>
  semester ? semester.replace("Semester ", "Sem ") : "";

export const termLabel = (year?: number, semester?: string): string => {
  if (!year && !semester) return "—";
  if (!year) return shortSemester(semester);
  if (!semester) return String(year);
  return `${year} ${semester.replace("Semester ", "")}`;
};
