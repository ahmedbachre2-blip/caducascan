"use client";

import { useMemo, useState } from "react";
import { daysUntil, statusFromDays } from "@/lib/expiration";
import type { FilterTab, Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";

const TABS: { id: FilterTab; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "urgente", label: "🔴 Urgente" },
  { id: "pronto", label: "🟠 Pronto" },
  { id: "ok", label: "🟢 OK" },
  { id: "caducados", label: "⚫ Caducados" },
];

export function ProductList({
  products,
  onDiscount,
  onDelete,
}: {
  products: Product[];
  onDiscount: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [tab, setTab] = useState<FilterTab>("todos");

  const filtered = useMemo(() => {
    if (tab === "todos") return products;

    if (tab === "caducados") {
      return products.filter((p) => daysUntil(p.expirationDate) < 0);
    }

    return products.filter(
      (product) => statusFromDays(daysUntil(product.expirationDate)) === tab
    );
  }, [products, tab]);

  return (
    <section>
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-fresh-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-100">
          {tab === "caducados"
            ? "🎉 ¡No hay productos caducados!"
            : "No hay productos en esta categoría."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onDiscount={onDiscount}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}