import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AdminChatClient } from './admin-chat-client';

export const metadata = { title: 'Admin Chat' };

export default async function AdminChatPage() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') redirect('/sport');

  return (
    <div className="wrapper py-6 max-w-6xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">💬 แชทกับลูกค้า</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">ตอบคำถาม/ช่วยเหลือผู้ใช้งาน</p>
      </div>
      <div className="h-[calc(100vh-11rem)] min-h-[500px]">
        <AdminChatClient currentUserId={session.user.id} />
      </div>
    </div>
  );
}
