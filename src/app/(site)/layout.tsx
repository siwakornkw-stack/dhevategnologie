import { SessionProvider } from 'next-auth/react';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import { auth } from '@/lib/auth';
import { SiteHeader } from '@/components/site/site-header';
import { DEMO_URL } from '@/lib/site';
import Link from 'next/link';

const ibm = IBM_Plex_Sans_Thai({ subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], display: 'swap' });

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <SessionProvider session={session}>
      <div className={ibm.className} style={{ background: '#ffffff', color: '#0C1B36', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <SiteHeader />
        <div style={{ flex: 1 }}>{children}</div>

        <footer style={{ background: '#0A1B3C', color: '#9FB0CE', padding: '60px 28px 30px' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>
            <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 40, paddingBottom: 40, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#1E5BD6,#163F94)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 6.5v11L12 22l9-4.5v-11L12 2z" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" /></svg>
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Dheva<span style={{ color: '#79A6F5' }}>tegnologie</span></span>
                </div>
                <p style={{ fontSize: 14.5, lineHeight: 1.65, margin: '0 0 18px', maxWidth: 300 }}>ระบบจัดการสนามกีฬาครบวงจรโดย Dheva Technologie ช่วยให้สนามและอารีน่ารับจองออนไลน์และขายหน้าร้านได้ในระบบเดียว</p>
                <div style={{ fontSize: 13, color: '#7689AC' }}>บริษัท เทวะ เทคโนโลจี จำกัด</div>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>ผลิตภัณฑ์</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: 14.5 }}>
                  <a href="/#features" style={{ color: 'inherit', textDecoration: 'none' }}>ฟีเจอร์</a>
                  <a href="/#pricing" style={{ color: 'inherit', textDecoration: 'none' }}>ราคา</a>
                  <a href="/#screens" style={{ color: 'inherit', textDecoration: 'none' }}>หน้าจอโปรแกรม</a>
                  <Link href={DEMO_URL} style={{ color: 'inherit', textDecoration: 'none' }}>ดูเดโม</Link>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>บริษัท</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: 14.5 }}>
                  <Link href="/contact" style={{ color: 'inherit', textDecoration: 'none' }}>ติดต่อฝ่ายขาย</Link>
                  <Link href="/sport/auth/signin" style={{ color: 'inherit', textDecoration: 'none' }}>เข้าสู่ระบบ</Link>
                  <a href="/#faq" style={{ color: 'inherit', textDecoration: 'none' }}>คำถามที่พบบ่อย</a>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>ช่วยเหลือ</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: 14.5 }}>
                  <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>นโยบายความเป็นส่วนตัว</Link>
                  <Link href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>เงื่อนไขการใช้งาน</Link>
                  <Link href="/contact" style={{ color: 'inherit', textDecoration: 'none' }}>ติดต่อเรา</Link>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 24, fontSize: 13.5, color: '#7689AC', flexWrap: 'wrap', gap: 12 }}>
              <div>© {new Date().getFullYear()} Dheva Technologie. สงวนลิขสิทธิ์</div>
              <div style={{ display: 'flex', gap: 22 }}>
                <Link href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>เงื่อนไขการใช้งาน</Link>
                <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>นโยบายความเป็นส่วนตัว</Link>
                <Link href="/admin" style={{ color: 'inherit', textDecoration: 'none' }}>หลังบ้าน</Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </SessionProvider>
  );
}
