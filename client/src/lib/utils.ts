import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const transportationMethods = [
  { value: "drove_alone", label: "Drove Alone", multiplier: 0 },
  { value: "public_transport", label: "Public Transport", multiplier: 1 },
  { value: "carpool", label: "Carpooling", multiplier: 1.5 },
  { value: "work_from_home", label: "Worked from Home", multiplier: 2 },
];

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}
