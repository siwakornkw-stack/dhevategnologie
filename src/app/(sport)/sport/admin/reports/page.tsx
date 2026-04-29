'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { SPORT_TYPE_LABELS, SPORT_TYPE_EMOJI, STATUS_LABELS, STATUS_COLORS } from '@/lib/booking';
import { ReportCharts } from '@/components/sport/report-charts';

type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
type SportType = 'FOOTBALL' | 'BASKETBALL' | 'BADMINTON' | 'TENNIS' | 'VOLLEYBALL' | 'SWIMMING' | 'OTHER';

interface ReportBooking {
  id: string;
  date: string;
  timeSlot: string;
  status: BookingStatus;
  note: string | null;
  createdAt: string;
  user: { name: string | null; email: string; phone: string | null };
  field: { name: string; sportType: SportType; pricePerHour: number };
}

interface ReportData {
  bookings: ReportBooking[];
  summary: {
    total: number;
    byStatus: Record<BookingStatus, number>;
    totalRevenue: number;
    cancelledRevenue: number;
    netRevenue: number;
  };
  bySportType: { sportType: string; count: number; revenue: number }[];
  byField: { name: string; sportType: string; count: number; revenue: number; approved: number }[];
  byHour: { hour: number; count: number }[];
  byDayOfWeek: { day: string; count: number; revenue: number }[];
  byFieldTrend: { fieldId: string; fieldName: string; data: { date: string; revenue: number }[] }[];
  heatmap: { day: number; hour: number; count: number }[];
  occupancyByField: { fieldId: string; fieldName: string; sportType: string; occupancyRate: number; hoursBooked: number; totalSlots: number }[];
}

const SPORT_OPTIONS = [
  { value: 'ALL', label: 'ทุกประเภท' },
  ...Object.entries(SPORT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'ทุกสถานะ' },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function monthAgoISO() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().split('T')[0];
}

export default function ReportsPage() {
  const [from, setFrom] = useState(monthAgoISO());
  const [to, setTo] = useState(todayISO());
  const [status, setStatus] = useState('ALL');
  const [sportType, setSportType] = useState('ALL');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ from, to, status, sportType });
    const res = await fetch(`/api/sport/admin/reports?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [from, to, status, sportType]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  function buildExportUrl() {
    const params = new URLSearchParams({ from, to, status, sportType });
    return `/api/sport/admin/export?${params}`;
  }

  const maxCount = data?.bySportType.reduce((m, s) => Math.max(m, s.count), 0) ?? 1;

  function exportPDF() {
    if (!data) return;

    const rows = data.bookings.map(b => `
      <tr>
        <td>${b.field.name}</td>
        <td>${new Date(b.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })} ${b.timeSlot} น.</td>
        <td>${b.user.name ?? b.user.email}${b.user.phone ? `<br/><small>${b.user.phone}</small>` : ''}</td>
        <td>฿${b.field.pricePerHour.toLocaleString()}</td>
        <td>${STATUS_LABELS[b.status]}</td>
        <td>${b.note ?? '-'}</td>
      </tr>`).join('');

    const sportRows = data.bySportType.map(s => `
      <tr>
        <td>${SPORT_TYPE_LABELS[s.sportType] ?? s.sportType}</td>
        <td>${s.count}</td>
        <td>฿${s.revenue.toLocaleString()}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8"/>
  <title>88ARENA Report ${from} - ${to}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Sarabun','Tahoma',sans-serif; padding:24px; color:#1e1e1e; font-size:12px; }
    h1 { font-size:20px; font-weight:700; margin-bottom:4px; }
    .meta { color:#6b7280; margin-bottom:16px; font-size:11px; }
    .summary { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
    .card { border:1px solid #e5e7eb; border-radius:8px; padding:12px; }
    .card .num { font-size:20px; font-weight:700; color:#4f46e5; }
    .card .lbl { font-size:11px; color:#6b7280; margin-top:2px; }
    h2 { font-size:13px; font-weight:600; margin:16px 0 6px; }
    table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:20px; }
    th { background:#f3f4f6; text-align:left; padding:6px 8px; border:1px solid #e5e7eb; font-weight:600; }
    td { padding:5px 8px; border:1px solid #e5e7eb; vertical-align:top; }
    tr:nth-child(even) td { background:#f9fafb; }
    small { color:#6b7280; }
    @media print {
      body { padding:0; }
      @page { margin:1cm; size:A4 landscape; }
    }
  </style>
</head>
<body>
  <h1>88ARENA - รีพอร์ต</h1>
  <p class="meta">ช่วงเวลา: ${from} ถึง ${to} &nbsp;|&nbsp; สร้างเมื่อ: ${new Date().toLocaleString('th-TH')}</p>

  <div class="summary">
    <div class="card"><div class="num">${data.summary.total}</div><div class="lbl">การจองทั้งหมด</div></div>
    <div class="card"><div class="num">฿${data.summary.netRevenue.toLocaleString()}</div><div class="lbl">รายได้สุทธิ</div></div>
    <div class="card"><div class="num" style="color:#dc2626">-฿${data.summary.cancelledRevenue.toLocaleString()}</div><div class="lbl">ยกเลิก/คืนเงิน</div></div>
    <div class="card"><div class="num">${data.summary.byStatus.APPROVED}</div><div class="lbl">อนุมัติแล้ว</div></div>
  </div>

  <h2>สรุปตามประเภทกีฬา</h2>
  <table>
    <thead><tr><th>ประเภทกีฬา</th><th>จำนวนจอง</th><th>รายได้</th></tr></thead>
    <tbody>${sportRows}</tbody>
  </table>

  <h2>รายการจองทั้งหมด (${data.bookings.length} รายการ)</h2>
  <table>
    <thead>
      <tr><th>สนาม</th><th>วันที่ / เวลา</th><th>ลูกค้า</th><th>ราคา/ชม.</th><th>สถานะ</th><th>หมายเหตุ</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1200px;height:900px;border:0;';
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
  }

  return (
    <div className="wrapper py-8 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/sport/admin" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📊 รีพอร์ต</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportPDF}
            disabled={!data}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition shadow-sm disabled:opacity-50"
          >
            📄 ส่งออก PDF
          </button>
          <a
            href={buildExportUrl()}
            download
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition shadow-sm"
          >
            ⬇️ ส่งออก CSV
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">ตัวกรอง</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">ตั้งแต่วันที่</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">ถึงวันที่</label>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">สถานะ</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">ประเภทกีฬา</label>
            <select
              value={sportType}
              onChange={(e) => setSportType(e.target.value)}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {SPORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          กำลังโหลด...
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard icon="📋" label="การจองทั้งหมด" value={data.summary.total} color="from-blue-500/20 to-cyan-500/20" textColor="text-blue-600 dark:text-blue-400" />
            <SummaryCard icon="💰" label="รายได้สุทธิ" value={`฿${data.summary.netRevenue.toLocaleString()}`} color="from-green-500/20 to-emerald-500/20" textColor="text-green-600 dark:text-green-400" />
            <SummaryCard icon="↩️" label="ยกเลิก/คืนเงิน" value={`-฿${data.summary.cancelledRevenue.toLocaleString()}`} color="from-red-500/20 to-rose-500/20" textColor="text-red-600 dark:text-red-400" />
            <SummaryCard icon="✅" label="อนุมัติแล้ว" value={data.summary.byStatus.APPROVED} color="from-primary-500/20 to-violet-500/20" textColor="text-primary-600 dark:text-primary-400" />
          </div>

          {/* Recharts */}
          <ReportCharts
            byStatus={data.summary.byStatus}
            bySportType={data.bySportType}
            bookings={data.bookings}
            byHour={data.byHour}
            byDayOfWeek={data.byDayOfWeek}
            byFieldTrend={data.byFieldTrend}
            heatmap={data.heatmap}
            occupancyByField={data.occupancyByField}
          />

          {/* Status Breakdown + Sport Type Breakdown */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Status breakdown */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">สถานะการจอง</h2>
              <div className="space-y-3">
                {(Object.entries(data.summary.byStatus) as [BookingStatus, number][]).map(([st, count]) => (
                  <div key={st} className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[st]}`}>
                      {STATUS_LABELS[st]}
                    </span>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all duration-500"
                        style={{ width: data.summary.total > 0 ? `${(count / data.summary.total) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sport type breakdown */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">จำนวนจองตามประเภทกีฬา</h2>
              {data.bySportType.length === 0 ? (
                <p className="text-sm text-gray-400">ไม่มีข้อมูล</p>
              ) : (
                <div className="space-y-3">
                  {data.bySportType.sort((a, b) => b.count - a.count).map((item) => (
                    <div key={item.sportType} className="flex items-center gap-3">
                      <span className="text-xl w-6 text-center">{SPORT_TYPE_EMOJI[item.sportType]}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-20 shrink-0">
                        {SPORT_TYPE_LABELS[item.sportType] ?? item.sportType}
                      </span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                          style={{ width: `${(item.count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-8 text-right">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Field Analytics */}
          {data.byField && data.byField.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                <h2 className="font-semibold text-gray-900 dark:text-white">Analytics ต่อสนาม</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
                      <th className="px-4 py-3 text-left font-semibold">สนาม</th>
                      <th className="px-4 py-3 text-center font-semibold">การจองทั้งหมด</th>
                      <th className="px-4 py-3 text-center font-semibold">อนุมัติ</th>
                      <th className="px-4 py-3 text-center font-semibold">อัตราอนุมัติ</th>
                      <th className="px-4 py-3 text-right font-semibold">รายได้</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {data.byField.map((f) => (
                      <tr key={f.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{SPORT_TYPE_EMOJI[f.sportType]}</span>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{f.name}</p>
                              <p className="text-xs text-gray-400">{SPORT_TYPE_LABELS[f.sportType]}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">{f.count}</td>
                        <td className="px-4 py-3 text-center text-green-600 dark:text-green-400 font-semibold">{f.approved}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            {f.count > 0 ? ((f.approved / f.count) * 100).toFixed(0) : 0}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-primary-600 dark:text-primary-400">
                          ฿{f.revenue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bookings Table */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">รายการจอง ({data.bookings.length})</h2>
              <a
                href={buildExportUrl()}
                download
                className="text-sm text-green-600 dark:text-green-400 hover:underline font-medium"
              >
                ⬇️ ดาวน์โหลด CSV
              </a>
            </div>

            {data.bookings.length === 0 ? (
              <div className="p-12 text-center text-gray-400">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left font-semibold">สนาม</th>
                      <th className="px-4 py-3 text-left font-semibold">วันที่ / เวลา</th>
                      <th className="px-4 py-3 text-left font-semibold">ลูกค้า</th>
                      <th className="px-4 py-3 text-left font-semibold">ราคา</th>
                      <th className="px-4 py-3 text-left font-semibold">สถานะ</th>
                      <th className="px-4 py-3 text-left font-semibold">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {data.bookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{SPORT_TYPE_EMOJI[booking.field.sportType]}</span>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{booking.field.name}</p>
                              <p className="text-xs text-gray-400">{SPORT_TYPE_LABELS[booking.field.sportType]}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {new Date(booking.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-xs text-primary-600 dark:text-primary-400">{booking.timeSlot} น.</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800 dark:text-gray-200">{booking.user.name ?? '-'}</p>
                          <p className="text-xs text-gray-400">{booking.user.email}</p>
                          {booking.user.phone && (
                            <a href={`tel:${booking.user.phone}`} className="text-xs text-green-600 dark:text-green-400 hover:underline">
                              {booking.user.phone}
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                          ฿{booking.field.pricePerHour.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[booking.status]}`}>
                            {STATUS_LABELS[booking.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[160px] truncate">
                          {booking.note ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon, label, value, color, textColor,
}: {
  icon: string;
  label: string;
  value: string | number;
  color: string;
  textColor: string;
}) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${color} border border-white/50 dark:border-gray-700/50 p-5`}>
      <div className="text-3xl mb-2">{icon}</div>
      <div className={`text-2xl font-bold ${textColor}`}>{value}</div>
      <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}
