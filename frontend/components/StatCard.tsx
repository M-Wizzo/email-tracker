export default function StatCard({ title, value, help }: { title: string; value: React.ReactNode; help?: string }) {
  return (
    <div className="border rounded p-3">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
      {help ? <div className="text-xs text-gray-500 mt-1">{help}</div> : null}
    </div>
  );
}



