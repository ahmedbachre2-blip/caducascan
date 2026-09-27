import type { ExpirationStatus } from "./types";

export function daysUntil(expirationDate: string, now = new Date()): number {
  const expiry = new Date(`${expirationDate}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = expiry.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

// ✅ التعديل الجديد: Urgente ≤14 días, Pronto 15-25 días, OK >26 días
export function statusFromDays(days: number): ExpirationStatus {
  if (days <= 14) return "urgente";
  if (days <= 25) return "pronto";
  return "ok";
}

export function formatDaysLabel(days: number): string {
  if (days < 0) {
    const n = Math.abs(days);
    return n === 1 ? "Caduco hace 1 dia" : `Caduco hace ${n} dias`;
  }
  if (days === 0) return "Caduca hoy";
  if (days === 1) return "Caduca manana";
  return `${days} dias`;
}

export function isoDateOffset(daysFromToday: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function estimateExpiryDays(category: string): number {
  const cat = (category || "").toLowerCase();
  if (cat.includes("lacte")) return 7;
  if (cat.includes("yogur")) return 10;
  if (cat.includes("queso")) return 21;
  if (cat.includes("carne")) return 3;
  if (cat.includes("pollo")) return 2;
  if (cat.includes("pescado")) return 2;
  if (cat.includes("pan")) return 4;
  if (cat.includes("fruta")) return 7;
  if (cat.includes("verdura")) return 7;
  if (cat.includes("huevo")) return 21;
  if (cat.includes("conserva")) return 365;
  if (cat.includes("pasta")) return 180;
  if (cat.includes("arroz")) return 180;
  if (cat.includes("cereal")) return 180;
  if (cat.includes("legumbre")) return 365;
  if (cat.includes("bebida")) return 30;
  if (cat.includes("zumo")) return 7;
  if (cat.includes("preparado")) return 3;
  if (cat.includes("listo")) return 3;
  return 7;
}