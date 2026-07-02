import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';

// Redis client for rate limiting
let redisClient: ReturnType<typeof createClient> | null = null;
let redisConnected = false;

// Initialize Redis client
const initRedis = async () => {
  if (redisClient) return redisClient;

  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 5000
      }
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
      redisConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('Redis connected for rate limiting');
      redisConnected = true;
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    redisConnected = false;
    return null;
  }
};

// Initialize Redis on module load
initRedis();

/**
 * In-memory fallback for rate limiting when Redis is unavailable
 */
class InMemoryRateLimiter {
  private store: Map<string, { count: number; resetAt: number }[]> = new Map();

  async increment(key: string, windowSeconds: number): Promise<number> {
    const now = Date.now();
    const resetAt = now + (windowSeconds * 1000);
    
    // Get or create entry
    let entries = this.store.get(key) || [];
    
    // Remove expired entries
    entries = entries.filter(entry => entry.resetAt > now);
    
    // Add new request
    entries.push({ count: 1, resetAt });
    
    // Store back
    this.store.set(key, entries);
    
    // Return total count
    return entries.length;
  }

  async ttl(key: string): Promise<number> {
    const now = Date.now();
    const entries = this.store.get(key) || [];
    
    // Find the earliest reset time
    const validEntries = entries.filter(entry => entry.resetAt > now);
    if (validEntries.length === 0) return -1;
    
    const earliestReset = Math.min(...validEntries.map(e => e.resetAt));
    return Math.ceil((earliestReset - now) / 1000);
  }

  // Clean up old entries periodically
  cleanup() {
    const now = Date.now();
    for (const [key, entries] of this.store.entries()) {
      const validEntries = entries.filter(entry => entry.resetAt > now);
      if (validEntries.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, validEntries);
      }
    }
  }
}

const memoryLimiter = new InMemoryRateLimiter();

// Cleanup every 5 minutes
setInterval(() => memoryLimiter.cleanup(), 5 * 60 * 1000);

/**
 * Rate limiting middleware
 * Enforces per-minute and per-day limits for each API key
 */
export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  // Skip rate limiting if no API key is attached (shouldn't happen after auth)
  if (!req.apiKey) {
    return next();
  }

  const { id, rateLimitPerMinute, rateLimitPerDay, keyType } = req.apiKey;

  // For internal keys with very high limits, bypass rate limiting
  // (e.g., if limit is set to 999999 or higher)
  if (keyType === 'internal' && rateLimitPerMinute >= 999999) {
    return next();
  }

  try {
    const keyPrefix = `ratelimit:${id}`;
    const minuteKey = `${keyPrefix}:minute`;
    const dayKey = `${keyPrefix}:day`;

    let minuteCount = 0;
    let dayCount = 0;
    let minuteTTL = 60;
    let dayTTL = 86400;

    // Try to use Redis, fall back to in-memory if unavailable
    if (redisConnected && redisClient) {
      try {
        // Check and increment minute counter
        const minuteResult = await redisClient.multi()
          .incr(minuteKey)
          .expire(minuteKey, 60)
          .ttl(minuteKey)
          .exec();

        // Check and increment day counter
        const dayResult = await redisClient.multi()
          .incr(dayKey)
          .expire(dayKey, 86400)
          .ttl(dayKey)
          .exec();

        if (minuteResult && minuteResult[0]) {
          minuteCount = minuteResult[0] as unknown as number;
          minuteTTL = minuteResult[2] as unknown as number || 60;
        }

        if (dayResult && dayResult[0]) {
          dayCount = dayResult[0] as unknown as number;
          dayTTL = dayResult[2] as unknown as number || 86400;
        }
      } catch (redisError) {
        console.warn('Redis error, falling back to in-memory rate limiting:', redisError);
        // Fall back to in-memory
        minuteCount = await memoryLimiter.increment(minuteKey, 60);
        dayCount = await memoryLimiter.increment(dayKey, 86400);
        minuteTTL = await memoryLimiter.ttl(minuteKey);
        dayTTL = await memoryLimiter.ttl(dayKey);
      }
    } else {
      // Use in-memory limiter
      minuteCount = await memoryLimiter.increment(minuteKey, 60);
      dayCount = await memoryLimiter.increment(dayKey, 86400);
      minuteTTL = await memoryLimiter.ttl(minuteKey);
      dayTTL = await memoryLimiter.ttl(dayKey);
    }

    // Check if limits exceeded
    if (minuteCount > rateLimitPerMinute) {
      res.set('X-RateLimit-Limit', rateLimitPerMinute.toString());
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', (Date.now() + minuteTTL * 1000).toString());
      res.set('Retry-After', minuteTTL.toString());
      
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${rateLimitPerMinute} requests per minute.`,
        retryAfter: minuteTTL
      });
    }

    if (dayCount > rateLimitPerDay) {
      res.set('X-RateLimit-Limit', rateLimitPerDay.toString());
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', (Date.now() + dayTTL * 1000).toString());
      res.set('Retry-After', dayTTL.toString());
      
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Daily rate limit exceeded. Maximum ${rateLimitPerDay} requests per day.`,
        retryAfter: dayTTL
      });
    }

    // Set rate limit headers
    res.set('X-RateLimit-Limit-Minute', rateLimitPerMinute.toString());
    res.set('X-RateLimit-Remaining-Minute', (rateLimitPerMinute - minuteCount).toString());
    res.set('X-RateLimit-Limit-Day', rateLimitPerDay.toString());
    res.set('X-RateLimit-Remaining-Day', (rateLimitPerDay - dayCount).toString());

    next();
  } catch (error) {
    console.error('Rate limiting error:', error);
    // On error, reject the request (fail closed)
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Service is temporarily unavailable. Please try again later.'
    });

    // On error, allow the request through (fail open)
    // next();
  }
};

// Per-IP rate limiter for unauthenticated public endpoints (e.g. /supply/*).
const PUBLIC_RATE_LIMIT_PER_MINUTE = Number(process.env.PUBLIC_RATE_LIMIT_PER_MINUTE) || 30;

export const publicRateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const minuteKey = `ratelimit:public:${ip}:minute`;

  try {
    let minuteCount = 0;
    let minuteTTL = 60;

    if (redisConnected && redisClient) {
      try {
        const result = await redisClient.multi()
          .incr(minuteKey)
          .expire(minuteKey, 60)
          .ttl(minuteKey)
          .exec();
        if (result && result[0]) {
          minuteCount = result[0] as unknown as number;
          minuteTTL = (result[2] as unknown as number) || 60;
        }
      } catch (redisError) {
        console.warn('Redis error, falling back to in-memory public rate limiting:', redisError);
        minuteCount = await memoryLimiter.increment(minuteKey, 60);
        minuteTTL = await memoryLimiter.ttl(minuteKey);
      }
    } else {
      minuteCount = await memoryLimiter.increment(minuteKey, 60);
      minuteTTL = await memoryLimiter.ttl(minuteKey);
    }

    if (minuteCount > PUBLIC_RATE_LIMIT_PER_MINUTE) {
      res.set('Retry-After', minuteTTL.toString());
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${PUBLIC_RATE_LIMIT_PER_MINUTE} requests per minute.`,
        retryAfter: minuteTTL
      });
      return;
    }

    res.set('X-RateLimit-Limit-Minute', PUBLIC_RATE_LIMIT_PER_MINUTE.toString());
    res.set('X-RateLimit-Remaining-Minute', Math.max(0, PUBLIC_RATE_LIMIT_PER_MINUTE - minuteCount).toString());
    next();
  } catch (error) {
    console.error('Public rate limiting error:', error);
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Service is temporarily unavailable. Please try again later.'
    });
    return;
  }
};

// Generous per-IP guard meant to run BEFORE authentication on protected routes.
const AUTH_IP_RATE_LIMIT_PER_MINUTE = Number(process.env.AUTH_IP_RATE_LIMIT_PER_MINUTE) || 300;

export const authIpThrottle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const minuteKey = `ratelimit:authip:${ip}:minute`;

  try {
    let minuteCount = 0;
    let minuteTTL = 60;

    if (redisConnected && redisClient) {
      try {
        const result = await redisClient.multi()
          .incr(minuteKey)
          .expire(minuteKey, 60)
          .ttl(minuteKey)
          .exec();
        if (result && result[0]) {
          minuteCount = result[0] as unknown as number;
          minuteTTL = (result[2] as unknown as number) || 60;
        }
      } catch (redisError) {
        console.warn('Redis error, falling back to in-memory auth IP throttle:', redisError);
        minuteCount = await memoryLimiter.increment(minuteKey, 60);
        minuteTTL = await memoryLimiter.ttl(minuteKey);
      }
    } else {
      minuteCount = await memoryLimiter.increment(minuteKey, 60);
      minuteTTL = await memoryLimiter.ttl(minuteKey);
    }

    if (minuteCount > AUTH_IP_RATE_LIMIT_PER_MINUTE) {
      res.set('Retry-After', minuteTTL.toString());
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${AUTH_IP_RATE_LIMIT_PER_MINUTE} requests per minute.`,
        retryAfter: minuteTTL
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Auth IP throttle error:', error);
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Service is temporarily unavailable. Please try again later.'
    });
    return;
  }
};

// Export function to close Redis connection gracefully
export const closeRedis = async () => {
  if (redisClient && redisConnected) {
    await redisClient.quit();
    console.log('Redis connection closed');
  }
};
