import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { transportationMethods } from "@shared/utils";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export { transportationMethods };

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

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatPercentage(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value);
}

export function validateCommuteDistance(distance: number): { isValid: boolean; error?: string } {
  if (typeof distance !== 'number') {
    return { isValid: false, error: 'Distance must be a number' };
  }
  if (distance <= 0) {
    return { isValid: false, error: 'Distance must be greater than 0' };
  }
  if (distance > 200) {
    return { isValid: false, error: 'Distance cannot exceed 200 kilometers' };
  }
  return { isValid: true };
}