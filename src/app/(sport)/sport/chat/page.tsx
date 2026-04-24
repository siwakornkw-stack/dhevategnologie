import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { ChatWindow } from '@/components/sport/chat-window';

export const metadata = { title: 'แชทกับแอดมิน' };

export default async function ChatPage() {
  const session = await auth();
  if (!session) redirect('/sport/auth/signin?callbackUrl=/sport/chat');

  return (
    <div className="wrapper py-6 max-w-3xl">
      <div className="h-[calc(100vh-9rem)] min-h-[500px]">
        <ChatWindow
          currentUserId={session.user.id}
          title="💬 แชทกับแอดมิน"
          subtitle="ทีมงานจะตอบกลับภายใน 1-2 ชั่วโมง"
        />
      </div>
    </div>
  );
}
