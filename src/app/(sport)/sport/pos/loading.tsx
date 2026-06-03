export default function PosLoading() {
  return (
    <div className="wrapper py-6 max-w-7xl animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-2">
          <div className="h-3 w-16 bg-gray-200 dark:bg-gray-800 rounded" />
          <div className="h-7 w-40 bg-gray-200 dark:bg-gray-800 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          <div className="h-9 w-24 bg-gray-200 dark:bg-gray-800 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-lg border dark:border-gray-700 overflow-hidden">
                <div className="h-24 bg-gray-200 dark:bg-gray-800" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded" />
                  <div className="h-4 w-16 bg-gray-200 dark:bg-gray-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 p-4 space-y-3 h-fit">
          <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-2/3" />
          <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
          <div className="space-y-2 pt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 dark:bg-gray-800/50 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
