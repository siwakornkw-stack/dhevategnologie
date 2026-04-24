import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { ChatWindow } from '@/components/sport/chat-window';

export const metadata = { title: 'Chat' };

export default async function ChatPage() {
  const session = await auth();
  if (!session) redirect('/sport/auth/signin?callbackUrl=/sport/chat');

  const t = await getTranslations('chat');

  return (
    <div className="wrapper py-6 max-w-3xl">
      <div className="h-[calc(100vh-9rem)] min-h-[500px]">
        <ChatWindow
          currentUserId={session.user.id}
          title={t('title')}
          subtitle={t('subtitle')}
        />
      </div>
    </div>
  );
}
