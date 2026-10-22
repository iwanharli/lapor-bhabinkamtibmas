import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Gabungkan class Tailwind; class yang datang belakangan menimpa yang bertentangan. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
