const stats = [
  { value: '15K+', label: 'Active Users' },
  { value: '1.2M+', label: 'Documents Created' },
  { value: '50+', label: 'AI Tools' },
  { value: '99.9%', label: 'Uptime' },
];

export default function Stats() {
  return (
    <section className="py-20 bg-[#07070f] border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent mb-2">
                {s.value}
              </div>
              <div className="text-gray-400 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
