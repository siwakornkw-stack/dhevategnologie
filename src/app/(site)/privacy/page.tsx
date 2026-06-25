import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'นโยบายความเป็นส่วนตัว - Dhevategnologie',
};

export default function PrivacyPage() {
  return (
    <section className="py-20">
      <div className="wrapper">
        <div className="max-w-[800px] mx-auto">
          <h1 className="mb-3 text-4xl font-semibold text-gray-800 dark:text-white/90">
            นโยบายความเป็นส่วนตัว
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium mb-12">
            Dhevategnologie โดย บริษัท เทวะ เทคโนโลจี จำกัด (Dheva Technologie)
          </p>

          <div className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-800 dark:text-white/90">ข้อมูลที่เราเก็บ</h2>
            <p className="text-gray-500 dark:text-gray-400 leading-7">
              เราเก็บข้อมูลที่จำเป็นต่อการให้บริการ ได้แก่ ชื่อ อีเมล เบอร์โทรศัพท์
              ข้อมูลการจองและการขาย รวมถึงข้อมูลการใช้งานระบบ เพื่อใช้ในการให้บริการ
              ดูแลบัญชีผู้ใช้ และปรับปรุงระบบให้ดียิ่งขึ้น
            </p>
          </div>

          <div className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-800 dark:text-white/90">การชำระเงินและความปลอดภัย</h2>
            <p className="text-gray-500 dark:text-gray-400 leading-7">
              เราไม่จัดเก็บข้อมูลบัตรเครดิตไว้บนเซิร์ฟเวอร์ของเรา การชำระเงินทั้งหมดดำเนินการผ่าน
              Stripe ซึ่งเป็นผู้ให้บริการรับชำระเงินมาตรฐานสากล ข้อมูลที่รับส่งระหว่างคุณกับระบบ
              ถูกเข้ารหัสด้วย SSL และระบบรองรับการยืนยันตัวตนสองขั้นตอน (2FA)
            </p>
          </div>

          <div className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-800 dark:text-white/90">สิทธิเหนือข้อมูลของคุณ</h2>
            <p className="text-gray-500 dark:text-gray-400 leading-7">
              คุณสามารถขอเข้าถึง แก้ไข หรือขอให้ลบข้อมูลส่วนบุคคลที่เราจัดเก็บไว้ได้
              ยกเว้นข้อมูลที่จำเป็นต้องเก็บตามข้อกำหนดทางกฎหมาย การบริหารจัดการ
              หรือความปลอดภัยของระบบ โดยติดต่อทีมงานของเราได้ทุกเมื่อ
            </p>
          </div>

          <div className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-800 dark:text-white/90">การเปิดเผยข้อมูลต่อบุคคลที่สาม</h2>
            <p className="text-gray-500 dark:text-gray-400 leading-7">
              เราจะไม่ขายหรือเปิดเผยข้อมูลส่วนบุคคลของคุณให้แก่บุคคลที่สามเพื่อการตลาด
              เราเปิดเผยข้อมูลเฉพาะกับผู้ให้บริการที่จำเป็นต่อการทำงานของระบบ
              (เช่น ผู้ให้บริการรับชำระเงินและส่งอีเมล) เท่าที่จำเป็นเท่านั้น
            </p>
          </div>

          <div>
            <p className="text-gray-500 dark:text-gray-400 leading-7">
              มีคำถามเกี่ยวกับนโยบายนี้?{' '}
              <Link href="/contact" className="text-indigo-600 dark:text-indigo-400 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-sm">
                ติดต่อทีมงาน
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
