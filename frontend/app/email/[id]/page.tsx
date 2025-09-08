import { api } from "../../../lib/api";
import CopyButton from "../../../components/CopyButton";
import { formatDateTime } from "../../../lib/format";

export default async function EmailDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const data: { email: { id: string; subject: string; recipient: string; sent_at: string }; events: Array<{ type: string; timestamp: string; ip: string; user_agent: string }>; pixel?: string; click_template?: string; click_example?: string; } = await api(`/emails/${id}`);
  const { email, events } = data;

  const pixelUrl = data.pixel || `${(process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/?api\/?$/, '') || 'http://127.0.0.1:5055'}/pixel?id=${email.id}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;">`;
  const click = data.click_example || `${(process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/?api\/?$/, '') || 'http://127.0.0.1:5055'}/click?id=${email.id}&url=${encodeURIComponent("https://timeback.es").toString()}`;

  const opens = events.filter((e) => e.type === "open").length;
  const clicks = events.filter((e) => e.type === "click").length;
  const firstOpen = events.find((e) => e.type === "open");
  const lastOpen = [...events].reverse().find((e) => e.type === "open");

  return (
    <main className="mx-auto max-w-5xl p-6">
      <a href="/" className="text-blue-600 hover:underline">← Volver</a>
      <h1 className="text-2xl font-semibold mt-2 mb-4">Detalle email</h1>

      <div className="space-y-1 mb-6">
        <div><span className="font-medium">ID:</span> {email.id}</div>
        <div><span className="font-medium">Asunto:</span> {email.subject || "(sin asunto)"}</div>
        <div><span className="font-medium">Destinatario:</span> {email.recipient}</div>
        <div><span className="font-medium">Fecha envío:</span> {formatDateTime(email.sent_at)}</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="border rounded p-3">
          <div className="text-sm text-gray-600">Aperturas</div>
          <div className="text-xl font-semibold">{opens}</div>
        </div>
        <div className="border rounded p-3">
          <div className="text-sm text-gray-600">Clics</div>
          <div className="text-xl font-semibold">{clicks}</div>
        </div>
        <div className="border rounded p-3">
          <div className="text-sm text-gray-600">Primera apertura</div>
          <div className="text-sm">{firstOpen ? new Date(firstOpen.timestamp).toLocaleString() : "-"}</div>
        </div>
        <div className="border rounded p-3">
          <div className="text-sm text-gray-600">Última apertura</div>
          <div className="text-sm">{lastOpen ? new Date(lastOpen.timestamp).toLocaleString() : "-"}</div>
        </div>
      </div>

      <div className="mb-6 space-y-2">
        <div>
          <div className="font-medium">Pixel</div>
          <div className="flex items-center gap-2">
            <code className="text-xs break-all">{pixel}</code>
            <CopyButton text={pixel} />
          </div>
        </div>
        <div>
          <div className="font-medium">Ejemplo click</div>
          <div className="flex items-center gap-2">
            <code className="text-xs break-all">{click}</code>
            <CopyButton text={click} />
          </div>
          <div>
            <a className="text-blue-600 hover:underline" href={click} target="_blank">Probar click</a>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-2">Eventos</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2 border-b border-gray-300">Tipo</th>
              <th className="text-left p-2 border-b border-gray-300">Timestamp</th>
              <th className="text-left p-2 border-b border-gray-300">IP</th>
              <th className="text-left p-2 border-b border-gray-300">User-Agent</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="p-2 border-b border-gray-200">{ev.type}</td>
                <td className="p-2 border-b border-gray-200">{formatDateTime(ev.timestamp)}</td>
                <td className="p-2 border-b border-gray-200">{ev.ip}</td>
                <td className="p-2 border-b border-gray-200">{ev.user_agent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
