import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SPORT_TYPE_EMOJI, SPORT_TYPE_LABELS } from '@/lib/booking';
import { AdminFieldActions } from './admin-field-actions';
import { AddFieldForm } from './add-field-form';
import { EditFieldForm } from './edit-field-form';
import { BlockedDatesManager } from './blocked-dates-manager';

export const metadata = { title: 'จัดการสนาม' };

export default async function AdminFieldsPage() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') redirect('/sport');

  const fields = await prisma.field.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } });

  return (
    <div className="wrapper py-8 max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <a href="/sport/admin" className="text-sm text-gray-400 hover:text-gray-600">← Dashboard</a>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🏟️ จัดการสนามกีฬา</h1>
      </div>

      <AddFieldForm />

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">สนามทั้งหมด ({fields.length})</span>
        </div>
        {fields.length === 0 ? (
          <div className="p-10 text-center text-gray-400">ยังไม่มีสนาม เพิ่มสนามด้านบนได้เลย</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {fields.map((field) => (
              <div key={field.id} className="px-5 py-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl flex-shrink-0">
                  {SPORT_TYPE_EMOJI[field.sportType]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white">{field.name}</p>
                    {!field.isActive && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-400">ปิด</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {SPORT_TYPE_LABELS[field.sportType]} · ฿{field.pricePerHour.toLocaleString()}/ชม. · {field.openTime}–{field.closeTime}
                  </p>
                  {field.location && <p className="text-xs text-gray-400">📍 {field.location}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <BlockedDatesManager fieldId={field.id} fieldName={field.name} />
                  <EditFieldForm field={{ id: field.id, name: field.name, sportType: field.sportType, pricePerHour: field.pricePerHour, location: field.location, description: field.description, facilities: field.facilities, imageUrl: field.imageUrl, images: field.images, openTime: field.openTime, closeTime: field.closeTime, isActive: field.isActive }} />
                  <AdminFieldActions fieldId={field.id} fieldName={field.name} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
