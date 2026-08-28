import { useLandingCopy } from '@/lib/landing-copy';

export default function Stats() {
  const stats = useLandingCopy().stats;
  return (
    <section className="border-y border-white/[0.06] bg-[#080811] py-10 sm:py-12" aria-label="Product facts">
      <div className="site-container grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([value, label]) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-5 text-center">
            <div className="text-xl font-black tracking-tight text-white sm:text-2xl">{value}</div>
            <div className="mt-1.5 text-xs font-medium text-gray-500 sm:text-sm">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
