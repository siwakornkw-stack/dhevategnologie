import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-primary-500 to-violet-600 mb-4">
          404
        </div>
        <div className="text-5xl mb-6">🏟️</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          ไม่พบหน้านี้
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          หน้าที่คุณกำลังมองหาไม่มีอยู่ หรืออาจถูกย้ายไปแล้ว
        </p>
        <Link
          href="/sport"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary-600 to-violet-600 text-white font-semibold hover:opacity-90 transition"
        >
          กลับหน้าหลัก 88ARENA
        </Link>
      </div>
    </div>
  );
}
