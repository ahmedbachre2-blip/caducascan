import type { ExpirationStatus } from "@/lib/types";

const CARDS: {
  key: ExpirationStatus;
  label: string;
  hint: string;
  accent: string;
  bg: string;
  icon: string;
}[] = [
  {
    key: "urgente",
    label: "Urgente",
    hint: "≤ 14 días",
    accent: "text-red-600",
    bg: "bg-red-50 ring-red-100",
    icon: "🔴",
  },
  {
    key: "pronto",
    label: "Pronto",
    hint: "15–25 días",
    accent: "text-amber-600",
    bg: "bg-amber-50 ring-amber-100",
    icon: "🟠",
  },
  {
    key: "ok",
    label: "OK",
    hint: "> 26 días",
    accent: "text-fresh-700",
    bg: "bg-fresh-50 ring-fresh-100",
    icon: "🟢",
  },
];

type MoneyAtRisk = {
  urgent: number;
  soon: number;
  ok: number;
  total: number;
};

export function SummaryCards({
  counts,
  moneyAtRisk = { urgent: 0, soon: 0, ok: 0, total: 0 },
}: {
  counts: Record<ExpirationStatus, number>;
  moneyAtRisk?: MoneyAtRisk;
}) {
  const formatMoney = (value: number) =>
    value > 0 ? `${value.toFixed(2)}€` : "0€";

  return (
    <section className="space-y-3">
      <article className="rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 p-4 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide opacity-90">
              💰 Dinero en Riesgo
            </p>
            <p className="mt-1 text-3xl font-bold">
              {formatMoney(moneyAtRisk.total)}
            </p>
          </div>
          <div className="text-right text-xs opacity-90">
            <p>Esta semana</p>
            <p className="font-semibold">¡Actúa ahora!</p>
          </div>
        </div>
        {moneyAtRisk.total > 0 && (
          <p className="mt-2 text-xs opacity-90">
            Productos que caducan en los próximos 25 días
          </p>
        )}
      </article>

      <div className="grid grid-cols-3 gap-2">
        {CARDS.map((card) => {
          const count = counts[card.key];
          const money =
            card.key === "urgente"
              ? moneyAtRisk.urgent
              : card.key === "pronto"
              ? moneyAtRisk.soon
              : moneyAtRisk.ok;

          return (
            <article
              key={card.key}
              className={`rounded-2xl p-3 ring-1 ${card.bg}`}
            >
              <p className={`text-2xl font-semibold leading-none ${card.accent}`}>
                {count}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {card.icon} {card.label}
              </p>
              <p className="text-[11px] text-slate-500">{card.hint}</p>
              {money > 0 && (
                <p className={`mt-1 text-xs font-semibold ${card.accent}`}>
                  {formatMoney(money)}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}