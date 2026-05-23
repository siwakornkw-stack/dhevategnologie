import { redirect } from 'next/navigation';
import { requirePosRole, getPosSettings } from '@/lib/pos';
import { SettingsClient } from './settings-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'POS Settings' };

export default async function PosSettingsPage() {
  const session = await requirePosRole(['ADMIN']);
  if (!session) redirect('/sport');

  const settings = await getPosSettings();
  const initialSettings = {
    ...settings,
    printerType: settings.printerType as 'BROWSER' | 'ESCPOS',
    vatMode: settings.vatMode as 'NONE' | 'INCLUDED' | 'EXCLUDED',
  };
  return <SettingsClient initialSettings={initialSettings} />;
}
