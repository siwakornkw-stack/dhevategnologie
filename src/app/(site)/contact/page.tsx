'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DEMO_URL } from '@/lib/site';

const inputStyle: React.CSSProperties = { width: '100%', padding: '13px 15px', border: '1.5px solid #DCE4F0', borderRadius: 10, fontFamily: 'inherit', fontSize: 15, color: '#0C1B36', outline: 'none' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13.5, fontWeight: 600, color: '#41506B', marginBottom: 7 };

export default function ContactPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', message: '' });

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

  return (
    <section style={{ position: 'relative', overflow: 'hidden', padding: '80px 28px' }}>
      <style>{`.form-input:focus{border-color:#1E5BD6}`}</style>
      <div style={{ position: 'absolute', top: -120, left: -120, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(79,141,247,0.16),transparent 70%)' }} />
      <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 14px' }}>ติดต่อฝ่ายขาย DhevaSuite</h1>
          <p style={{ fontSize: 17, color: '#56657F', lineHeight: 1.6, maxWidth: 520, margin: '0 auto' }}>อยากได้ระบบจองและขายหน้าร้านสำหรับสนามของคุณ? กรอกข้อมูลเพื่อขอใบเสนอราคาและนัดดูเดโม ทีมงานจะติดต่อกลับภายใน 24 ชั่วโมง</p>
          <Link href={DEMO_URL} style={{ display: 'inline-block', marginTop: 16, fontSize: 15, fontWeight: 600, color: '#1E5BD6', textDecoration: 'none' }}>อยากลองเองก่อน? ดูเดโมจริง →</Link>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E7EDF6', borderRadius: 18, padding: 36, boxShadow: '0 18px 50px rgba(20,50,110,0.08)' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '24px 8px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E7F7EF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#22A06B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>ส่งข้อมูลเรียบร้อย!</h3>
              <p style={{ fontSize: 15, color: '#56657F', lineHeight: 1.6, margin: 0 }}>ขอบคุณที่สนใจ DhevaSuite ทีมงานจะติดต่อกลับภายใน 24 ชั่วโมง</p>
            </div>
          ) : (
            <form onSubmit={onSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>ชื่อ</label>
                    <input className="form-input" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="สมชาย" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>นามสกุล</label>
                    <input className="form-input" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="ใจดี" style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>อีเมล</label>
                  <input className="form-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>รายละเอียด (ชื่อสนาม จำนวนคอร์ต เบอร์ติดต่อ)</label>
                  <textarea className="form-input" required rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="เล่าให้เราฟังเกี่ยวกับสนามของคุณ และสิ่งที่อยากได้จากระบบ" style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <button type="submit" disabled={loading} style={{ width: '100%', background: 'linear-gradient(135deg,#1E5BD6,#163F94)', color: '#fff', border: 'none', padding: 15, borderRadius: 11, fontFamily: 'inherit', fontSize: 16, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 10px 24px rgba(30,91,214,0.3)', opacity: loading ? 0.6 : 1 }}>{loading ? 'กำลังส่ง...' : 'ขอใบเสนอราคา / นัดดูเดโม'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
