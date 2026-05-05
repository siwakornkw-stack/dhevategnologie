'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface PointTransaction {
  id: string;
  points: number;
  type: string;
  note: string | null;
  createdAt: string;
}

interface Profile {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  image: string | null;
  role: string;
  createdAt: string;
  emailVerified: string | null;
  points: number;
  notifEmail: boolean;
  notifInApp: boolean;
  twoFactorEnabled: boolean;
  referralCode: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const t = useTranslations('profile');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifInApp, setNotifInApp] = useState(true);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [referralData, setReferralData] = useState<{ referralCode: string; referralLink: string; referralCount: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pointsTxns, setPointsTxns] = useState<PointTransaction[]>([]);
  const [pointsBalance, setPointsBalance] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/sport/profile')
      .then((r) => {
        if (r.status === 401) { router.push('/sport/auth/signin'); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setProfile(data);
        setName(data.name ?? '');
        setPhone(data.phone ?? '');
        setImageUrl(data.image ?? null);
        setNotifEmail(data.notifEmail ?? true);
        setNotifInApp(data.notifInApp ?? true);
      })
      .catch(() => toast.error('ไม่สามารถโหลดข้อมูลโปรไฟล์ได้'));

    fetch('/api/sport/referral')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setReferralData(d); })
      .catch(() => {});

    fetch('/api/sport/points')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setPointsBalance(d.points); setPointsTxns(d.transactions ?? []); } })
      .catch(() => {});
  }, [router]);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/sport/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('edit.uploadError'));
      setImageUrl(data.url);
      await fetch('/api/sport/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, image: data.url }),
      });
      setProfile((p) => p ? { ...p, image: data.url } : p);
      toast.success(t('edit.uploadSuccess'));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  }

  async function handleSave(e: React.SyntheticEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = { name, phone, notifEmail, notifInApp };
      if (currentPassword && newPassword) { body.currentPassword = currentPassword; body.newPassword = newPassword; }

      const res = await fetch('/api/sport/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setProfile((p) => p ? { ...p, name: data.name, phone: data.phone, notifEmail, notifInApp } : p);
      setCurrentPassword('');
      setNewPassword('');
      toast.success(t('edit.saveSuccess'));
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch('/api/sport/profile', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('ลบบัญชีสำเร็จ');
      router.push('/sport/auth/signin');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  async function copyReferralLink() {
    if (!referralData) return;
    await navigator.clipboard.writeText(referralData.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inputCls = 'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 transition';

  if (!profile) {
    return (
      <div className="wrapper py-20 text-center text-gray-400">
        <div className="text-4xl mb-3">⏳</div>{t('loading')}
      </div>
    );
  }

  return (
    <div className="wrapper py-8 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <a href="/sport" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">{t('backToHome')}</a>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">👤 {t('title')}</h1>
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-6 flex items-center gap-4">
        <label className="relative w-16 h-16 flex-shrink-0 cursor-pointer group">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold">
            {imageUrl ? (
              <img src={imageUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              (profile.name ?? profile.email)[0].toUpperCase()
            )}
          </div>
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
            <span className="text-white text-xs">{uploadingImage ? '⏳' : '📷'}</span>
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
        </label>
        <div className="flex-1">
          <p className="font-semibold text-gray-900 dark:text-white text-lg">{profile.name ?? t('noName')}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{profile.email}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${profile.role === 'ADMIN' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
              {profile.role === 'ADMIN' ? '⚙️ Admin' : t('roleUser')}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              ⭐ {profile.points} {t('pointsLabel')}
            </span>
            {profile.twoFactorEnabled && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">🔐 2FA</span>
            )}
            {profile.emailVerified ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{t('emailVerified')}</span>
            ) : (
              <a href="/sport/auth/resend-verification" className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 transition">{t('emailUnverified')}</a>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{t('memberSince')}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {new Date(profile.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Referral Section */}
      {referralData && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">{t('referral.title')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('referral.desc')} <strong className="text-primary-600 dark:text-primary-400">{t('referral.bonus')}</strong> {t('referral.descSuffix')}
          </p>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 mb-0.5">{t('referral.codeLabel')}</p>
              <p className="font-mono font-bold text-primary-600 dark:text-primary-400 text-lg tracking-widest">{referralData.referralCode}</p>
              <p className="text-xs text-gray-400 truncate mt-0.5">{referralData.referralLink}</p>
            </div>
            <button
              onClick={copyReferralLink}
              className="flex-shrink-0 px-3 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition"
            >
              {copied ? t('referral.copied') : t('referral.copy')}
            </button>
          </div>
          <p className="text-xs text-gray-400">{t('referral.friendCount', { count: referralData.referralCount })}</p>
        </div>
      )}

      {/* Edit Form */}
      <form onSubmit={handleSave} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900 dark:text-white">{t('edit.title')}</h2>

        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">{t('edit.name')}</label>
          <input className={inputCls} placeholder={t('edit.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">{t('edit.email')}</label>
          <input className={`${inputCls} opacity-60 cursor-not-allowed`} value={profile.email} disabled />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">{t('edit.phone')}</label>
          <input className={inputCls} placeholder="0812345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            {t('edit.changePassword')} <span className="text-xs font-normal text-gray-400">{t('edit.changePasswordHint')}</span>
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">{t('edit.currentPassword')}</label>
              <input className={inputCls} type="password" placeholder="••••••••" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">{t('edit.newPassword')}</label>
              <input className={inputCls} type="password" placeholder={t('edit.newPasswordPlaceholder')} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className="gradient-btn px-6 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
            {saving ? t('edit.saving') : t('edit.save')}
          </button>
        </div>
      </form>

      {/* Notification Preferences */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">{t('notifSection.title')}</h2>
        <div className="space-y-3">
          {[
            { key: 'notifEmail', label: t('notifSection.email'), value: notifEmail, set: setNotifEmail },
            { key: 'notifInApp', label: t('notifSection.inApp'), value: notifInApp, set: setNotifInApp },
          ].map(({ key, label, value, set }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
              <button
                type="button"
                onClick={() => set(!value)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-60"
        >
          {t('notifSection.saveSettings')}
        </button>
      </div>

      {/* Points History */}
      {pointsTxns.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">{t('points.title')}</h2>
            <span className="px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {pointsBalance ?? profile.points} {t('pointsLabel')}
            </span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {pointsTxns.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0',
                    tx.points > 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400'
                  )}>
                    {tx.points > 0 ? '+' : '-'}
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{tx.note ?? (tx.type === 'EARN' ? t('points.earned') : t('points.redeemed'))}</p>
                    <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>
                <span className={cn(
                  'text-sm font-semibold',
                  tx.points > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                )}>
                  {tx.points > 0 ? '+' : ''}{tx.points} {t('pointsLabel')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-6 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">{t('security.title')}</h2>
        <a
          href="/sport/profile/2fa"
          className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🔐</span>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{t('security.twoFa')}</p>
              <p className="text-xs text-gray-400">{t('security.twoFaHint')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile.twoFactorEnabled ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{t('security.twoFaOn')}</span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">{t('security.twoFaOff')}</span>
            )}
            <span className="text-gray-400">→</span>
          </div>
        </a>
      </div>

      {/* Delete Account */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-200 dark:border-red-900/40 p-6 space-y-4">
        <h2 className="font-semibold text-red-600 dark:text-red-400">ลบบัญชี</h2>
        {!showDeleteConfirm ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">ลบบัญชีและข้อมูลทั้งหมดอย่างถาวร</p>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition"
            >
              ลบบัญชี
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">การดำเนินการนี้ไม่สามารถย้อนกลับได้ กรุณากรอกรหัสผ่านเพื่อยืนยัน</p>
            <input
              className={inputCls}
              type="password"
              placeholder="รหัสผ่านปัจจุบัน"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}
                className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting || !deletePassword}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition disabled:opacity-60"
              >
                {deleting ? 'กำลังลบ...' : 'ยืนยันลบบัญชี'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
