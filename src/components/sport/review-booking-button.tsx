'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface Props {
  fieldId: string;
  fieldName: string;
  existingRating?: number;
  existingComment?: string | null;
}

export function ReviewBookingButton({ fieldId, fieldName, existingRating, existingComment }: Props) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(existingRating ?? 0);
  const [comment, setComment] = useState(existingComment ?? '');
  const [hovered, setHovered] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const currentRating = saved ? rating : (existingRating ?? 0);
  const hasReview = currentRating > 0;

  async function handleSubmit() {
    if (!rating) { toast.error('กรุณาเลือกคะแนน'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/sport/fields/${fieldId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? 'เกิดข้อผิดพลาด');
      toast.success(hasReview ? 'อัพเดทรีวิวแล้ว' : 'ขอบคุณสำหรับรีวิว! ⭐');
      setSaved(true);
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1 ${
          hasReview
            ? 'border-yellow-400/50 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
      >
        ⭐ {hasReview ? `${currentRating}★ แก้ไขรีวิว` : 'รีวิวสนาม'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-6 w-full max-w-sm shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg"
            >
              ✕
            </button>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">รีวิวสนาม</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{fieldName}</p>

            <div className="flex gap-1 mb-2 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  className="text-4xl transition-transform hover:scale-110 cursor-pointer leading-none"
                >
                  <span className={(hovered || rating) >= star ? 'text-yellow-400' : 'text-gray-200 dark:text-gray-700'}>
                    ★
                  </span>
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-5 h-4">
              {rating > 0 ? ['', 'แย่มาก', 'แย่', 'พอใช้', 'ดี', 'ดีมาก'][rating] : ''}
            </p>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="บอกเล่าประสบการณ์ของคุณ... (ไม่บังคับ)"
              rows={3}
              maxLength={500}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-1 mb-5">{comment.length}/500</p>

            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 h-10 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !rating}
                className="flex-1 h-10 rounded-full gradient-btn text-white text-sm font-semibold disabled:opacity-50"
              >
                {loading ? 'กำลังบันทึก...' : hasReview ? 'อัพเดท' : 'ส่งรีวิว'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
