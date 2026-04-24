'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export function SignUpForm() {
  const searchParams = useSearchParams();
  const t = useTranslations('auth');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '', referralCode: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setForm((f) => ({ ...f, referralCode: ref.toUpperCase() }));
  }, [searchParams]);

  const inputClass = "w-full h-12 rounded-full border border-gray-200 dark:border-gray-700 px-5 text-sm text-gray-800 dark:text-white placeholder:text-gray-400 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition";
  const errorInputClass = "w-full h-12 rounded-full border border-red-400 dark:border-red-500 px-5 text-sm text-gray-800 dark:text-white placeholder:text-gray-400 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400 transition";

  function setField(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name || form.name.length < 2) e.name = t('nameMinLen');
    if (!form.email) e.email = t('emailRequired');
    if (!/^0[0-9]{8,9}$/.test(form.phone)) e.phone = t('phoneInvalid');
    if (form.password.length < 6) e.password = t('passwordMinLen');
    if (form.password !== form.confirmPassword) e.confirmPassword = t('passwordMismatch');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/sport/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, password: form.password, referralCode: form.referralCode || undefined }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? `${t('errorGeneric')} (${res.status})`);
      setRegistered(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (registered) {
    return (
      <div className="text-center space-y-4">
        <div className="text-5xl">📧</div>
        <h2 className="font-semibold text-gray-900 dark:text-white">{t('checkInbox')}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('signupSuccessMsg', { email: form.email })}
        </p>
        <p className="text-xs text-gray-400">{t('linkExpires24h')}</p>
        <a
          href="/sport/auth/signin"
          className="inline-block mt-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          {t('backToSigninLink')}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('name')}</label>
        <input type="text" className={errors.name ? errorInputClass : inputClass} placeholder={t('yourName')} value={form.name} onChange={(e) => setField('name', e.target.value)} required />
        {errors.name && <p className="text-xs text-red-500 mt-1 pl-4">{errors.name}</p>}
      </div>

      {/* Email */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('email')}</label>
        <input type="email" className={errors.email ? errorInputClass : inputClass} placeholder="example@email.com" value={form.email} onChange={(e) => setField('email', e.target.value)} required />
        {errors.email && <p className="text-xs text-red-500 mt-1 pl-4">{errors.email}</p>}
      </div>

      {/* Phone */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
          {t('phone')} <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">📱</span>
          <input
            type="tel"
            className={`${errors.phone ? errorInputClass : inputClass} pl-10`}
            placeholder="0812345678"
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
            maxLength={10}
            required
          />
        </div>
        {errors.phone
          ? <p className="text-xs text-red-500 mt-1 pl-4">{errors.phone}</p>
          : <p className="text-xs text-gray-400 mt-1 pl-4">{t('phoneHint')}</p>
        }
      </div>

      {/* Password */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('password')}</label>
        <div className="relative">
          <input type={showPass ? 'text' : 'password'} className={`${errors.password ? errorInputClass : inputClass} pr-12`} placeholder={t('passwordNew')} value={form.password} onChange={(e) => setField('password', e.target.value)} required />
          <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{showPass ? '🙈' : '👁️'}</button>
        </div>
        {errors.password && <p className="text-xs text-red-500 mt-1 pl-4">{errors.password}</p>}
      </div>

      {/* Confirm password */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('confirmPassword')}</label>
        <input type={showPass ? 'text' : 'password'} className={errors.confirmPassword ? errorInputClass : inputClass} placeholder={t('confirmPassword')} value={form.confirmPassword} onChange={(e) => setField('confirmPassword', e.target.value)} required />
        {errors.confirmPassword && <p className="text-xs text-red-500 mt-1 pl-4">{errors.confirmPassword}</p>}
      </div>

      {/* Referral (optional) */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('referralCode')} <span className="text-xs text-gray-400">{t('referralOptional')}</span></label>
        <input type="text" className={inputClass} placeholder={t('referralHint')} value={form.referralCode} onChange={(e) => setField('referralCode', e.target.value.toUpperCase().slice(0, 8))} maxLength={8} />
      </div>

      <button type="submit" disabled={loading} className="w-full gradient-btn text-white font-semibold h-12 rounded-full text-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2">
        {loading ? t('signupLoading') : t('signupButton')}
      </button>
    </form>
  );
}
