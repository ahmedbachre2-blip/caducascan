"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isoDateOffset, estimateExpiryDays } from "@/lib/expiration";
import type { ProductDraft } from "@/lib/types";

type Step = "camera" | "loading" | "results" | "error";

type ExtractedItem = {
  name: string;
  expirationDate: string | null;
  price?: number;
  quantity?: number;
};

// ✅ دالة ضغط الصور لتجنب خطأ 413 على Vercel
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
        const base64 = dataUrl.split(",")[1];
        resolve(base64);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

// ✅ دالة تحويل Base64 إلى File (لإعادة استخدام compressImage)
const base64ToFile = (base64: string, filename: string): File => {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new File([ab], filename, { type: "image/jpeg" });
};

export function ScannerModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (drafts: ProductDraft[]) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("camera");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<ExtractedItem[]>([]);

  // ✅ إيقاف الكاميرا
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // ✅ تحليل الصورة عبر الـ API
  const analyzeImage = useCallback(async (base64: string) => {
    setStep("loading");
    setMessage("Analizando factura...");

    try {
      const res = await fetch("/api/extract-receipt", {
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

      const extractedItems: ExtractedItem[] = (data.items || []).map(
        (item: any) => ({
          name: item.name || "Producto sin nombre",
          expirationDate: item.expirationDate || null,
          price: item.totalPrice || item.price || 0,
          quantity: item.quantity || 1,
        })
      );

      if (extractedItems.length === 0) {
        setMessage("No se encontraron productos en la factura. Intenta con una foto más clara.");
        setStep("error");
        return;
      }

      setItems(extractedItems);
      setStep("results");
    } catch {
      setMessage("Error de conexión. Verifica tu internet.");
      setStep("error");
    }
  }, []);

  // ✅ التقاط صورة من الكاميرا
  const captureFromCamera = useCallback(async () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const base64 = dataUrl.split(",")[1];

    stopCamera();
    await analyzeImage(base64);
  }, [analyzeImage, stopCamera]);

  // ✅ اختيار صورة من المعرض
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

  // ✅ إدارة فتح/إغلاق النافذة والكاميرا
  useEffect(() => {
    if (!open) {
      stopCamera();
      setStep("camera");
      setItems([]);
      setMessage("");
      return;
    }

    setStep("camera");
    setItems([]);

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
        setMessage("No se pudo acceder a la cámara. Verifica los permisos del navegador.");
        setStep("error");
      }
    };

    const timer = window.setTimeout(() => {
      void startCamera();
    }, 100);

    return () => {
      window.clearTimeout(timer);
      stopCamera();
    };
  }, [open, stopCamera]);

  // ✅ تحديث عنصر معين في القائمة
  const updateItem = (index: number, field: keyof ExtractedItem, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // ✅ حذف عنصر من القائمة
  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // ✅ حفظ جميع المنتجات
  const handleSaveAll = () => {
    const drafts: ProductDraft[] = items.map((item) => ({
      barcode: "",
      name: item.name,
      category: "otros",
      brand: "",
      imageUrl: "",
      expirationDate:
        item.expirationDate || isoDateOffset(estimateExpiryDays(item.name)),
      price: item.price || 0,
      quantity: item.quantity || 1,
    }));

    onSave(drafts);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {step === "camera" && "Leer Factura"}
            {step === "loading" && "Analizando..."}
            {step === "results" && `${items.length} productos encontrados`}
            {step === "error" && "Error"}
          </h2>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="rounded-full px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </div>

        {/* ====== خطوة الكاميرا ====== */}
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

              {/* إطار التوجيه */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[80%] w-[85%] rounded-2xl border-2 border-green-400/60" />
              </div>

              {/* نص التعليمات */}
              <div className="pointer-events-none absolute bottom-4 left-0 right-0 text-center">
                <p className="mx-auto inline-block rounded-full bg-black/60 px-4 py-1.5 text-xs text-white">
                  Coloca la factura dentro del marco
                </p>
              </div>
            </div>

            {/* أزرار التحكم */}
            <div className="mt-4 flex items-center justify-center gap-4">
              {/* زر المعرض */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl text-slate-600 hover:bg-slate-200"
                aria-label="Galería"
              >
                🖼️
              </button>

              {/* زر التصوير */}
              <button
                type="button"
                onClick={captureFromCamera}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-green-600 text-white shadow-lg ring-4 ring-green-200 hover:bg-green-700"
                aria-label="Capturar"
              >
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
              </button>

              {/* مساحة فارغة للتوازن البصري */}
              <div className="h-14 w-14" />
            </div>

            <p className="mt-3 text-center text-xs text-slate-500">
              Toma una foto clara de la factura o selecciona una del galería
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleGalleryUpload}
              className="hidden"
            />
          </div>
        )}

        {/* ====== خطوة التحميل ====== */}
        {step === "loading" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-600 border-t-transparent"></div>
            <p className="mt-4 text-sm text-slate-600">{message}</p>
            <p className="mt-1 text-xs text-slate-400">
              Esto puede tardar unos segundos
            </p>
          </div>
        )}

        {/* ====== خطوة الخطأ ====== */}
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
              className="w-full rounded-xl bg-green-600 py-3 text-sm font-medium text-white hover:bg-green-700"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* ====== خطوة النتائج ====== */}
        {step === "results" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Revisa y edita los productos antes de guardar. Puedes cambiar el
              nombre o la fecha.
            </p>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-2">
                      {/* اسم المنتج */}
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) =>
                          updateItem(index, "name", e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Nombre del producto"
                      />

                      {/* التاريخ والسعر */}
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={item.expirationDate || ""}
                          onChange={(e) =>
                            updateItem(index, "expirationDate", e.target.value)
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={item.price || ""}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "price",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="Precio €"
                        />
                      </div>

                      {!item.expirationDate && (
                        <p className="text-[10px] text-amber-600">
                          ⚠️ Sin fecha - se estimará automáticamente
                        </p>
                      )}
                    </div>

                    {/* زر الحذف */}
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100"
                      aria-label="Eliminar"
                    >
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
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* أزرار الحفظ والإلغاء */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep("camera");
                  setItems([]);
                }}
                className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={items.length === 0}
                className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                Guardar {items.length} productos
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}