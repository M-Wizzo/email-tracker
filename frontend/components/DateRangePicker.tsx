"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

function fmt(d: Date) { return d.toISOString().slice(0,10); }

export default function DateRangePicker() {
  const router = useRouter();
  const search = useSearchParams();
  const pathname = usePathname();
  const fromQ = search.get("from") || "";
  const toQ   = search.get("to")   || "";

  function setRange(from: string, to: string) {
    const usp = new URLSearchParams(search.toString());
    if (from) usp.set("from", from); else usp.delete("from");
    if (to) usp.set("to", to); else usp.delete("to");
    router.push(`${pathname}?${usp.toString()}`);
  }

  function quick(days: number) {
    const to = new Date();
    const from = new Date(to.getTime() - days*24*60*60*1000);
    setRange(fmt(from), fmt(to));
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex items-center gap-2">
        <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" onClick={() => quick(7)}>7d</button>
        <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" onClick={() => quick(14)}>14d</button>
        <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" onClick={() => quick(30)}>30d</button>
        <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" onClick={() => quick(90)}>90d</button>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-600">From</label>
          <input type="date" className="rounded border px-2 py-1 text-sm" value={fromQ} onChange={(e) => setRange(e.target.value, toQ)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-600">To</label>
          <input type="date" className="rounded border px-2 py-1 text-sm" value={toQ} onChange={(e) => setRange(fromQ, e.target.value)} />
        </div>
      </div>
    </div>
  );
}




