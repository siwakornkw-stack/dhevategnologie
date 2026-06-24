'use client';

import { Input } from '@/components/ui/inputs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/inputs/textarea';
import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { DEMO_URL } from '@/lib/site';

export default function ContactPage() {
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = {
      firstName: (form.elements.namedItem('firstName') as HTMLInputElement).value,
      lastName: (form.elements.namedItem('lastName') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
    };

    setIsLoading(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่');
        return;
      }
      toast.success('ส่งข้อมูลเรียบร้อย! ทีมงานจะติดต่อกลับโดยเร็ว');
      form.reset();
    } catch {
      toast.error('การเชื่อมต่อมีปัญหา กรุณาลองใหม่');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="relative overflow-hidden py-24">
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary-400/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-violet-400/20 blur-3xl pointer-events-none" />
      <div className="wrapper relative">
        <div className="max-w-[760px] mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
              ติดต่อฝ่ายขาย DhevaSuite
            </h1>
            <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
              อยากได้ระบบจองและขายหน้าร้านสำหรับสนามของคุณ? กรอกข้อมูลเพื่อขอใบเสนอราคาและนัดดูเดโม
              ทีมงานจะติดต่อกลับภายใน 24 ชั่วโมง
            </p>
            <Link
              href={DEMO_URL}
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              อยากลองเองก่อน? ดูเดโมจริง →
            </Link>
          </div>

          <div className="border rounded-3xl p-8 sm:p-12 bg-white border-gray-100 dark:bg-dark-primary dark:border-gray-800 shadow-theme-sm">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="firstName">ชื่อ</Label>
                  <Input id="firstName" name="firstName" type="text" placeholder="สมชาย" required />
                </div>
                <div>
                  <Label htmlFor="lastName">นามสกุล</Label>
                  <Input id="lastName" name="lastName" type="text" placeholder="ใจดี" required />
                </div>
                <div className="col-span-full">
                  <Label htmlFor="email">อีเมล</Label>
                  <Input id="email" name="email" type="email" placeholder="you@email.com" required />
                </div>
                <div className="col-span-full">
                  <Label htmlFor="message">รายละเอียด (ชื่อสนาม จำนวนคอร์ต เบอร์ติดต่อ ฯลฯ)</Label>
                  <Textarea id="message" name="message" rows={6} placeholder="เล่าให้เราฟังเกี่ยวกับสนามของคุณ และสิ่งที่อยากได้จากระบบ" required />
                </div>
                <div className="col-span-full">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white transition h-12 py-3 px-6 w-full font-medium text-sm rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'กำลังส่ง...' : 'ขอใบเสนอราคา / นัดดูเดโม'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
