import { NextRequest } from 'next/server';

// Global memory store for rate limiting: IP -> array of timestamps
const rateLimitStore = new Map<string, number[]>();

export function checkRateLimit(request: NextRequest, windowMs: number, maxRequests: number): { allowed: boolean; ip: string } {
  // Securely parse IP (handle multiple IPs in x-forwarded-for, take the first/leftmost proxy IP)
  const forwardedFor = request.headers.get('x-forwarded-for');
  let ip = 'unknown-ip';
  
  if (forwardedFor) {
    ip = forwardedFor.split(',')[0].trim();
  } else {
    // Fallback if not behind a proxy
    ip = request.headers.get('x-real-ip') || 'unknown-ip';
  }

  const now = Date.now();
  const timestamps = rateLimitStore.get(ip) || [];
  
  // Clean up old timestamps
  const validTimestamps = timestamps.filter(t => now - t < windowMs);
  
  let allowed = true;
  if (validTimestamps.length >= maxRequests) {
    allowed = false;
  } else {
    validTimestamps.push(now);
  }
  
  // ALWAYS update the store so the array is pruned (fixes the memory leak)
  rateLimitStore.set(ip, validTimestamps);
  
  // Periodic garbage collection to prevent unbounded growth of Map for idle IPs
  // Clean up every 100 requests (heuristic)
  if (Math.random() < 0.01) {
    for (const [key, times] of rateLimitStore.entries()) {
      const valid = times.filter(t => now - t < windowMs);
      if (valid.length === 0) {
        rateLimitStore.delete(key);
      } else {
        rateLimitStore.set(key, valid);
      }
    }
  }

  return { allowed, ip };
}
