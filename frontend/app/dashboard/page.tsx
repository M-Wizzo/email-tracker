import Link from "next/link";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import DateRangePicker from "../../components/DateRangePicker";
import StatCard from "../../components/StatCard";
import RateBadge from "../../components/RateBadge";
import Sparkline from "../../components/Sparkline";

type Stats = {
  ok: boolean;
  range: { from: string; to: string };
  totals: {
    emails: number;
    opens_unique: number;
    opens_total: number;
    clicks_unique: number;
    clicks_total: number;
    open_rate: number;
    ctr: number;
  };
  timeline: Array<{ date: string; emails: number; opens_unique: number; clicks_unique: number }>;
};

type SummaryRow = { id: string; subject: string; recipient: string; sent_at: string; opens: number; clicks: number };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const spObj = await searchParams;
  const sp = (() => {
    const qs = new URLSearchParams();
    if (spObj?.from) qs.set("from", spObj.from);
    if (spObj?.to) qs.set("to", spObj.to);
    const s = qs.toString();
    return s ? `?${s}` : "";
  })();

  const stats: Stats = await api(`/stats${sp}`);
  const rows: SummaryRow[] = await api(`/emails/summary${sp}`);

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <DateRangePicker />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard title="Total enviados" value={stats.totals.emails} />
        <StatCard title="Aperturas únicas" value={stats.totals.opens_unique} />
        <StatCard title="Clicks únicos" value={stats.totals.clicks_unique} />
        <StatCard title="Open rate" value={<RateBadge value={stats.totals.open_rate} />} />
        <StatCard title="CTR" value={<RateBadge value={stats.totals.ctr} />} />
      </div>

      <div className="border rounded p-4">
        <div className="mb-2 text-sm font-medium">Actividad</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-600 mb-1">Aperturas (únicos)</div>
            <Sparkline data={stats.timeline.map(t => t.opens_unique)} />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Clicks (únicos)</div>
            <Sparkline data={stats.timeline.map(t => t.clicks_unique)} />
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">Diario (únicos)</div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2 border-b border-gray-300">ID</th>
              <th className="text-left p-2 border-b border-gray-300">Subject</th>
              <th className="text-left p-2 border-b border-gray-300">Recipient</th>
              <th className="text-left p-2 border-b border-gray-300">Sent at</th>
              <th className="text-left p-2 border-b border-gray-300">Opens</th>
              <th className="text-left p-2 border-b border-gray-300">Clicks</th>
              <th className="text-left p-2 border-b border-gray-300">Open rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="p-2 border-b border-gray-200">
                  <Link className="text-blue-600 hover:underline" href={`/email/${r.id}`}>{r.id}</Link>
                </td>
                <td className="p-2 border-b border-gray-200">{r.subject || "(sin asunto)"}</td>
                <td className="p-2 border-b border-gray-200">{r.recipient}</td>
                <td className="p-2 border-b border-gray-200">{formatDateTime(r.sent_at)}</td>
                <td className="p-2 border-b border-gray-200">{r.opens || 0}</td>
                <td className="p-2 border-b border-gray-200">{r.clicks || 0}</td>
                <td className="p-2 border-b border-gray-200">{r.opens > 0 ? <RateBadge value={1} /> : <RateBadge value={0} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}


