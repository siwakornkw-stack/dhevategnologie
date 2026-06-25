'use client';

import { signOut } from 'next-auth/react';

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/' })}
      className="text-sm font-medium text-gray-500 hover:text-red-500 transition"
    >
      ออกจากระบบ
    </button>
  );
}
