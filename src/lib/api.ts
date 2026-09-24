// Central API URL configuration
// If NEXT_PUBLIC_BACKEND_URL is set, use the external backend (e.g. Render).
// Otherwise, fall back to the local Next.js API route.
export const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

export function getAnalyzeUrl(): string {
  return `${API_BASE_URL}/api/analyze`;
}

export function getOcrUrl(): string {
  return `${API_BASE_URL}/api/ocr`;
}
