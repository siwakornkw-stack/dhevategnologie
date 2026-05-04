import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - 88ARENA',
};

export default function TermsPage() {
  return (
    <section className="py-20">
      <div className="wrapper">
        <div className="max-w-[800px] mx-auto">
          <p className="text-gray-500 dark:text-gray-400 font-medium mb-2">
            Updated <span className="text-gray-800 ml-1 inline-block dark:text-white/90">1 January 2025</span>
          </p>
          <h1 className="mb-12 text-4xl font-semibold text-gray-800 dark:text-white/90">Terms of Service / ข้อกำหนดการใช้บริการ</h1>

          <div className="space-y-8 text-gray-500 dark:text-gray-400 leading-7">
            <div>
              <h2 className="mb-3 text-2xl font-semibold text-gray-800 dark:text-white/90">1. การยอมรับข้อกำหนด</h2>
              <p>
                โดยการเข้าใช้งานหรือสมัครสมาชิกกับ 88ARENA ถือว่าคุณยอมรับข้อกำหนดและเงื่อนไขการให้บริการฉบับนี้ทั้งหมด
                หากคุณไม่ยอมรับข้อกำหนดเหล่านี้ กรุณาหยุดใช้บริการ
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-2xl font-semibold text-gray-800 dark:text-white/90">2. การจองสนาม</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>การจองสนามจะสมบูรณ์เมื่อได้รับการยืนยันจากระบบหรือผู้ดูแล</li>
                <li>ผู้ใช้งานต้องมาถึงสนามตรงเวลาที่จอง</li>
                <li>หากต้องการยกเลิกการจอง กรุณายกเลิกล่วงหน้าอย่างน้อย 24 ชั่วโมง</li>
                <li>การจองที่ไม่ชำระเงินภายในเวลาที่กำหนดจะถูกยกเลิกโดยอัตโนมัติ</li>
              </ul>
            </div>

            <div>
              <h2 className="mb-3 text-2xl font-semibold text-gray-800 dark:text-white/90">3. การชำระเงินและการคืนเงิน</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>ราคาที่แสดงเป็นราคารวม VAT แล้ว</li>
                <li>การชำระเงินผ่าน Stripe มีความปลอดภัยและเข้ารหัสทุกการทำธุรกรรม</li>
                <li>การคืนเงินจะพิจารณาเป็นรายกรณี กรุณาติดต่อทีมงาน</li>
                <li>88ARENA ขอสงวนสิทธิ์ในการปฏิเสธการคืนเงินในกรณีที่ลูกค้าไม่มาใช้บริการตามเวลาที่จอง</li>
              </ul>
            </div>

            <div>
              <h2 className="mb-3 text-2xl font-semibold text-gray-800 dark:text-white/90">4. กฎการใช้สนาม</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>ห้ามนำอาหารหรือเครื่องดื่มเข้าสนาม ยกเว้นน้ำดื่ม</li>
                <li>สวมรองเท้าที่เหมาะสมกับประเภทกีฬาทุกครั้ง</li>
                <li>ดูแลทรัพย์สินส่วนตัวของตนเอง ทางสนามไม่รับผิดชอบต่อการสูญหาย</li>
                <li>ห้ามทำลายทรัพย์สินของสนาม หากเกิดความเสียหายต้องรับผิดชอบค่าซ่อมแซม</li>
                <li>เคารพผู้ใช้สนามท่านอื่น</li>
              </ul>
            </div>

            <div>
              <h2 className="mb-3 text-2xl font-semibold text-gray-800 dark:text-white/90">5. โปรแกรมสะสมแต้ม</h2>
              <p>
                แต้มสะสมเป็นสิทธิประโยชน์เพิ่มเติม 88ARENA ขอสงวนสิทธิ์ในการเปลี่ยนแปลง ระงับ หรือยกเลิกโปรแกรมสะสมแต้มได้
                โดยไม่ต้องแจ้งให้ทราบล่วงหน้า แต้มไม่สามารถแลกเป็นเงินสดได้
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-2xl font-semibold text-gray-800 dark:text-white/90">6. ความรับผิดชอบ</h2>
              <p>
                88ARENA ไม่รับผิดชอบต่อการบาดเจ็บหรืออุบัติเหตุที่เกิดขึ้นระหว่างการใช้สนาม
                ผู้ใช้บริการต้องรับผิดชอบต่อความปลอดภัยของตนเองและผู้ที่มาด้วย
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-2xl font-semibold text-gray-800 dark:text-white/90">7. การเปลี่ยนแปลงข้อกำหนด</h2>
              <p>
                88ARENA ขอสงวนสิทธิ์ในการแก้ไขข้อกำหนดและเงื่อนไขได้ทุกเมื่อ
                การใช้บริการต่อเนื่องหลังจากการเปลี่ยนแปลงถือว่าคุณยอมรับข้อกำหนดใหม่
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-2xl font-semibold text-gray-800 dark:text-white/90">8. ติดต่อเรา</h2>
              <p>
                หากมีข้อสงสัยเกี่ยวกับข้อกำหนดการใช้บริการ กรุณาติดต่อเราผ่าน{' '}
                <a href="/contact" className="text-primary-500 font-semibold hover:underline">หน้าติดต่อเรา</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
