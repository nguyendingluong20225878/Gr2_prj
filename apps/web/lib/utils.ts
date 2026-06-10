import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Hàm tiện ích để gộp class Tailwind an toàn (xử lý xung đột class)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}