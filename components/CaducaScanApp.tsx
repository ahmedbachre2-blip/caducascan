"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Header } from "@/components/Header";
import { ProductList } from "@/components/ProductList";
import { SummaryCards } from "@/components/SummaryCards";
import { SettingsModal } from "@/components/SettingsModal";
import { ProductsProvider, useProducts } from "@/context/ProductsContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AuthScreen } from "@/components/AuthScreen";
import { isoDateOffset, estimateExpiryDays } from "@/lib/expiration";
import type { ImpactStats as ImpactStatsType } from "@/lib/types";

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

function AuthGate() {
  const { user, loading } = useAuth();

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

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <ProductsProvider>
      <HomeScreen />
    </ProductsProvider>
  );
}

function ImpactStats({ stats }: { stats: ImpactStatsType }) {
  const hasData =
    stats.savedProducts > 0 ||
    stats.savedMoney > 0 ||
    stats.expiredProducts > 0;

  if (!hasData) return null;

  return (
    <section className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 p-4 text-white shadow-lg">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">🎯</span>
        <h3 className="text-sm font-semibold uppercase tracking-wide">
          Tu Impacto
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/15 p-3 backdrop-blur-sm">
          <p className="text-[11px] uppercase opacity-90">✅ Rescatados</p>
          <p className="mt-1 text-2xl font-bold">{stats.savedProducts}</p>
          <p className="text-[11px] opacity-75">productos</p>
        </div>

        <div className="rounded-xl bg-white/15 p-3 backdrop-blur-sm">
          <p className="text-[11px] uppercase opacity-90">💰 Ahorrados</p>
          <p className="mt-1 text-2xl font-bold">
            {stats.savedMoney.toFixed(2)}€
          </p>
          <p className="text-[11px] opacity-75">este mes</p>
        </div>
      </div>

      {stats.expiredProducts > 0 && (
        <div className="mt-3 rounded-xl bg-red-900/40 p-3 backdrop-blur-sm">
          <p className="text-[11px] uppercase opacity-90">
            ⚠️ Productos caducados
          </p>
          <p className="mt-1 text-lg font-bold">
            {stats.expiredProducts} — {stats.expiredMoney.toFixed(2)}€ perdidos
          </p>
        </div>
      )}
    </section>
  );
}

function HomeScreen() {
  const { products, counts, moneyAtRisk, impactStats, addProduct, applyDiscount } =
    useProducts();
  const { user, signOut } = useAuth();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptItems, setReceiptItems] = useState<
    Array<{ name: string; quantity?: number; totalPrice?: number }>
  >([]);
  const [receiptError, setReceiptError] = useState("");

  const [expLoading, setExpLoading] = useState(false);
  const [expDate, setExpDate] = useState<string | null>(null);
  const [expError, setExpError] = useState("");

  const [expProductName, setExpProductName] = useState("");
  const [expProductPrice, setExpProductPrice] = useState<number>(0);
  const [expProductQuantity, setExpProductQuantity] = useState<number>(1);

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

  const processExpBase64 = async (base64: string) => {
    setExpLoading(true);
    setExpDate(null);
    setExpError("");
    try {
      const res = await fetch("/api/extract-exp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      const data = await res.json();
      if (data.error) {
        setExpError(data.error);
      } else if (data.expirationDate) {
        setExpDate(data.expirationDate);
      } else {
        setExpError("No se pudo leer la fecha. Intenta de nuevo.");
      }
    } catch {
      setExpError("Error de conexion");
    } finally {
      setExpLoading(false);
    }
  };

  const handleExpUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      await processExpBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveExpProduct = () => {
    if (!expDate || !expProductName.trim()) {
      setExpError("Por favor, introduce el nombre del producto");
      return;
    }

    addProduct({
      barcode: "",
      name: expProductName,
      category: "otros",
      brand: "",
      imageUrl: "",
      expirationDate: expDate,
      price: expProductPrice,
      quantity: expProductQuantity,
    });

    setExpDate(null);
    setExpError("");
    setExpProductName("");
    setExpProductPrice(0);
    setExpProductQuantity(1);
    setShowReceiptModal(false);
  };

  const handleCancelExp = () => {
    setExpDate(null);
    setExpError("");
    setExpProductName("");
    setExpProductPrice(0);
    setExpProductQuantity(1);
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
        price: item.totalPrice || 1.5,
        quantity: item.quantity || 1,
      });
    });
    setShowReceiptModal(false);
    setReceiptItems([]);
  };

  return (
    <div className="min-h-dvh bg-slate-50">
      <Header />
      <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 pb-28 pt-5">
        {/* شريط المستخدم مع زر الإعدادات */}
        <div className="flex items-center justify-between gap-2 rounded-xl bg-white px-4 py-2 text-xs shadow-sm">
          <span className="truncate text-gray-500">{user?.email}</span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-lg bg-slate-50 px-2 py-1 text-base hover:bg-slate-100"
              aria-label="Ajustes"
            >
              ⚙️
            </button>
            <button
              onClick={() => signOut()}
              className="rounded-lg bg-red-50 px-3 py-1 font-medium text-red-600"
            >
              Salir
            </button>
          </div>
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

        <SummaryCards counts={counts} moneyAtRisk={moneyAtRisk} />

        <ImpactStats stats={impactStats} />

        <ProductList products={products} onDiscount={applyDiscount} />
      </main>

      <ScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSave={addProduct}
      />

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        userEmail={user?.email ?? undefined}
      />

      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Subir Ticket de Compra</h2>

            {receiptItems.length === 0 && !receiptLoading && !expDate && (
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

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">O</span>
                  </div>
                </div>

                <label className="block w-full cursor-pointer rounded-xl bg-blue-600 py-3 text-center font-semibold text-white">
                  📅 Leer Fecha EXP
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleExpUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {expLoading && (
              <p className="py-4 text-center text-sm text-gray-500">
                Analizando fecha EXP...
              </p>
            )}

            {expError && <p className="py-2 text-sm text-red-600">{expError}</p>}

            {expDate && (
              <div className="space-y-4">
                <div className="rounded-xl bg-green-50 p-3 text-center">
                  <p className="text-xs text-gray-500">Fecha de EXP encontrada:</p>
                  <p className="text-2xl font-bold text-green-700">{expDate}</p>
                </div>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Nombre del producto *
                  </span>
                  <input
                    type="text"
                    value={expProductName}
                    onChange={(e) => setExpProductName(e.target.value)}
                    placeholder="Ej: Leche Pascual"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-fresh-500 focus:ring-2"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Precio (€)
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={expProductPrice || ""}
                      onChange={(e) =>
                        setExpProductPrice(parseFloat(e.target.value) || 0)
                      }
                      placeholder="0.00"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-fresh-500 focus:ring-2"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Cantidad
                    </span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={expProductQuantity || 1}
                      onChange={(e) =>
                        setExpProductQuantity(parseInt(e.target.value) || 1)
                      }
                      placeholder="1"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-fresh-500 focus:ring-2"
                    />
                  </label>
                </div>

                <button
                  onClick={handleSaveExpProduct}
                  disabled={!expProductName.trim()}
                  className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white disabled:opacity-50"
                >
                  💾 Guardar Producto
                </button>
                <button
                  onClick={handleCancelExp}
                  className="w-full rounded-xl bg-slate-100 py-2 text-sm"
                >
                  Cancelar
                </button>
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

            {!expDate && (
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setReceiptItems([]);
                  setReceiptError("");
                  setExpDate(null);
                  setExpError("");
                  setExpProductName("");
                  setExpProductPrice(0);
                  setExpProductQuantity(1);
                }}
                className="mt-3 w-full rounded-xl bg-slate-100 py-2 text-sm"
              >
                Cerrar
              </button>
            )}
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