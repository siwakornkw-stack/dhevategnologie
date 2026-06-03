'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

type Settings = {
  shopName: string;
  taxId: string | null;
  address: string | null;
  vatMode: 'NONE' | 'INCLUDED' | 'EXCLUDED';
  vatRate: number;
  allowNegativeStock: boolean;
  requireShift: boolean;
  pointsEarnPerBaht: number;
  pointsValueBaht: number;
  serviceChargeRate: number;
  printerType: 'BROWSER' | 'ESCPOS';
  paperSize: string;
  receiptHeader: string | null;
  receiptFooter: string | null;
  cashDrawerEnabled: boolean;
};

type SettingsClientProps = { initialSettings?: Settings | null };

export function SettingsClient({ initialSettings = null }: SettingsClientProps = {}) {
  const [s, setS] = useState<Settings | null>(initialSettings);
  const [saving, setSaving] = useState(false);

  async function load() {
    const r = await fetch('/api/sport/pos/settings');
    setS(await r.json());
  }
  useEffect(() => { if (!initialSettings) load(); }, [initialSettings]);

  async function save(form: FormData) {
    setSaving(true);
    const payload = {
      shopName: form.get('shopName'),
      taxId: form.get('taxId'),
      address: form.get('address'),
      vatMode: form.get('vatMode'),
      vatRate: Number(form.get('vatRate')),
      allowNegativeStock: form.get('allowNegativeStock') === 'on',
      requireShift: form.get('requireShift') === 'on',
      pointsEarnPerBaht: Number(form.get('pointsEarnPerBaht')) || 0,
      pointsValueBaht: Number(form.get('pointsValueBaht')) || 0,
      serviceChargeRate: Number(form.get('serviceChargeRate')) || 0,
      printerType: form.get('printerType'),
      paperSize: form.get('paperSize'),
      receiptHeader: form.get('receiptHeader'),
      receiptFooter: form.get('receiptFooter'),
      cashDrawerEnabled: form.get('cashDrawerEnabled') === 'on',
    };
    const r = await fetch('/api/sport/pos/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!r.ok) { toast.error('บันทึกไม่สำเร็จ'); return; }
    toast.success('บันทึกแล้ว');
    load();
  }

  if (!s) return <div className="wrapper py-8 text-gray-400">กำลังโหลด...</div>;

  return (
    <div className="wrapper py-8 max-w-2xl space-y-4">
      <div>
        <Link href="/sport/pos" className="text-xs text-gray-500 hover:underline">← POS</Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">ตั้งค่า POS</h1>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); save(new FormData(e.currentTarget)); }}
        className="space-y-4 bg-white dark:bg-gray-900 p-6 rounded-lg border dark:border-gray-700/50"
      >
        <section className="space-y-2">
          <div className="text-sm font-semibold">ร้าน</div>
          <input name="shopName" defaultValue={s.shopName} placeholder="ชื่อร้าน" className="input w-full" />
          <input name="taxId" defaultValue={s.taxId || ''} placeholder="Tax ID" className="input w-full" />
          <textarea name="address" defaultValue={s.address || ''} placeholder="ที่อยู่" className="input w-full" rows={2} />
        </section>

        <section className="space-y-2">
          <div className="text-sm font-semibold">VAT</div>
          <select name="vatMode" defaultValue={s.vatMode} className="input w-full">
            <option value="NONE">ไม่คิด VAT</option>
            <option value="INCLUDED">รวมในราคา (Included)</option>
            <option value="EXCLUDED">บวกแยก (Excluded)</option>
          </select>
          <label className="text-xs text-gray-500">อัตรา (%)</label>
          <input name="vatRate" type="number" step="0.01" defaultValue={s.vatRate} className="input w-full" />
        </section>

        <section className="space-y-2">
          <div className="text-sm font-semibold">Stock / Shift</div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allowNegativeStock" defaultChecked={s.allowNegativeStock} />
            อนุญาต stock ติดลบ (ปกติ: ปิด)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="requireShift" defaultChecked={s.requireShift} />
            บังคับเปิดกะก่อนขาย (ปกติ: ปิด)
          </label>
        </section>

        <section className="space-y-2">
          <div className="text-sm font-semibold">Loyalty Points</div>
          <label className="text-xs text-gray-500">แต้มต่อ 1 บาท (0 = ปิด earn). เช่น 0.04 = ใช้ 25 บาทได้ 1 แต้ม</label>
          <input name="pointsEarnPerBaht" type="number" step="0.01" min="0" defaultValue={s.pointsEarnPerBaht} className="input w-full" />
          <label className="text-xs text-gray-500">มูลค่า 1 แต้ม (บาท) (0 = ปิด redeem)</label>
          <input name="pointsValueBaht" type="number" step="0.01" min="0" defaultValue={s.pointsValueBaht} className="input w-full" />
        </section>

        <section className="space-y-2">
          <div className="text-sm font-semibold">Service Charge</div>
          <label className="text-xs text-gray-500">อัตรา % บนยอด subtotal ก่อน VAT (0 = ปิด)</label>
          <input name="serviceChargeRate" type="number" step="0.01" min="0" max="100" defaultValue={s.serviceChargeRate} className="input w-full" />
        </section>

        <section className="space-y-2">
          <div className="text-sm font-semibold">Printer / ใบเสร็จ</div>
          <select name="printerType" defaultValue={s.printerType} className="input w-full">
            <option value="BROWSER">Browser Print</option>
            <option value="ESCPOS">ESC/POS (ยังไม่เปิดใช้)</option>
          </select>
          <select name="paperSize" defaultValue={s.paperSize} className="input w-full">
            <option value="58mm">58mm</option>
            <option value="80mm">80mm</option>
          </select>
          <input name="receiptHeader" defaultValue={s.receiptHeader || ''} placeholder="หัวบิล" className="input w-full" />
          <input name="receiptFooter" defaultValue={s.receiptFooter || ''} placeholder="ท้ายบิล" className="input w-full" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="cashDrawerEnabled" defaultChecked={s.cashDrawerEnabled} />
            เปิดลิ้นชักเงินสด (ใช้กับ ESC/POS)
          </label>
        </section>

        <button disabled={saving} className="px-5 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </form>
    </div>
  );
}
