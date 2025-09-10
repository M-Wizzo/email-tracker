"use client";

export default function Error({ error }: { error: Error }) {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {error?.message || "Error cargando el detalle"}
      </div>
    </main>
  );
}




