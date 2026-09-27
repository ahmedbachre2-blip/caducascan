"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSupabase } from "@/lib/supabase";
import { daysUntil, statusFromDays } from "@/lib/expiration";
import type {
  ExpirationStatus,
  Product,
  ProductDraft,
  ImpactStats,
} from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

type MoneyAtRisk = {
  urgent: number;
  soon: number;
  ok: number;
  total: number;
};

type ProductsContextValue = {
  products: Product[];
  counts: Record<ExpirationStatus, number>;
  moneyAtRisk: MoneyAtRisk;
  impactStats: ImpactStats;
  loading: boolean;
  error: string | null;
  addProduct: (draft: ProductDraft) => Promise<void>;
  applyDiscount: (id: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const ProductsContext = createContext<ProductsContextValue | null>(null);

function rowToProduct(row: any): Product {
  return {
    id: String(row.id),
    barcode: row.barcode || "",
    name: row.name,
    category: row.category || "otros",
    brand: row.brand || "",
    imageUrl: row.image_url || "",
    expirationDate: row.expiration_date,
    discounted: row.discounted || false,
    price: Number(row.price) || 0,
    quantity: Number(row.quantity) || 1,
  };
}

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const refresh = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setError("Supabase no configurado");
      setLoading(false);
      return;
    }

    if (!user?.id) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", user.id)
      .order("expiration_date", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setProducts((data || []).map(rowToProduct));
      setError(null);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    const next: Record<ExpirationStatus, number> = {
      urgente: 0,
      pronto: 0,
      ok: 0,
    };
    for (const product of products) {
      next[statusFromDays(daysUntil(product.expirationDate))] += 1;
    }
    return next;
  }, [products]);

  // ✅ التعديل الجديد: Urgente ≤14 días, Pronto 15-25 días, OK >26 días
  const moneyAtRisk = useMemo<MoneyAtRisk>(() => {
    const result: MoneyAtRisk = { urgent: 0, soon: 0, ok: 0, total: 0 };
    for (const product of products) {
      const value = (product.price || 0) * (product.quantity || 1);
      if (value <= 0) continue;
      const days = daysUntil(product.expirationDate);
      if (days < 0) continue;
      if (days <= 14) {
        result.urgent += value;
      } else if (days <= 25) {
        result.soon += value;
      } else {
        result.ok += value;
      }
    }
    result.total = result.urgent + result.soon + result.ok;
    return result;
  }, [products]);

  const impactStats = useMemo<ImpactStats>(() => {
    let savedProducts = 0;
    let savedMoney = 0;
    let expiredProducts = 0;
    let expiredMoney = 0;

    for (const product of products) {
      const value = (product.price || 0) * (product.quantity || 1);
      const days = daysUntil(product.expirationDate);

      if (days < 0) {
        expiredProducts += 1;
        expiredMoney += value;
      } else if (product.discounted) {
        savedProducts += 1;
        savedMoney += value * 0.3;
      }
    }

    return { savedProducts, savedMoney, expiredProducts, expiredMoney };
  }, [products]);

  const addProduct = useCallback(
    async (draft: ProductDraft) => {
      const supabase = getSupabase();
      if (!supabase) return;
      if (!user?.id) {
        setError("Debes iniciar sesión para guardar productos");
        return;
      }

      const { data, error: insertError } = await supabase
        .from("products")
        .insert({
          name: draft.name,
          barcode: draft.barcode || "",
          category: draft.category || "otros",
          brand: draft.brand || "",
          image_url: draft.imageUrl || "",
          expiration_date: draft.expirationDate,
          discounted: false,
          user_id: user.id,
          price: draft.price || 0,
          quantity: draft.quantity || 1,
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }

      if (data) {
        setProducts((prev) => [...prev, rowToProduct(data)]);
      }
    },
    [user?.id]
  );

  const applyDiscount = useCallback(
    async (id: string) => {
      const supabase = getSupabase();
      if (!supabase) return;

      const product = products.find((p) => p.id === id);
      if (!product) return;

      const newValue = !product.discounted;

      const { error: updateError } = await supabase
        .from("products")
        .update({ discounted: newValue })
        .eq("id", id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, discounted: newValue } : p))
      );
    },
    [products]
  );

  const deleteProduct = useCallback(async (id: string) => {
    const supabase = getSupabase();
    if (!supabase) return;

    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <ProductsContext.Provider
      value={{
        products,
        counts,
        moneyAtRisk,
        impactStats,
        loading,
        error,
        addProduct,
        applyDiscount,
        deleteProduct,
        refresh,
      }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts debe usarse dentro de ProductsProvider");
  return ctx;
}