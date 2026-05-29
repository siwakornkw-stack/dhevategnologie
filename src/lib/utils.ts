import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getCurrentYear = (): number => {
  return new Date().getFullYear();
};

export function getScrollBarWidth() {
  return window.innerWidth - document.documentElement.clientWidth;
}
