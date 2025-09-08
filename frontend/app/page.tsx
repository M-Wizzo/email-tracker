"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { api, post } from "../lib/api";
import { formatDateTime, truncate } from "../lib/format";
import CopyButton from "../components/CopyButton";

type EmailRow = { id: string; subject: string; recipient: string; sent_at: string; opens: number; clicks: number; pixel?: string };

export default function Page() {
  const [emails, setEmails] = useState<EmailRow[] | null>(null);
  const [error, setError] = useState<string>("");
  const [form, setForm] = useState<{ id: string; subject: string; recipient: string; sent_at: string }>({
    id: nanoid ? nanoid() : "",
    subject: "",
    recipient: "",
    sent_at: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data: EmailRow[] = await api("/emails");
        if (mounted) setEmails(data);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Error cargando datos");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setForm((f) => ({ ...f, sent_at: new Date().toISOString() }));
  }, []);

  const isLoading = !emails && !error;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Emails</h1>

      <div className="mb-4 text-xs text-gray-600">Solo para desarrollo</div>

      <form
        className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3 border rounded p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setFeedback("");
          setError("");
          if (!form.id.trim()) {
            setError("ID requerido");
            return;
          }
          if (!form.recipient.trim()) {
            setError("Recipient requerido");
            return;
          }
          setSubmitting(true);
          try {
            await post("/emails", {
              id: form.id.trim(),
              subject: form.subject.trim(),
              recipient: form.recipient.trim(),
              sent_at: form.sent_at?.trim() || new Date().toISOString(),
            });
            setFeedback("Creado");
            setForm({ id: "", subject: "", recipient: "", sent_at: new Date().toISOString() });
            const data: EmailRow[] = await api("/emails");
            setEmails(data);
          } catch (e: any) {
            setError(e?.message || "Error al crear");
          } finally {
            setSubmitting(false);
            setTimeout(() => setFeedback(""), 1200);
          }
        }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-700">ID</label>
          <div className="flex gap-2">
            <input
              className="w-full rounded border px-2 py-1 text-sm"
              value={form.id}
              onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
              placeholder="demo-1699999999"
            />
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
              onClick={() => setForm((f) => ({ ...f, id: `demo-${Date.now()}` }))}
            >
              Generar ID
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-700">Subject</label>
          <input
            className="rounded border px-2 py-1 text-sm"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            placeholder="Asunto"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-700">Recipient</label>
          <input
            type="email"
            className="rounded border px-2 py-1 text-sm"
            value={form.recipient}
            onChange={(e) => setForm((f) => ({ ...f, recipient: e.target.value }))}
            placeholder="user@example.com"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-700">Sent at (ISO)</label>
          <input
            className="rounded border px-2 py-1 text-sm"
            value={form.sent_at || ""}
            onChange={(e) => setForm((f) => ({ ...f, sent_at: e.target.value }))}
            inputMode="text"
            suppressHydrationWarning
          />
        </div>
        <div className="md:col-span-2 flex items-center gap-2">
          <button
            type="submit"
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? "Creando…" : "Crear email"}
          </button>
          {feedback && <span className="text-xs text-green-700">{feedback}</span>}
        </div>
      </form>

      {isLoading && (
        <div className="text-sm text-gray-600">Cargando…</div>
      )}

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {emails && emails.length === 0 && (
        <div className="rounded border p-6 text-center text-sm text-gray-600">No hay emails aún.</div>
      )}

      {emails && emails.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-2 border-b border-gray-300">Asunto</th>
                <th className="text-left p-2 border-b border-gray-300">Destinatario</th>
                <th className="text-left p-2 border-b border-gray-300">Fecha envío</th>
                <th className="text-left p-2 border-b border-gray-300">Aperturas</th>
                <th className="text-left p-2 border-b border-gray-300">Clics</th>
                <th className="text-left p-2 border-b border-gray-300">Pixel</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((e) => {
                const apiBase = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/?api\/?$/, '');
                const pixelUrl = e.pixel || `${apiBase || 'http://127.0.0.1:5055'}/pixel?id=${e.id}`;
                const snippet = `<img src="${pixelUrl}" width="1" height="1" style="display:none;">`;
                return (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="p-2 border-b border-gray-200">
                      <Link href={`/email/${e.id}`} className="text-blue-600 hover:underline">
                        {e.subject || "(sin asunto)"}
                      </Link>
                    </td>
                    <td className="p-2 border-b border-gray-200">{truncate(e.recipient, 60)}</td>
                    <td className="p-2 border-b border-gray-200">{formatDateTime(e.sent_at)}</td>
                    <td className="p-2 border-b border-gray-200">{e.opens || 0}</td>
                    <td className="p-2 border-b border-gray-200">{e.clicks || 0}</td>
                    <td className="p-2 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <code className="text-xs break-all">{snippet}</code>
                        <CopyButton text={snippet} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
