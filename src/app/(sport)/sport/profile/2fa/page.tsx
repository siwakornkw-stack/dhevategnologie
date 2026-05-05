'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export default function TwoFAPage() {
  const router = useRouter();
  const t = useTranslations('twoFa');
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [backupCode, setBackupCode] = useState('');
  const [showBackupInput, setShowBackupInput] = useState(false);

  useEffect(() => {
    fetch('/api/sport/auth/2fa/setup')
      .then((r) => r.json())
      .then((d) => {
        setEnabled(d.enabled);
        if (!d.enabled) {
          setQrDataUrl(d.qrDataUrl ?? null);
          setSecret(d.secret ?? '');
        }
        setLoading(false);
      })
      .catch(() => { toast.error(t('loadError')); setLoading(false); });
  }, [t]);

  async function handleSubmit(action: 'enable' | 'disable') {
    if (code.length !== 6) return;
    setSubmitting(true);
    const res = await fetch('/api/sport/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, action }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { toast.error(data.error); return; }

    if (action === 'enable' && data.backupCodes) {
      setBackupCodes(data.backupCodes);
    }
    toast.success(data.enabled ? t('enableSuccess') : t('disableSuccess'));
    setEnabled(data.enabled);
    setCode('');
    if (!data.enabled) router.push('/sport/profile');
  }

  async function handleUseBackup() {
    if (!backupCode.trim()) return;
    setSubmitting(true);
    const res = await fetch('/api/sport/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: backupCode.trim().toUpperCase(), action: 'useBackup' }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { toast.error(data.error); return; }
    toast.success('ปิดการใช้งาน 2FA ด้วยรหัสสำรองสำเร็จ');
    router.push('/sport/profile');
  }

  const inputCls = 'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400 transition text-center tracking-widest text-xl';

  if (loading) return <div className="wrapper py-20 text-center text-gray-400">{t('loading')}</div>;

  // Show backup codes after enabling
  if (backupCodes) {
    return (
      <div className="wrapper py-8 max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-amber-300 dark:border-amber-700 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">รหัสสำรอง (Backup Codes)</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">บันทึกรหัสเหล่านี้ไว้ในที่ปลอดภัย ใช้ได้ครั้งละ 1 รหัสหากเข้าถึง authenticator ไม่ได้</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((c) => (
              <code key={c} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm font-mono text-center text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                {c}
              </code>
            ))}
          </div>
          <button
            onClick={() => { setBackupCodes(null); router.push('/sport/profile'); }}
            className="w-full py-2.5 rounded-xl gradient-btn text-white text-sm font-semibold"
          >
            บันทึกแล้ว กลับหน้าโปรไฟล์
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wrapper py-8 max-w-md space-y-6">
      <div className="flex items-center gap-3">
        <a href="/sport/profile" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">{t('backToProfile')}</a>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
      </div>

      {enabled ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-6 space-y-5">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">✅</span>
            </div>
            <p className="font-semibold text-gray-900 dark:text-white">{t('enabledTitle')}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('enabledDesc')}</p>
          </div>

          {!showBackupInput ? (
            <>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">{t('disableCodeLabel')}</label>
                <input className={inputCls} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} />
              </div>
              <button
                onClick={() => handleSubmit('disable')}
                disabled={submitting || code.length !== 6}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition disabled:opacity-60"
              >
                {submitting ? t('disabling') : t('disableBtn')}
              </button>
              <button
                type="button"
                onClick={() => setShowBackupInput(true)}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              >
                ใช้รหัสสำรองแทน
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">รหัสสำรอง (Backup Code)</label>
                <input
                  className={`${inputCls} tracking-normal text-base uppercase`}
                  placeholder="XXXXXXXXXX"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value.toUpperCase().slice(0, 10))}
                  maxLength={10}
                />
              </div>
              <button
                onClick={handleUseBackup}
                disabled={submitting || !backupCode.trim()}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition disabled:opacity-60"
              >
                {submitting ? 'กำลังดำเนินการ...' : 'ปิด 2FA ด้วยรหัสสำรอง'}
              </button>
              <button
                type="button"
                onClick={() => setShowBackupInput(false)}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              >
                ใช้ authenticator แทน
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-6 space-y-5">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white mb-1">{t('step1')}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('step1Desc')}</p>
          </div>

          {qrDataUrl && (
            <div className="flex justify-center">
              <div className="bg-white p-3 rounded-xl border border-gray-200">
                <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
              </div>
            </div>
          )}

          {secret && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">{t('secretLabel')}</p>
              <code className="text-sm font-mono text-gray-700 dark:text-gray-300 break-all">{secret}</code>
            </div>
          )}

          <div>
            <p className="font-semibold text-gray-900 dark:text-white mb-1">{t('step2')}</p>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">{t('step2CodeLabel')}</label>
            <input className={inputCls} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} />
          </div>

          <button
            onClick={() => handleSubmit('enable')}
            disabled={submitting || code.length !== 6}
            className="w-full gradient-btn py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? t('enabling') : t('enableBtn')}
          </button>
        </div>
      )}
    </div>
  );
}
