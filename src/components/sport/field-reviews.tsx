'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { name: string | null; image: string | null };
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          onMouseEnter={() => onChange && setHovered(star)}
          onMouseLeave={() => onChange && setHovered(0)}
          className={`text-2xl transition ${onChange ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <span className={(hovered || value) >= star ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}>
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

export function FieldReviews({ fieldId }: { fieldId: string }) {
  const { data: session } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = useCallback(async () => {
    const res = await fetch(`/api/sport/fields/${fieldId}/reviews`);
    if (res.ok) setReviews(await res.json());
    setLoading(false);
  }, [fieldId]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sport/fields/${fieldId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('รีวิวสำเร็จ!');
      setComment('');
      fetchReviews();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">รีวิว</h2>
        {avg && (
          <span className="flex items-center gap-1 text-yellow-500 font-semibold text-sm">
            ★ {avg}
            <span className="text-gray-400 font-normal">({reviews.length} รีวิว)</span>
          </span>
        )}
      </div>

      {session && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">เขียนรีวิว</p>
          <StarRating value={rating} onChange={setRating} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="แสดงความคิดเห็น (ไม่บังคับ)"
            rows={3}
            maxLength={500}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
          <button
            type="submit"
            disabled={submitting}
            className="gradient-btn text-white text-sm font-semibold px-5 py-2 rounded-full disabled:opacity-60"
          >
            {submitting ? 'กำลังส่ง...' : 'ส่งรีวิว'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-8">กำลังโหลด...</div>
      ) : reviews.length === 0 ? (
        <div className="text-center text-gray-400 py-8">ยังไม่มีรีวิว</div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300 text-sm font-semibold">
                  {r.user.name?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{r.user.name ?? 'ผู้ใช้'}</p>
                  <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('th-TH')}</p>
                </div>
                <div className="ml-auto">
                  <StarRating value={r.rating} />
                </div>
              </div>
              {r.comment && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{r.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
