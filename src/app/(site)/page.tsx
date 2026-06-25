'use client';

import { useState } from 'react';
import { DEMO_URL } from '@/lib/site';

const CSS = `
.feature-card{transition:transform .2s,box-shadow .2s,border-color .2s}
.feature-card:hover{transform:translateY(-4px);box-shadow:0 18px 40px rgba(20,50,110,.10);border-color:#CFE0FA}
.form-input:focus{border-color:#1E5BD6}
.tabbtn{font-family:inherit;font-size:15px;font-weight:600;padding:11px 22px;border-radius:10px;cursor:pointer;border:1.5px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:#A9BBDC}
.tabbtn.active{border-color:#4F8DF7;background:#1E5BD6;color:#fff}
.billbtn{font-family:inherit;font-size:15px;font-weight:600;padding:10px 22px;border-radius:8px;cursor:pointer;border:none;background:transparent;color:#56657F;display:inline-flex;align-items:center;gap:7px}
.billbtn.active{background:#fff;color:#0C1B36;box-shadow:0 2px 6px rgba(20,50,110,.12)}
@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@media(max-width:900px){.hero-grid,.contact-grid{grid-template-columns:1fr!important}.h1big{font-size:36px!important}}
@media(max-width:760px){.grid3,.grid4{grid-template-columns:1fr 1fr!important}}
@media(max-width:520px){.grid3,.grid4{grid-template-columns:1fr!important}}
`;

const LOGOS = ['Arena One', 'BaanBall', 'SmashCourt', 'GoalZone', 'NetPro', 'SetPoint'];

const ICONS: Record<string, React.ReactNode> = {
  booking: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="17" rx="2" stroke="#1E5BD6" strokeWidth="1.7" /><path d="M3 9h18M8 2v4M16 2v4" stroke="#1E5BD6" strokeWidth="1.7" strokeLinecap="round" /></svg>,
  pos: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="13" rx="2" stroke="#22A06B" strokeWidth="1.7" /><path d="M3 9h18M7 21h10" stroke="#22A06B" strokeWidth="1.7" strokeLinecap="round" /></svg>,
  stock: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M21 8l-9-5-9 5 9 5 9-5z" stroke="#E0941A" strokeWidth="1.7" strokeLinejoin="round" /><path d="M3 8v8l9 5 9-5V8M12 13v8" stroke="#E0941A" strokeWidth="1.7" strokeLinejoin="round" /></svg>,
  crm: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" stroke="#7C4DD8" strokeWidth="1.7" /><path d="M3.5 20a5.5 5.5 0 0111 0M16 11l1.5 1.5L21 9" stroke="#7C4DD8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  report: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" stroke="#1E5BD6" strokeWidth="1.8" strokeLinecap="round" /></svg>,
  pay: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke="#22A06B" strokeWidth="1.7" /><path d="M2.5 9.5h19" stroke="#22A06B" strokeWidth="1.7" /></svg>,
};

const FEATURES = [
  { icon: 'booking', bg: '#E7F0FE', title: 'ระบบจองออนไลน์', desc: 'ลูกค้าเลือกสนาม เลือกเวลา และจ่ายเงินจองเองได้ตลอด 24 ชม. ลดงานรับโทรศัพท์ ไม่จองซ้ำซ้อน รองรับจองล่วงหน้าและคิวรอ' },
  { icon: 'pos', bg: '#E7F7EF', title: 'POS ขายหน้าร้าน', desc: 'เปิดบิล แยก/รวมโต๊ะ รับชำระหลายช่องทาง พิมพ์ใบเสร็จ และปิดการขายได้ในไม่กี่คลิก พร้อมระบบกะเงินสด' },
  { icon: 'stock', bg: '#FEF1E7', title: 'จัดการสต็อกสินค้า', desc: 'ตัดสต็อกอัตโนมัติเมื่อขาย แจ้งเตือนของใกล้หมด เห็นความเคลื่อนไหวและต้นทุน-กำไรรายสินค้าชัดเจน' },
  { icon: 'crm', bg: '#F0E9FB', title: 'สมาชิก แต้ม คูปอง', desc: 'ระบบสมาชิก สะสมแต้ม คูปองส่วนลด และรีวิว ช่วยดึงลูกค้าเก่ากลับมาใช้บริการซ้ำ' },
  { icon: 'report', bg: '#E7F0FE', title: 'รายงานเรียลไทม์', desc: 'สรุปยอดขาย การจอง และกะเงินสด ดูได้ทุกที่ผ่านมือถือ ปิดรอบกะแม่นยำ ตัดสินใจด้วยข้อมูลจริง' },
  { icon: 'pay', bg: '#E7F7EF', title: 'ชำระเงิน + แจ้งเตือน', desc: 'รับบัตรและ PromptPay ผ่าน Stripe ออกใบเสร็จ PDF แจ้งเตือนลูกค้าและทีมงานผ่านอีเมล LINE และ Push' },
];

const TABS = [
  { key: 'dash', label: 'แดชบอร์ด', url: 'app.dhevasuite.com/dashboard' },
  { key: 'pos', label: 'หน้าขาย POS', url: 'app.dhevasuite.com/pos' },
  { key: 'report', label: 'รายงาน', url: 'app.dhevasuite.com/reports' },
  { key: 'stock', label: 'คลังสินค้า', url: 'app.dhevasuite.com/inventory' },
];

const STATS = [
  { num: '99.9%', label: 'ความเสถียรของระบบ' },
  { num: '24/7', label: 'รับจองออนไลน์' },
  { num: '3 คลิก', label: 'ปิดการขายหน้าร้าน' },
  { num: '100%', label: 'ภาษาไทย + ซัพพอร์ตคนไทย' },
];

const PLANS = [
  { name: 'เริ่มต้น', tagline: 'สำหรับสนามเดี่ยวที่เพิ่งเริ่มรับจองออนไลน์', m: '590', y: '490', popular: false, cta: 'ขอใบเสนอราคา', features: ['1 สาขา / 2 ผู้ใช้งาน', 'ระบบจองออนไลน์', 'POS ขายหน้าร้าน', 'จัดการสต็อกพื้นฐาน', 'รายงานยอดขายและการจอง', 'ซัพพอร์ตทางอีเมล'] },
  { name: 'มาตรฐาน', tagline: 'สำหรับสนามที่มีหลายคอร์ตและทีมงานหลายคน', m: '1,290', y: '990', popular: true, cta: 'ขอใบเสนอราคา', features: ['สูงสุด 5 สาขา / 10 ผู้ใช้งาน', 'ทุกอย่างในแพ็กเกจเริ่มต้น', 'สมาชิก แต้ม และคูปอง', 'หลายแคชเชียร์ + ระบบกะเงินสด', 'ชำระเงินออนไลน์ (บัตร/PromptPay)', 'แจ้งเตือนอีเมล/LINE/Push'] },
  { name: 'องค์กร', tagline: 'สำหรับเครือสนามและอารีน่าขนาดใหญ่', custom: true, popular: false, cta: 'นัดปรึกษาทีมขาย', features: ['สาขาและผู้ใช้งานไม่จำกัด', 'ทุกอย่างในแพ็กเกจมาตรฐาน', 'เชื่อมต่อระบบภายในผ่าน API', 'ผู้ดูแลบัญชีเฉพาะองค์กร', 'อบรมการใช้งานถึงที่', 'SLA และซัพพอร์ต 24/7'] },
];

const TESTIMONIALS = [
  { quote: 'เปลี่ยนมาใช้ DhevaSuite แล้วลูกค้าจองเองออนไลน์ได้ ไม่ต้องนั่งรับโทรศัพท์ทั้งวัน ยอดจองเพิ่มขึ้นเพราะเปิดรับนอกเวลาทำการได้', name: 'คุณวิภาดา ส.', role: 'เจ้าของสนามฟุตบอล 4 คอร์ต', initial: 'ว', avatarBg: '#1E5BD6' },
  { quote: 'POS กับระบบกะเงินสดช่วยให้ปิดรอบแคชเชียร์แม่นยำ ของในสต็อกไม่หาย ดูยอดขายทุกสาขาได้จากมือถือ', name: 'คุณธนกฤต พ.', role: 'ผู้จัดการอารีน่าแบดมินตัน', initial: 'ธ', avatarBg: '#22A06B' },
  { quote: 'ระบบสมาชิกและแต้มสะสมทำให้ลูกค้าเก่ากลับมาเล่นซ้ำ คุ้มค่ามากสำหรับสนามขนาดกลาง ทีมซัพพอร์ตคนไทยตอบไว', name: 'คุณนภัสสร ก.', role: 'เจ้าของคอร์ตเทนนิส', initial: 'น', avatarBg: '#7C4DD8' },
];

const FAQS = [
  { q: 'DhevaSuite เหมาะกับสนามแบบไหนบ้าง?', a: 'เหมาะกับสนามฟุตบอล แบดมินตัน เทนนิส บาส รวมถึงอารีน่าและคอมเพล็กซ์กีฬาที่มีหลายคอร์ต ระบบปรับขนาดได้ตั้งแต่สนามเดียวจนถึงเครือหลายสาขา' },
  { q: 'ต้องติดตั้งโปรแกรมหรือซื้ออุปกรณ์เพิ่มไหม?', a: 'ไม่จำเป็น ระบบทำงานบนคลาวด์ ใช้ผ่านเว็บเบราว์เซอร์ แท็บเล็ต หรือมือถือได้ทันที รองรับเครื่องพิมพ์ใบเสร็จและลิ้นชักเก็บเงินทั่วไปที่มีอยู่แล้ว' },
  { q: 'ข้อมูลของสนามปลอดภัยแค่ไหน?', a: 'เราเข้ารหัสข้อมูลและสำรองข้อมูลอัตโนมัติ ระบบมีความเสถียรสูง รองรับการยืนยันตัวตน 2 ขั้นตอน (2FA) และการแบ่งสิทธิ์ผู้ใช้ตามบทบาท ข้อมูลไม่ถูกแชร์ให้บุคคลที่สาม' },
  { q: 'ทดลองดูระบบก่อนได้ไหม?', a: 'ได้ กดปุ่ม "ดูเดโมจริง" เพื่อเข้าใช้ระบบจริงได้ทันที หรือขอบัญชีทดลองหลังบ้าน (แอดมิน/POS) จากทีมขายเพื่อดูครบทุกฟีเจอร์' },
  { q: 'มีทีมช่วยตั้งค่าระบบให้ไหม?', a: 'มี ทีมงานคนไทยช่วยนำเข้าข้อมูลสนาม ราคา และสินค้า ตั้งค่าระบบ และอบรมการใช้งานให้ พร้อมซัพพอร์ตผ่านโทรศัพท์ อีเมล และ LINE (แพ็กเกจองค์กรซัพพอร์ต 24/7)' },
];

function StatCard({ label, val, delta }: { label: string; val: string; delta: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #EDF1F8', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 12, color: '#8C98AE' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 4px' }}>{val}</div>
      <div style={{ fontSize: 12, color: '#22A06B', fontWeight: 600 }}>▲ {delta}</div>
    </div>
  );
}

function Bars({ heights }: { heights: number[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, height: 150 }}>
      {heights.map((h, i) => (
        <div key={i} style={{ flex: 1, height: `${h}%`, background: 'linear-gradient(180deg,#6FA0F2,#1E5BD6)', borderRadius: '5px 5px 0 0' }} />
      ))}
    </div>
  );
}

function Shot({ k }: { k: string }) {
  if (k === 'pos') {
    const items = [['ค่าสนาม 1 ชม.', 300], ['น้ำดื่ม', 15], ['เครื่องดื่มเกลือแร่', 25], ['ลูกแบดมินตัน', 120], ['ผ้าเช็ดตัว', 50], ['เช่ารองเท้า', 40]] as const;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>เลือกรายการ</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {items.map(([n, p], i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #EDF1F8', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <div style={{ height: 52, borderRadius: 8, background: 'linear-gradient(135deg,#E7F0FE,#D2E2FB)', marginBottom: 10 }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>{n}</div>
                <div style={{ fontSize: 12, color: '#8C98AE', marginTop: 3 }}>฿{p}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #EDF1F8', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>บิลปัจจุบัน</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            {[['ค่าสนาม 2 ชม.', '฿600'], ['น้ำดื่ม x3', '฿45'], ['ลูกแบดมินตัน x1', '฿120']].map(([n, p], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#fff', border: '1px solid #EDF1F8', borderRadius: 10, fontSize: 14 }}>
                <span style={{ fontWeight: 500 }}>{n}</span><span style={{ color: '#1E5BD6', fontWeight: 700 }}>{p}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px dashed #DCE4F0', marginTop: 14, paddingTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
            <span>รวม</span><span style={{ color: '#1E5BD6' }}>฿765</span>
          </div>
          <div style={{ marginTop: 14, background: 'linear-gradient(135deg,#1E5BD6,#163F94)', color: '#fff', textAlign: 'center', padding: 13, borderRadius: 11, fontWeight: 600 }}>ชำระเงิน</div>
        </div>
      </div>
    );
  }

  if (k === 'report') {
    return (
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>รายงานรายเดือน</div>
        <div className="grid4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
          <StatCard label="รายได้รวม" val="฿2.41M" delta="12.4%" />
          <StatCard label="ชั่วโมงที่ถูกจอง" val="1,284" delta="8.1%" />
          <StatCard label="อัตราใช้สนาม" val="78%" delta="6.0%" />
          <StatCard label="เฉลี่ย/บิล" val="฿1,876" delta="3.4%" />
        </div>
        <div style={{ background: '#fff', border: '1px solid #EDF1F8', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, color: '#5E6E8C', fontWeight: 600, marginBottom: 16 }}>แนวโน้มรายได้ 12 เดือน</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150 }}>
            {[45, 58, 52, 70, 64, 80, 72, 88, 79, 94, 86, 100].map((h, i) => (
              <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 11 ? 'linear-gradient(180deg,#1E5BD6,#163F94)' : 'linear-gradient(180deg,#7FAAF3,#3D77E0)', borderRadius: '5px 5px 0 0' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (k === 'stock') {
    const rows = [['ลูกแบดมินตัน', 'BD-001', 248, 'ปกติ', '#22A06B'], ['น้ำดื่ม 600ml', 'WT-014', 32, 'ใกล้หมด', '#E0941A'], ['ลูกเทนนิส', 'TN-220', 8, 'ต้องสั่งเพิ่ม', '#DC3545'], ['เครื่องดื่มเกลือแร่', 'SP-090', 96, 'ปกติ', '#22A06B'], ['ผ้าเช็ดตัว', 'TW-005', 54, 'ปกติ', '#22A06B']] as const;
    return (
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>จัดการคลังสินค้า</div>
        <div style={{ background: '#fff', border: '1px solid #EDF1F8', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr', gap: 12, padding: '14px 16px', background: '#F6F9FD', fontSize: 12.5, color: '#8C98AE', fontWeight: 600 }}>
            <span>ชื่อสินค้า</span><span>รหัส SKU</span><span>คงเหลือ</span><span>สถานะ</span>
          </div>
          {rows.map(([n, sku, qty, st, c], i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr', gap: 12, padding: '14px 16px', background: '#fff', borderBottom: i < rows.length - 1 ? '1px solid #F0F3F9' : 'none', fontSize: 14, alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>{n}</span><span style={{ color: '#8C98AE' }}>{sku}</span><span>{qty} ชิ้น</span>
              <span style={{ color: c as string, background: `${c}18`, padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, textAlign: 'center' }}>{st}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // dashboard
  return (
    <div>
      <div className="grid4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
        <StatCard label="การจองวันนี้" val="38" delta="12.4%" />
        <StatCard label="รายได้วันนี้" val="฿42,300" delta="8.1%" />
        <StatCard label="ลูกค้าใหม่" val="12" delta="5.6%" />
        <StatCard label="สนามว่างตอนนี้" val="5" delta="2 คอร์ต" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #EDF1F8', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, color: '#5E6E8C', fontWeight: 600, marginBottom: 16 }}>การจองราย 7 วัน</div>
          <Bars heights={[52, 68, 44, 82, 60, 90, 74]} />
        </div>
        <div style={{ background: '#fff', border: '1px solid #EDF1F8', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, color: '#5E6E8C', fontWeight: 600, marginBottom: 16 }}>สนามยอดนิยม</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {[['คอร์ตแบด 1', 90], ['สนามฟุตซอล', 72], ['คอร์ตเทนนิส', 54], ['คอร์ตแบด 2', 36]].map(([n, p], i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}><span>{n}</span><span style={{ color: '#8C98AE' }}>{p}%</span></div>
                <div style={{ height: 7, background: '#EDF2F9', borderRadius: 4 }}><div style={{ width: `${p}%`, height: '100%', background: '#1E5BD6', borderRadius: 4 }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState(0);
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaq, setOpenFaq] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', message: '' });
  const yearly = billing === 'yearly';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  const at = TABS[activeTab];

  return (
    <div style={{ overflowX: 'hidden' }}>
      <style>{CSS}</style>

      {/* HERO */}
      <section style={{ position: 'relative', background: 'linear-gradient(180deg,#F4F8FE 0%,#ffffff 100%)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -160, right: -140, width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle,rgba(79,141,247,0.18),transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: -120, left: -120, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle,rgba(30,91,214,0.10),transparent 70%)' }} />
        <div className="hero-grid" style={{ maxWidth: 1180, margin: '0 auto', padding: '78px 28px 88px', display: 'grid', gridTemplateColumns: '1.05fr 1.15fr', gap: 56, alignItems: 'center', position: 'relative' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#E7F0FE', color: '#1E5BD6', fontSize: 13.5, fontWeight: 600, padding: '7px 14px', borderRadius: 999, marginBottom: 22 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E' }} />
              ระบบจัดการสนามกีฬาครบวงจร ใช้งานง่ายในที่เดียว
            </div>
            <h1 className="h1big" style={{ fontSize: 50, lineHeight: 1.12, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 20px' }}>เปิดสนามให้ลูกค้าจองออนไลน์<br />และขายหน้าร้าน <span style={{ color: '#1E5BD6' }}>ในระบบเดียว</span></h1>
            <p style={{ fontSize: 18, lineHeight: 1.65, color: '#51607C', margin: '0 0 32px', maxWidth: 480 }}>DhevaSuite รวมระบบจองออนไลน์ POS ขายหน้าร้าน จัดการสต็อก สมาชิก และรายงาน ไว้ในระบบเดียว สำหรับสนามกีฬาและอารีน่าทุกขนาด</p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 30 }}>
              <a href={DEMO_URL} style={{ fontSize: 16, fontWeight: 600, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg,#1E5BD6,#163F94)', padding: '15px 30px', borderRadius: 12, boxShadow: '0 10px 26px rgba(30,91,214,0.32)' }}>ดูเดโมจริง →</a>
              <a href="#screens" style={{ fontSize: 16, fontWeight: 600, color: '#1E5BD6', textDecoration: 'none', background: '#fff', border: '1.5px solid #CCD9EF', padding: '15px 28px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#1E5BD6" strokeWidth="1.7" /><path d="M10 9l5 3-5 3V9z" fill="#1E5BD6" /></svg>
                ดูหน้าจอโปรแกรม
              </a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 14, color: '#64728C', flexWrap: 'wrap' }}>
              {['ไม่ต้องติดตั้งโปรแกรม', 'รับจองออนไลน์ 24 ชม.', 'ทีมซัพพอร์ตคนไทย'].map((t) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>{t}
                </div>
              ))}
            </div>
          </div>

          {/* mock dashboard */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 34, right: 18, width: 200, height: 128, background: '#fff', borderRadius: 14, boxShadow: '0 18px 50px rgba(20,50,110,0.16)', padding: '15px 16px', animation: 'floaty 6s ease-in-out infinite', zIndex: 3 }}>
              <div style={{ fontSize: 12, color: '#7A879E', fontWeight: 500 }}>การจองวันนี้</div>
              <div style={{ fontSize: 24, fontWeight: 700, margin: '5px 0 8px' }}>฿42,300</div>
              <div style={{ display: 'flex', alignItems: 'end', gap: 5, height: 42 }}>
                {[40, 62, 48, 80, 66, 95].map((h, i) => <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 3 || i === 5 ? '#1E5BD6' : '#D9E6FB', borderRadius: 3 }} />)}
              </div>
            </div>
            <div style={{ borderRadius: 16, background: '#fff', boxShadow: '0 30px 70px rgba(20,50,110,0.2)', overflow: 'hidden', border: '1px solid #ECF1F8' }}>
              <div style={{ height: 38, background: '#F5F8FC', display: 'flex', alignItems: 'center', gap: 7, padding: '0 15px', borderBottom: '1px solid #ECF1F8' }}>
                {['#FF6058', '#FFBD2E', '#28C940'].map((c) => <span key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9AA6BC' }}>app.dhevasuite.com</span>
              </div>
              <div style={{ display: 'flex', height: 340 }}>
                <div style={{ width: 64, background: '#0F2A5E', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 18, gap: 18 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#1E5BD6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 6.5v11L12 22l9-4.5v-11L12 2z" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" /></svg>
                  </div>
                  {[0.16, 0.08, 0.08, 0.08].map((o, i) => <div key={i} style={{ width: 24, height: 24, borderRadius: 7, background: `rgba(255,255,255,${o})` }} />)}
                </div>
                <div style={{ flex: 1, padding: '20px 22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>แดชบอร์ดภาพรวม</div>
                      <div style={{ fontSize: 11.5, color: '#8C98AE', marginTop: 2 }}>อัปเดตล่าสุด 2 นาทีที่แล้ว</div>
                    </div>
                    <div style={{ fontSize: 11, color: '#1E5BD6', fontWeight: 600, background: '#E7F0FE', padding: '5px 11px', borderRadius: 7 }}>วันนี้</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                    {[['การจอง', '38'], ['รายได้', '฿42.3K'], ['ลูกค้าใหม่', '12']].map(([l, v], i) => (
                      <div key={i} style={{ background: '#F6F9FD', border: '1px solid #EDF1F8', borderRadius: 11, padding: '11px 12px' }}>
                        <div style={{ fontSize: 10.5, color: '#8C98AE' }}>{l}</div>
                        <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>{v}</div>
                        <div style={{ fontSize: 10, color: '#22A06B', fontWeight: 600, marginTop: 3 }}>▲ 12.4%</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#F6F9FD', border: '1px solid #EDF1F8', borderRadius: 11, padding: '14px 16px 12px' }}>
                    <div style={{ fontSize: 11.5, color: '#5E6E8C', fontWeight: 600, marginBottom: 12 }}>การจองราย 7 วัน</div>
                    <div style={{ display: 'flex', alignItems: 'end', gap: 9, height: 96 }}>
                      {[46, 64, 38, 78, 55, 88, 70].map((h, i) => <div key={i} style={{ flex: 1, height: `${h}%`, background: 'linear-gradient(180deg,#6FA0F2,#1E5BD6)', borderRadius: '5px 5px 0 0' }} />)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LOGO CLOUD */}
      <section style={{ background: '#fff', borderTop: '1px solid #EEF2F8', borderBottom: '1px solid #EEF2F8' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '30px 28px' }}>
          <div style={{ textAlign: 'center', fontSize: 13.5, color: '#8593AB', fontWeight: 500, marginBottom: 20 }}>ได้รับความไว้วางใจจากสนามและอารีน่าทั่วประเทศไทย</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 48, flexWrap: 'wrap', opacity: 0.62 }}>
            {LOGOS.map((l) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#5E6E8C', fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em' }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: '#DCE6F5' }} />{l}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: '90px 28px', maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 54px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1E5BD6', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>ฟีเจอร์เด่น</div>
          <h2 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 16px', lineHeight: 1.2 }}>ทุกอย่างที่สนามคุณต้องใช้ ในระบบเดียว</h2>
          <p style={{ fontSize: 17, color: '#56657F', lineHeight: 1.6, margin: 0 }}>ตั้งแต่ลูกค้ากดจอง จนปิดยอดขายหน้าร้าน รวมงานทุกอย่างให้ทำงานร่วมกันอัตโนมัติ</p>
        </div>
        <div className="grid3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="feature-card" style={{ background: '#fff', border: '1px solid #E7EDF6', borderRadius: 16, padding: '28px 26px' }}>
              <div style={{ width: 50, height: 50, borderRadius: 13, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>{ICONS[f.icon]}</div>
              <h3 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 9px' }}>{f.title}</h3>
              <p style={{ fontSize: 15, color: '#56657F', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SCREENS */}
      <section id="screens" style={{ background: 'linear-gradient(180deg,#0C2350,#0F2A5E)', padding: '84px 28px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 40px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#79A6F5', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>หน้าจอโปรแกรม</div>
            <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 14px', lineHeight: 1.2, color: '#fff' }}>ออกแบบมาให้ใช้งานง่าย สวยทุกหน้าจอ</h2>
            <p style={{ fontSize: 16, color: '#A9BBDC', lineHeight: 1.6, margin: 0 }}>เลือกดูตัวอย่างหน้าจอจริงของ DhevaSuite</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 34 }}>
            {TABS.map((t, i) => (
              <button key={t.key} className={`tabbtn${activeTab === i ? ' active' : ''}`} onClick={() => setActiveTab(i)}>{t.label}</button>
            ))}
          </div>
          <div style={{ maxWidth: 940, margin: '0 auto', borderRadius: 18, overflow: 'hidden', boxShadow: '0 40px 90px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ height: 42, background: '#1A3568', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}>
              {['#FF6058', '#FFBD2E', '#28C940'].map((c) => <span key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
              <span style={{ marginLeft: 14, fontSize: 12, color: '#9DB0D6' }}>{at.url}</span>
            </div>
            <div style={{ background: '#F4F7FC', minHeight: 440, padding: 30 }}><Shot k={at.key} /></div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ background: '#fff', padding: '56px 28px' }}>
        <div className="grid4" style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24, textAlign: 'center' }}>
          {STATS.map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 42, fontWeight: 700, color: '#1E5BD6', letterSpacing: '-0.02em' }}>{s.num}</div>
              <div style={{ fontSize: 15, color: '#56657F', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ background: '#F4F8FE', padding: '88px 28px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 30px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1E5BD6', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>แพ็กเกจและราคา</div>
            <h2 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 16px', lineHeight: 1.2 }}>เลือกแพ็กเกจที่เหมาะกับสนามคุณ</h2>
            <p style={{ fontSize: 17, color: '#56657F', lineHeight: 1.6, margin: 0 }}>ทดลองดูเดโมฟรี ปรับแต่งได้ ไม่มีค่าติดตั้ง</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 44 }}>
            <div style={{ display: 'inline-flex', background: '#E5ECF8', borderRadius: 11, padding: 4, gap: 4 }}>
              <button className={`billbtn${!yearly ? ' active' : ''}`} onClick={() => setBilling('monthly')}>รายเดือน</button>
              <button className={`billbtn${yearly ? ' active' : ''}`} onClick={() => setBilling('yearly')}>รายปี <span style={{ color: '#22A06B', fontSize: 12 }}>ประหยัด 17%</span></button>
            </div>
          </div>
          <div className="grid3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, alignItems: 'start' }}>
            {PLANS.map((p) => (
              <div key={p.name} style={{ position: 'relative', background: '#fff', borderRadius: 18, padding: '32px 28px', border: p.popular ? '2px solid #1E5BD6' : '1px solid #E4EBF5', boxShadow: p.popular ? '0 24px 60px rgba(30,91,214,0.18)' : '0 8px 24px rgba(20,50,110,0.05)' }}>
                {p.popular && <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%) translateY(-50%)', background: 'linear-gradient(135deg,#1E5BD6,#163F94)', color: '#fff', fontSize: 12.5, fontWeight: 600, padding: '6px 16px', borderRadius: 999, boxShadow: '0 6px 16px rgba(30,91,214,0.4)' }}>แนะนำ • คุ้มที่สุด</div>}
                <div style={{ fontSize: 18, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 14, color: '#6B7A94', marginTop: 6, minHeight: 40, lineHeight: 1.45 }}>{p.tagline}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '18px 0 4px' }}>
                  <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em' }}>{p.custom ? 'ติดต่อเรา' : `฿${yearly ? p.y : p.m}`}</span>
                  {!p.custom && <span style={{ fontSize: 15, color: '#6B7A94' }}>/ เดือน</span>}
                </div>
                <div style={{ fontSize: 13, color: '#8593AB', minHeight: 20 }}>{p.custom ? 'ปรับแต่งตามความต้องการ' : (yearly ? 'เมื่อชำระรายปี' : 'ชำระรายเดือน')}</div>
                <a href="#contact" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 20, padding: 13, borderRadius: 11, fontSize: 15.5, fontWeight: 600, ...(p.popular ? { background: 'linear-gradient(135deg,#1E5BD6,#163F94)', color: '#fff', boxShadow: '0 10px 24px rgba(30,91,214,0.3)' } : { background: '#EDF3FC', color: '#1E5BD6' }) }}>{p.cta}</a>
                <div style={{ height: 1, background: '#EAF0F7', margin: '22px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {p.features.map((feat) => (
                    <div key={feat} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14.5, color: '#3F4E68', lineHeight: 1.45 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" fill="#E7F0FE" /><path d="M8 12.3l2.6 2.6L16 9.5" stroke="#1E5BD6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {feat}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '88px 28px', maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 50px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1E5BD6', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>เสียงจากลูกค้า</div>
          <h2 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>สนามที่เติบโตไปกับ DhevaSuite</h2>
        </div>
        <div className="grid3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {TESTIMONIALS.map((t) => (
            <div key={t.name} style={{ background: '#fff', border: '1px solid #E7EDF6', borderRadius: 16, padding: '30px 28px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>
                {Array.from({ length: 5 }).map((_, i) => <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="#FFB020"><path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.8 5.9 20.4l1.5-6.8L2.2 9l6.9-.7L12 2z" /></svg>)}
              </div>
              <p style={{ fontSize: 16, lineHeight: 1.65, color: '#2C3A52', margin: '0 0 22px', flex: 1 }}>&ldquo;{t.quote}&rdquo;</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: t.avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 17 }}>{t.initial}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</div>
                  <div style={{ fontSize: 13, color: '#7A879E' }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ background: '#F4F8FE', padding: '88px 28px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 46 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1E5BD6', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>คำถามที่พบบ่อย</div>
            <h2 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>เรื่องที่ลูกค้ามักถาม</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={i} style={{ background: '#fff', border: '1px solid #E4EBF5', borderRadius: 14, overflow: 'hidden' }}>
                  <button onClick={() => setOpenFaq(open ? -1 : i)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '22px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, cursor: 'pointer', fontFamily: 'inherit', fontSize: 17, fontWeight: 600, color: '#0C1B36' }}>
                    {f.q}
                    <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: open ? '#1E5BD6' : '#EDF3FC', color: open ? '#fff' : '#1E5BD6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 400, transition: 'transform .2s', transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
                  </button>
                  {open && <div style={{ padding: '0 24px 22px', fontSize: 15.5, lineHeight: 1.7, color: '#56657F' }}>{f.a}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CONTACT / CTA */}
      <section id="contact" style={{ background: 'linear-gradient(135deg,#143A82,#0F2A5E)', padding: '84px 28px' }}>
        <div className="contact-grid" style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.18, margin: '0 0 18px', color: '#fff' }}>พร้อมเปลี่ยนสนามให้เป็นระบบดิจิทัล?</h2>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: '#B6C6E6', margin: '0 0 30px' }}>กรอกข้อมูลเพื่อขอใบเสนอราคาและนัดดูเดโม ทีมงานจะติดต่อกลับเพื่อช่วยวางระบบให้สนามของคุณภายในวันเดียว</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[['02-123-4567', <svg key="p" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.6A2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.6a2 2 0 01-.5 2.1L8.1 9.5a16 16 0 006 6l1.1-1.1a2 2 0 012.1-.5c.8.3 1.7.5 2.6.6a2 2 0 011.7 2z" stroke="#79A6F5" strokeWidth="1.6" strokeLinejoin="round" /></svg>], ['sales@dhevasuite.com', <svg key="e" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v16H4z" stroke="#79A6F5" strokeWidth="1.6" /><path d="M4 6l8 6 8-6" stroke="#79A6F5" strokeWidth="1.6" strokeLinejoin="round" /></svg>], ['กรุงเทพมหานคร ประเทศไทย', <svg key="m" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z" stroke="#79A6F5" strokeWidth="1.6" /><circle cx="12" cy="10" r="3" stroke="#79A6F5" strokeWidth="1.6" /></svg>]].map(([txt, ic], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, color: '#D4DFF2', fontSize: 15.5 }}>{ic}{txt}</div>
              ))}
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 18, padding: 32, boxShadow: '0 30px 70px rgba(0,0,0,0.3)' }}>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '30px 8px' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E7F7EF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#22A06B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>ส่งข้อมูลเรียบร้อย!</h3>
                <p style={{ fontSize: 15, color: '#56657F', lineHeight: 1.6, margin: 0 }}>ขอบคุณที่สนใจ DhevaSuite ทีมงานจะติดต่อกลับภายใน 24 ชั่วโมง</p>
              </div>
            ) : (
              <form onSubmit={onSubmit}>
                <h3 style={{ fontSize: 21, fontWeight: 700, margin: '0 0 22px' }}>ขอใบเสนอราคา / นัดดูเดโม</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#41506B', marginBottom: 7 }}>ชื่อ</label>
                      <input className="form-input" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="สมชาย" style={{ width: '100%', padding: '13px 15px', border: '1.5px solid #DCE4F0', borderRadius: 10, fontFamily: 'inherit', fontSize: 15, color: '#0C1B36', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#41506B', marginBottom: 7 }}>นามสกุล</label>
                      <input className="form-input" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="ใจดี" style={{ width: '100%', padding: '13px 15px', border: '1.5px solid #DCE4F0', borderRadius: 10, fontFamily: 'inherit', fontSize: 15, color: '#0C1B36', outline: 'none' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#41506B', marginBottom: 7 }}>อีเมล</label>
                    <input className="form-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" style={{ width: '100%', padding: '13px 15px', border: '1.5px solid #DCE4F0', borderRadius: 10, fontFamily: 'inherit', fontSize: 15, color: '#0C1B36', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#41506B', marginBottom: 7 }}>รายละเอียด (ชื่อสนาม จำนวนคอร์ต เบอร์ติดต่อ)</label>
                    <textarea className="form-input" required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="เล่าให้เราฟังเกี่ยวกับสนามของคุณ" style={{ width: '100%', padding: '13px 15px', border: '1.5px solid #DCE4F0', borderRadius: 10, fontFamily: 'inherit', fontSize: 15, color: '#0C1B36', outline: 'none', resize: 'vertical' }} />
                  </div>
                  <button type="submit" disabled={loading} style={{ width: '100%', background: 'linear-gradient(135deg,#1E5BD6,#163F94)', color: '#fff', border: 'none', padding: 15, borderRadius: 11, fontFamily: 'inherit', fontSize: 16, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 10px 24px rgba(30,91,214,0.3)', marginTop: 4, opacity: loading ? 0.6 : 1 }}>{loading ? 'กำลังส่ง...' : 'ขอใบเสนอราคา / นัดดูเดโม'}</button>
                  <p style={{ fontSize: 12.5, color: '#8593AB', textAlign: 'center', margin: '2px 0 0', lineHeight: 1.5 }}>หรือกด &ldquo;ดูเดโมจริง&rdquo; ด้านบนเพื่อเข้าใช้ระบบทันที</p>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
