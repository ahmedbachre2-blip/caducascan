"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { ProductList } from "@/components/ProductList";
import { SummaryCards } from "@/components/SummaryCards";
import { SettingsModal } from "@/components/SettingsModal";
import { ProductsProvider, useProducts } from "@/context/ProductsContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AuthScreen } from "@/components/AuthScreen";
import type { ImpactStats as ImpactStatsType, ProductDraft } from "@/lib/types";

const ScannerModal = dynamic(
  () => import("@/components/ScannerModal").then((mod) => mod.ScannerModal),
  { ssr: false }
);

// ==========================================================
// دالة ضغط الصور (للاستخدام في ExpScannerModal)
// ==========================================================
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        resolve(dataUrl.split(",")[1]);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

// ==========================================================
// المكون الرئيسي
// ==========================================================
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

// ==========================================================
// بطاقة الإحصائيات
// ==========================================================
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

// ==========================================================
// الشاشة الرئيسية
// ==========================================================
function HomeScreen() {
  // ✅ تمت إضافة deleteProduct هنا
  const {
    products,
    counts,
    moneyAtRisk,
    impactStats,
    addProduct,
    applyDiscount,
    deleteProduct,
  } = useProducts();
  const { user, signOut } = useAuth();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [expModalOpen, setExpModalOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [registroExpanded, setRegistroExpanded] = useState(false);

  return (
    <div className="min-h-dvh bg-slate-50">
      <Header />

      <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 pb-28 pt-5">
        {/* شريط المستخدم */}
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

        {/* Hero Card */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-700 to-emerald-600 p-5 text-white shadow-lg">
          <div className="relative z-10 max-w-[65%]">
            <h1 className="text-xl font-bold leading-tight">
              Evita pérdidas,
              <br />
              diagnostica a tiempo
            </h1>
            <p className="mt-2 text-xs opacity-90">
              Escanea, organiza y no dejes que se caduque nada.
            </p>
          </div>
          <div className="pointer-events-none absolute -right-2 bottom-0 text-7xl opacity-30">
            🛒
          </div>
          <div className="pointer-events-none absolute right-4 top-4 text-4xl opacity-40">
            🌿
          </div>
        </section>

        {/* الزرّان الرئيسيان */}
        <div className="grid grid-cols-2 gap-3">
          {/* Leer Factura */}
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="flex flex-col items-start gap-2 rounded-2xl bg-green-600 p-4 text-left text-white shadow-md transition hover:bg-green-700"
          >
            <span className="rounded-lg bg-white/20 p-2">
              <ReceiptIcon />
            </span>
            <span className="text-sm font-bold leading-tight">Leer Factura</span>
            <span className="text-[11px] opacity-90">
              Escanea la foto de la factura
            </span>
          </button>

          {/* Leer con IA */}
          <button
            type="button"
            onClick={() => setExpModalOpen(true)}
            className="flex flex-col items-start gap-2 rounded-2xl bg-slate-900 p-4 text-left text-white shadow-md transition hover:bg-slate-800"
          >
            <span className="rounded-lg bg-white/10 p-2">
              <BrainIcon />
            </span>
            <span className="text-sm font-bold leading-tight">Leer con IA</span>
            <span className="text-[11px] opacity-80">
              Reconocimiento inteligente
            </span>
          </button>
        </div>

        {/* بطاقة Ver Registro */}
        <button
          type="button"
          onClick={() => setRegistroExpanded((v) => !v)}
          className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left shadow-sm transition hover:bg-slate-50"
        >
          <span className="rounded-xl bg-green-50 p-2 text-green-600">
            <ChartIcon />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">Ver Registro</p>
            <p className="text-[11px] text-slate-500">
              Consulta tus pérdidas e historial
            </p>
          </div>
          <span className="text-slate-400">
            {registroExpanded ? <ChevronUpIcon /> : <ChevronRightIcon />}
          </span>
        </button>

        {/* المحتوى القابل للطي */}
        {registroExpanded && (
          <div className="space-y-5">
            <SummaryCards counts={counts} moneyAtRisk={moneyAtRisk} />
            <ImpactStats stats={impactStats} />
          </div>
        )}

        {/* قائمة المنتجات */}
        {/* ✅ تمت إضافة onDelete هنا */}
        <ProductList
          products={products}
          onDiscount={applyDiscount}
          onDelete={deleteProduct}
        />
      </main>

      {/* ======== النوافذ المنبثقة ======== */}
      <ScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSave={(drafts) => {
          drafts.forEach((draft) => addProduct(draft));
        }}
      />

      <ExpScannerModal
        open={expModalOpen}
        onClose={() => setExpModalOpen(false)}
        onSave={addProduct}
      />

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        userEmail={user?.email ?? undefined}
      />
    </div>
  );
}

// ==========================================================
// ExpScannerModal - نافذة قراءة تاريخ منتج واحد بالذكاء الاصطناعي
// ==========================================================
function ExpScannerModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (draft: ProductDraft) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"camera" | "loading" | "form" | "error">(
    "camera"
  );
  const [message, setMessage] = useState("");
  const [expDate, setExpDate] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState<number>(0);
  const [productQuantity, setProductQuantity] = useState<number>(1);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const analyzeImage = useCallback(async (base64: string) => {
    setStep("loading");
    setMessage("Analizando imagen...");
    try {
      const res = await fetch("/api/extract-exp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage(data.error);
        setStep("error");
        return;
      }
      if (data.expirationDate) {
        setExpDate(data.expirationDate);
        setStep("form");
      } else {
        setMessage("No se pudo leer la fecha. Intenta con una foto más clara.");
        setStep("error");
      }
    } catch {
      setMessage("Error de conexión.");
      setStep("error");
    }
  }, []);

  const captureFromCamera = useCallback(async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    stopCamera();
    await analyzeImage(dataUrl.split(",")[1]);
  }, [analyzeImage, stopCamera]);

  const handleGalleryUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      stopCamera();
      try {
        const base64 = await compressImage(file);
        await analyzeImage(base64);
      } catch {
        setMessage("Error al procesar la imagen.");
        setStep("error");
      }
    },
    [analyzeImage, stopCamera]
  );

  useEffect(() => {
    if (!open) {
      stopCamera();
      setStep("camera");
      setExpDate(null);
      setProductName("");
      setProductPrice(0);
      setProductQuantity(1);
      setMessage("");
      return;
    }

    setStep("camera");

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }
      } catch {
        setMessage("No se pudo acceder a la cámara.");
        setStep("error");
      }
    };

    const timer = window.setTimeout(() => void startCamera(), 100);
    return () => {
      window.clearTimeout(timer);
      stopCamera();
    };
  }, [open, stopCamera]);

  const handleSave = () => {
    if (!expDate || !productName.trim()) return;
    onSave({
      barcode: "",
      name: productName,
      category: "otros",
      brand: "",
      imageUrl: "",
      expirationDate: expDate,
      price: productPrice,
      quantity: productQuantity,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Leer con IA
          </h2>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="rounded-full px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Cerrar
          </button>
        </div>

        {step === "camera" && (
          <div>
            <div className="relative overflow-hidden rounded-2xl bg-slate-900">
              <video
                ref={videoRef}
                className="aspect-[4/3] w-full object-cover"
                muted
                playsInline
                autoPlay
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[80%] w-[85%] rounded-2xl border-2 border-green-400/60" />
              </div>
              <div className="pointer-events-none absolute bottom-4 left-0 right-0 text-center">
                <p className="mx-auto inline-block rounded-full bg-black/60 px-4 py-1.5 text-xs text-white">
                  Enfoca la fecha de caducidad del producto
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl text-slate-600 hover:bg-slate-200"
              >
                🖼️
              </button>
              <button
                type="button"
                onClick={captureFromCamera}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg ring-4 ring-slate-200 hover:bg-slate-800"
              >
                <CameraIcon />
              </button>
              <div className="h-14 w-14" />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleGalleryUpload}
              className="hidden"
            />
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-600 border-t-transparent"></div>
            <p className="mt-4 text-sm text-slate-600">{message}</p>
          </div>
        )}

        {step === "error" && (
          <div className="space-y-4">
            <div className="rounded-xl bg-red-50 p-4 text-center">
              <p className="text-3xl">⚠️</p>
              <p className="mt-2 text-sm text-red-700">{message}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep("camera");
                setMessage("");
              }}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-medium text-white"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {step === "form" && (
          <div className="space-y-4">
            <div className="rounded-xl bg-green-50 p-3 text-center">
              <p className="text-xs text-gray-500">
                Fecha de caducidad detectada:
              </p>
              <p className="text-2xl font-bold text-green-700">{expDate}</p>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Nombre del producto *
              </span>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ej: Leche Pascual"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500"
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
                  value={productPrice || ""}
                  onChange={(e) =>
                    setProductPrice(parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500"
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
                  value={productQuantity || 1}
                  onChange={(e) =>
                    setProductQuantity(parseInt(e.target.value) || 1)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500"
                />
              </label>
            </div>

            <button
              onClick={handleSave}
              disabled={!productName.trim()}
              className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white disabled:opacity-50"
            >
              💾 Guardar Producto
            </button>
            <button
              onClick={() => setStep("camera")}
              className="w-full rounded-xl bg-slate-100 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================================
// الأيقونات
// ==========================================================
function ReceiptIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-4.96.44 2.5 2.5 0 01-2.96-3.08 3 3 0 01-.34-5.58 2.5 2.5 0 011.32-4.24 2.5 2.5 0 011.98-3A2.5 2.5 0 019.5 2zM14.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 004.96.44 2.5 2.5 0 002.96-3.08 3 3 0 00.34-5.58 2.5 2.5 0 00-1.32-4.24 2.5 2.5 0 00-1.98-3A2.5 2.5 0 0014.5 2z"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-8 w-8"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}