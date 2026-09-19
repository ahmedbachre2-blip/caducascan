"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Header } from "@/components/Header";
import { ProductList } from "@/components/ProductList";
import { SummaryCards } from "@/components/SummaryCards";
import { ProductsProvider, useProducts } from "@/context/ProductsContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AuthScreen } from "@/components/AuthScreen";
import { isoDateOffset, estimateExpiryDays } from "@/lib/expiration";

const ScannerModal = dynamic(
  () => import("@/components/ScannerModal").then((mod) => mod.ScannerModal),
  { ssr: false }
);

export function CaducaScanApp() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

// هذا المكون يتحقق من حالة تسجيل الدخول
function AuthGate() {
  const { user, loading } = useAuth();

  // أثناء التحقق من الجلسة
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-green-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  // إذا لم يكن مسجلاً، اعرض شاشة تسجيل الدخول
  if (!user) {
    return <AuthScreen />;
  }

  // إذا كان مسجلاً، اعرض التطبيق
  return (
    <ProductsProvider>
      <HomeScreen />
    </ProductsProvider>
  );
}

function HomeScreen() {
  const { products, counts, addProduct, applyDiscount } = useProducts();
  const { user, signOut } = useAuth();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptItems, setReceiptItems] = useState<Array<{name: string; quantity?: number; totalPrice?: number}>>([]);
  const [receiptError, setReceiptError] = useState("");

  const processReceiptBase64 = async (base64: string) => {
    setReceiptLoading(true);
    setReceiptItems([]);
    setReceiptError("");
    try {
      const res = await fetch("/api/extract-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      const data = await res.json();
      if (data.error) {
        setReceiptError(data.error);
      } else {
        setReceiptItems(data.items || []);
      }
    } catch {
      setReceiptError("Error de conexion");
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      await processReceiptBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleAddAllItems = () => {
    receiptItems.forEach((item) => {
      addProduct({
        barcode: "",
        name: item.name,
        category: "otros",
        brand: "",
        imageUrl: "",
        expirationDate: isoDateOffset(estimateExpiryDays(item.name)),
      });
    });
    setShowReceiptModal(false);
    setReceiptItems([]);
  };

  return (
    <div className="min-h-dvh bg-slate-50">
      <Header />
      <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 pb-28 pt-5">
        {/* شريط المستخدم */}
        <div className="flex items-center justify-between rounded-xl bg-white px-4 py-2 text-xs shadow-sm">
          <span className="truncate text-gray-500">{user?.email}</span>
          <button
            onClick={() => signOut()}
            className="ml-2 rounded-lg bg-red-50 px-3 py-1 font-medium text-red-600"
          >
            Salir
          </button>
        </div>

        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-4 font-semibold text-white"
        >
          <ScanIcon />
          Escanear Código
        </button>

        <button
          type="button"
          onClick={() => setShowReceiptModal(true)}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-green-600 bg-white px-4 py-4 font-semibold text-green-700"
        >
          📸 Subir Ticket de Compra
        </button>

        <SummaryCards counts={counts} />
        <ProductList products={products} onDiscount={applyDiscount} />
      </main>

      <ScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSave={addProduct}
      />

      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Subir Ticket de Compra</h2>

            {receiptItems.length === 0 && !receiptLoading && (
              <div className="space-y-3">
                <label className="block w-full cursor-pointer rounded-xl bg-green-600 py-3 text-center font-semibold text-white">
                  📷 Tomar Foto con Camara
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleReceiptUpload}
                    className="hidden"
                  />
                </label>

                <label className="block w-full cursor-pointer rounded-xl border-2 border-slate-300 py-3 text-center text-sm">
                  📁 O subir archivo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {receiptLoading && (
              <p className="py-4 text-center text-sm text-gray-500">
                Analizando ticket...
              </p>
            )}

            {receiptError && (
              <p className="py-2 text-sm text-red-600">{receiptError}</p>
            )}

            {receiptItems.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">
                  {receiptItems.length} productos encontrados:
                </p>
                <div className="max-h-64 overflow-y-auto rounded-xl bg-slate-50 p-2">
                  {receiptItems.map((item, i) => (
                    <div key={i} className="border-b py-2 text-sm">
                      <span className="font-medium">{item.name}</span>
                      {item.totalPrice && (
                        <span className="ml-2 text-gray-500">
                          {item.totalPrice}€
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleAddAllItems}
                  className="mt-4 w-full rounded-xl bg-green-600 py-3 font-semibold text-white"
                >
                  Agregar todos al inventario
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setShowReceiptModal(false);
                setReceiptItems([]);
                setReceiptError("");
              }}
              className="mt-3 w-full rounded-xl bg-slate-100 py-2 text-sm"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScanIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path strokeLinecap="round" d="M4 8V5h3M16 5h3v3M20 16v3h-3M8 19H5v-3" />
      <path strokeLinecap="round" d="M7 12h10" />
    </svg>
  );
}