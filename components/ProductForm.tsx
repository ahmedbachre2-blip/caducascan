"use client";

import { useState } from "react";
import type { ProductDraft } from "@/lib/types";
import { isoDateOffset } from "@/lib/expiration";

const CATEGORIES = [
  "Lácteos",
  "Panadería",
  "Frutas",
  "Verduras",
  "Carnes",
  "Charcutería",
  "Bebidas",
  "Otros",
];

export function ProductForm({
  draft,
  onChange,
  onSave,
  onCancel,
  saving = false,
}: {
  draft: ProductDraft;
  onChange: (next: ProductDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const [touched, setTouched] = useState(false);
  const valid = draft.name.trim().length > 0 && !!draft.expirationDate;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (valid) onSave();
      }}
    >
      {draft.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={draft.imageUrl}
          alt={draft.name || "Producto"}
          className="mx-auto h-28 w-28 rounded-2xl object-cover ring-1 ring-slate-100"
        />
      ) : null}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Nombre
        </span>
        <input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="Nombre del producto"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-fresh-500 focus:ring-2"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Marca
        </span>
        <input
          value={draft.brand ?? ""}
          onChange={(e) => onChange({ ...draft, brand: e.target.value })}
          placeholder="Opcional"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-fresh-500 focus:ring-2"
        />
      </label>

      {/* ✅ حقل السعر الجديد */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Precio (€)
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={draft.price ?? ""}
            onChange={(e) =>
              onChange({
                ...draft,
                price: e.target.value ? parseFloat(e.target.value) : 0,
              })
            }
            placeholder="0.00"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-fresh-500 focus:ring-2"
          />
        </label>

        {/* ✅ حقل الكمية الجديد */}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Cantidad
          </span>
          <input
            type="number"
            step="1"
            min="1"
            value={draft.quantity ?? 1}
            onChange={(e) =>
              onChange({
                ...draft,
                quantity: e.target.value ? parseInt(e.target.value, 10) : 1,
              })
            }
            placeholder="1"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-fresh-500 focus:ring-2"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Categoría
        </span>
        <select
          value={draft.category}
          onChange={(e) => onChange({ ...draft, category: e.target.value })}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-fresh-500 focus:ring-2"
        >
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Fecha de caducidad
        </span>
        <input
          type="date"
          min={isoDateOffset(-30)}
          value={draft.expirationDate}
          onChange={(e) =>
            onChange({ ...draft, expirationDate: e.target.value })
          }
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-fresh-500 focus:ring-2"
        />
      </label>

      {touched && !valid ? (
        <p className="text-sm text-red-600">
          Añade un nombre y una fecha de caducidad.
        </p>
      ) : null}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-700"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-fresh-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-fresh-700 disabled:opacity-60"
        >
          Guardar
        </button>
      </div>
    </form>
  );
}