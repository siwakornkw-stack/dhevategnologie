'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface ReceiptData {
  bookingId: string;
  fieldName: string;
  sportType: string;
  date: string;
  timeSlot: string;
  userName: string;
  userEmail: string;
  pricePerHour: number;
  totalAmount: number;
  discountAmount?: number;
  couponCode?: string;
  status: string;
  createdAt: string;
}

export function DownloadReceiptButton({ booking }: { booking: ReceiptData }) {
  const t = useTranslations('common');
  const [loading, setLoading] = useState(false);

  function handleDownload() {
    setLoading(true);
    try {
      const id = booking.bookingId.slice(-8).toUpperCase();
      const dateStr = new Date(booking.date).toLocaleDateString('th-TH', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      const createdStr = new Date(booking.createdAt).toLocaleString('th-TH');
      const original = booking.totalAmount + (booking.discountAmount ?? 0);

      const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <title>ใบเสร็จ #${id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Sarabun', 'Tahoma', sans-serif; background: #f3f4f6; padding: 32px; color: #1e1e1e; }
    .page { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.10); }
    .header { background: linear-gradient(135deg,#6366f1,#8b5cf6); padding: 28px 32px; color: #fff; }
    .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .header p { font-size: 13px; opacity: 0.85; }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; }
    .ref { text-align: right; font-size: 12px; opacity: 0.85; }
    .ref strong { font-size: 16px; display: block; }
    .badge { display: inline-block; background: #22c55e; color: #fff; border-radius: 999px; padding: 3px 14px; font-size: 12px; font-weight: 700; margin: 20px 32px 0; }
    .body { padding: 24px 32px 32px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 12px; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 0.06em; padding-bottom: 6px; border-bottom: 1.5px solid #e5e7eb; margin-bottom: 12px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .row .label { color: #6b7280; }
    .row .value { font-weight: 600; text-align: right; max-width: 60%; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
    .total-box { background: linear-gradient(135deg,#6366f1,#8b5cf6); border-radius: 10px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; color: #fff; }
    .total-box .label { font-size: 14px; font-weight: 600; }
    .total-box .amount { font-size: 22px; font-weight: 800; }
    .footer { text-align: center; font-size: 11px; color: #9ca3af; padding: 16px 32px 24px; border-top: 1px solid #f3f4f6; }
    @media print {
      body { background: #fff; padding: 0; }
      .page { box-shadow: none; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-row">
        <div>
          <h1>🏟️ 88ARENA</h1>
          <p>ใบเสร็จรับเงิน / Receipt</p>
        </div>
        <div class="ref">
          <strong>#${id}</strong>
          ${createdStr}
        </div>
      </div>
    </div>
    <div class="badge">${booking.status === 'APPROVED' ? '✅ อนุมัติแล้ว' : booking.status}</div>
    <div class="body">
      <div class="section">
        <div class="section-title">รายละเอียดการจอง</div>
        <div class="row"><span class="label">สนาม</span><span class="value">${booking.fieldName}</span></div>
        <div class="row"><span class="label">ประเภทกีฬา</span><span class="value">${booking.sportType}</span></div>
        <div class="row"><span class="label">วันที่</span><span class="value">${dateStr}</span></div>
        <div class="row"><span class="label">เวลา</span><span class="value">${booking.timeSlot} น.</span></div>
      </div>
      <div class="section">
        <div class="section-title">ข้อมูลผู้จอง</div>
        <div class="row"><span class="label">ชื่อ</span><span class="value">${booking.userName}</span></div>
        <div class="row"><span class="label">อีเมล</span><span class="value">${booking.userEmail}</span></div>
      </div>
      <div class="section">
        <div class="section-title">สรุปการชำระเงิน</div>
        <div class="row"><span class="label">ค่าจองสนาม</span><span class="value">฿${original.toLocaleString()}</span></div>
        ${booking.discountAmount && booking.discountAmount > 0 ? `<div class="row"><span class="label">ส่วนลด${booking.couponCode ? ` (${booking.couponCode})` : ''}</span><span class="value" style="color:#16a34a">-฿${booking.discountAmount.toLocaleString()}</span></div>` : ''}
        <hr class="divider" />
        <div class="total-box">
          <span class="label">ยอดรวมสุทธิ</span>
          <span class="amount">฿${booking.totalAmount.toLocaleString()}</span>
        </div>
      </div>
    </div>
    <div class="footer">
      ขอบคุณที่ใช้บริการ 88ARENA — กรุณาแสดงใบเสร็จนี้เมื่อเข้าใช้สนาม<br/>
      สร้างเมื่อ: ${new Date().toLocaleString('th-TH')}
    </div>
  </div>
</body>
</html>`;

      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:800px;height:600px;border:0;';
      document.body.appendChild(iframe);
      const iframeDoc = iframe.contentDocument ?? iframe.contentWindow?.document;
      if (!iframeDoc) return;
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="text-xs px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50 flex items-center gap-1"
    >
      {loading ? '⏳' : '🧾'} {loading ? t('generating') : t('receipt')}
    </button>
  );
}
