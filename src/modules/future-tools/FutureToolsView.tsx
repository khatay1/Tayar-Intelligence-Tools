export default function FutureToolsView({ darkMode: _darkMode }: { darkMode: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
        <span className="text-3xl">🚀</span>
      </div>
      <h2 className="text-white text-lg font-bold mb-1">Coming Soon</h2>
      <p className="text-gray-500 text-sm max-w-md">
        This tool is under active development. You'll be notified when it's ready.
      </p>
    </div>
  );
}
