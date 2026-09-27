"use client";

export function SettingsModal({
  open,
  onClose,
  userEmail,
}: {
  open: boolean;
  onClose: () => void;
  userEmail?: string;
}) {
  if (!open) return null;

  // ✅ معلومات التواصل
  const whatsappNumber = "34743091131"; // +34 743 091 131
  const supportEmail = "ahmedbachare95@gmail.com";

  const whatsappMessage = encodeURIComponent(
    "Hola, necesito ayuda con CaducaScan. Mi problema es: "
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">⚙️ Ajustes</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {/* معلومات التطبيق */}
        <div className="mb-4 rounded-xl bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-800">CaducaScan</p>
          <p className="text-xs text-slate-500">
            Control de caducidades · v1.0
          </p>
          {userEmail && (
            <p className="mt-1 truncate text-xs text-slate-500">
              👤 {userEmail}
            </p>
          )}
        </div>

        {/* قسم الدعم */}
        <div className="mb-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">
            💬 Soporte técnico
          </p>
          <p className="mb-3 text-xs text-slate-500">
            ¿Tienes alguna pregunta o problema? Contáctanos:
          </p>

          {/* الإيميل */}
          <a
            href={`mailto:${supportEmail}?subject=CaducaScan - Ayuda`}
            className="mb-2 flex items-center gap-3 rounded-xl border-2 border-slate-200 p-3 transition hover:border-blue-500 hover:bg-blue-50"
          >
            <span className="text-2xl">📧</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">Email</p>
              <p className="truncate text-xs text-slate-500">
                {supportEmail}
              </p>
            </div>
          </a>

          {/* الواتساب */}
          <a
            href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border-2 border-slate-200 p-3 transition hover:border-green-500 hover:bg-green-50"
          >
            <span className="text-2xl">💬</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">WhatsApp</p>
              <p className="truncate text-xs text-slate-500">
                +34 743 091 131
              </p>
            </div>
          </a>
        </div>

        {/* زر الإغلاق */}
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-slate-100 py-2 text-sm"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}