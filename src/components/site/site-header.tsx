import Link from 'next/link';
import { DEMO_URL } from '@/lib/site';

export function SiteHeader() {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid #E8EDF5' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', color: '#0C1B36' }}>
          <span style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#1E5BD6,#163F94)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(30,91,214,0.32)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 6.5v11L12 22l9-4.5v-11L12 2z" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" /><path d="M12 7l4.5 2.2v4.6L12 16l-4.5-2.2V9.2L12 7z" fill="#fff" fillOpacity="0.9" /></svg>
          </span>
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em' }}>Dheva<span style={{ color: '#1E5BD6' }}>tegnologie</span></span>
        </Link>
        <nav className="site-nav" style={{ display: 'flex', alignItems: 'center', gap: 30, fontSize: 15, fontWeight: 500, color: '#41506B' }}>
          <a href="/#features" style={{ color: 'inherit', textDecoration: 'none' }}>ฟีเจอร์</a>
          <a href="/#screens" style={{ color: 'inherit', textDecoration: 'none' }}>หน้าจอโปรแกรม</a>
          <a href="/#pricing" style={{ color: 'inherit', textDecoration: 'none' }}>ราคา</a>
          <a href="/#faq" style={{ color: 'inherit', textDecoration: 'none' }}>คำถามที่พบบ่อย</a>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/sport/auth/signin" style={{ fontSize: 15, fontWeight: 600, color: '#1E5BD6', textDecoration: 'none' }}>เข้าสู่ระบบ</Link>
          <Link href={DEMO_URL} style={{ fontSize: 15, fontWeight: 600, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg,#1E5BD6,#163F94)', padding: '11px 22px', borderRadius: 10, boxShadow: '0 6px 18px rgba(30,91,214,0.3)' }}>ดูเดโม</Link>
        </div>
      </div>
    </header>
  );
}
