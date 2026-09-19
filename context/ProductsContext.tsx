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
import type { ExpirationStatus, Product, ProductDraft } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

type ProductsContextValue = {
  products: Product[];
  counts: Record<ExpirationStatus, number>;
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
    
    // إذا لم يكن هناك مستخدم مسجل، لا نجلب أي منتجات
    if (!user?.id) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", user.id)  // ✅ فلترة منتجات المستخدم الحالي فقط
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

  const addProduct = useCallback(async (draft: ProductDraft) => {
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
        user_id: user.id,  // ✅ ربط المنتج بالمستخدم الحالي
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
  }, [user?.id]);

  const applyDiscount = useCallback(async (id: string) => {
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
  }, [products]);

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
      value={{ products, counts, loading, error, addProduct, applyDiscount, deleteProduct, refresh }}
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