'use client';

import { useState } from 'react';

export function QrCodeButton({ bookingId, fieldName, date, timeSlot }: {
  bookingId: string;
  fieldName: string;
  date: string;
  timeSlot: string;
}) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState('');

  async function handleOpen() {
    setOpen(true);
    if (!dataUrl) {
      try {
        const QRCode = (await import('qrcode')).default;
        const url = await QRCode.toDataURL(`88ARENA:${bookingId}`, { width: 220, margin: 2, color: { dark: '#1f2937', light: '#ffffff' } });
        setDataUrl(url);
      } catch {
        // ignore
      }
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
      >
        QR
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl text-center max-w-xs w-full">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">{fieldName}</h3>
            <p className="text-xs text-gray-400 mb-4">{date} · {timeSlot} น.</p>
            {dataUrl ? (
              <img src={dataUrl} alt="QR Code" className="mx-auto rounded-xl border border-gray-100 dark:border-gray-800" />
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">กำลังสร้าง QR...</div>
            )}
            <p className="text-xs text-gray-400 mt-3">Booking ID: {bookingId.slice(-8).toUpperCase()}</p>
            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </>
  );
}
