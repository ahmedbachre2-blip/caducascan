"use client";

import { daysUntil, formatDaysLabel, statusFromDays } from "@/lib/expiration";
import type { Product } from "@/lib/types";

const STATUS_STYLES = {
  urgente: "bg-red-50 text-red-700 ring-red-100",
  pronto: "bg-amber-50 text-amber-700 ring-amber-100",
  ok: "bg-fresh-50 text-fresh-700 ring-fresh-100",
};

export function ProductCard({
  product,
  onDiscount,
}: {
  product: Product;
  onDiscount: (id: string) => void;
}) {
  const days = daysUntil(product.expirationDate);
  const status = statusFromDays(days);
  const isExpired = days < 0;
  const totalValue = (product.price || 0) * (product.quantity || 1);

  return (
    <article
      className={`rounded-2xl p-4 shadow-sm ring-1 transition ${
        isExpired ? "bg-red-50 ring-red-200" : "bg-white ring-slate-100"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-slate-900">
              {product.name}
            </h3>
            {isExpired && (
              <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                🔴 Caducado
              </span>
            )}
          </div>

          <p className="mt-0.5 text-sm text-slate-500">{product.category}</p>

          {totalValue > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              <span>
                💰{" "}
                <strong className="text-slate-800">
                  {totalValue.toFixed(2)}€
                </strong>
              </span>
              <span className="text-slate-400">|</span>
              <span>
                {product.price.toFixed(2)}€ × {product.quantity} uds
              </span>
            </div>
          )}
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STATUS_STYLES[status]}`}
        >
          {formatDaysLabel(days)}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onDiscount(product.id)}
        disabled={product.discounted || isExpired}
        className={`mt-3 w-full rounded-xl px-3 py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed ${
          product.discounted
            ? "bg-slate-300 text-slate-500"
            : isExpired
            ? "bg-red-200 text-red-700"
            : "bg-fresh-600 hover:bg-fresh-700"
        }`}
      >
        {product.discounted
          ? "✅ Descuento aplicado"
          : isExpired
          ? "❌ Producto caducado"
          : "🏷️ Aplicar Descuento"}
      </button>
    </article>
  );
}