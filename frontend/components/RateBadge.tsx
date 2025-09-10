export default function RateBadge({ value }: { value: number }) {
  const pct = Math.round((value || 0) * 1000) / 10; // 1 decimal
  const tone = value >= 0.5 ? 'bg-green-100 text-green-800' : value >= 0.2 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${tone}`}>{pct}%</span>
  );
}




