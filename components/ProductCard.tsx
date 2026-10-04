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
  onDelete,
}: {
  product: Product;
  onDiscount: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const days = daysUntil(product.expirationDate);
  const status = statusFromDays(days);
  const isExpired = days < 0;
  const totalValue = (product.price || 0) * (product.quantity || 1);

  const handleDelete = () => {
    const confirmMessage = isExpired
      ? `¿Eliminar "${product.name}" del inventario?`
      : `¿Seguro que quieres eliminar "${product.name}"? Esta acción no se puede deshacer.`;

    if (window.confirm(confirmMessage)) {
      onDelete(product.id);
    }
  };

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

        {/* أيقونة سلة المحذوفات + حالة الصلاحية */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={handleDelete}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
              isExpired
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600"
            }`}
            aria-label={`Eliminar ${product.name}`}
            title="Eliminar producto"
          >
            <TrashIcon />
          </button>

          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STATUS_STYLES[status]}`}
          >
            {formatDaysLabel(days)}
          </span>
        </div>
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

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}