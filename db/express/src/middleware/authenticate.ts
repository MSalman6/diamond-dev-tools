import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { api_keys } from '../models/api_keys';

// Extend Express Request to include API key info
declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: number;
        label: string;
        keyType: 'internal' | 'external';
        rateLimitPerMinute: number;
        rateLimitPerDay: number;
      };
    }
  }
}

/**
 * Authentication middleware to validate API keys
 * Supports both Bearer token and X-API-Key header formats
 * Validates origin for internal keys
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract API key from Authorization header (Bearer token) or X-API-Key header
    let apiKey: string | undefined;
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    } else if (req.headers['x-api-key']) {
      apiKey = req.headers['x-api-key'] as string;
    }

    if (!apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key is required. Provide via Authorization: Bearer <key> or X-API-Key header.'
      });
    }

    // Find all enabled API keys
    const allKeys = await api_keys.findAll({
      where: { enabled: true }
    });

    if (!allKeys || allKeys.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }

    // Check the provided key against all stored hashed keys
    let matchedKey: api_keys | null = null;
    
    for (const key of allKeys) {
      const isMatch = await bcrypt.compare(apiKey, key.key_hash);
      if (isMatch) {
        matchedKey = key;
        break;
      }
    }

    if (!matchedKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }

    // For internal keys, validate origin
    if (matchedKey.key_type === 'internal') {
      const origin = req.headers.origin || req.headers.referer;
      
      if (!origin) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Internal API keys require an Origin or Referer header'
        });
      }

      // Parse allowed origins from JSON
      let allowedOrigins: string[] = [];
      if (matchedKey.allowed_origins) {
        try {
          allowedOrigins = JSON.parse(matchedKey.allowed_origins);
        } catch (e) {
          console.error('Failed to parse allowed_origins:', e);
          return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Configuration error with API key'
          });
        }
      }

      // Match on exact scheme + host (parsed), never substring/prefix.
      const originMatches = allowedOrigins.some((allowed: string) => {
        try {
          const originUrl = new URL(origin);
          const allowedUrl = new URL(allowed);
          return originUrl.protocol === allowedUrl.protocol && originUrl.host === allowedUrl.host;
        } catch (e) {
          return false;
        }
      });

      if (!originMatches) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Origin not allowed for this API key'
        });
      }
    }

    // Update last_used_at timestamp (async, don't wait)
    api_keys.update(
      { last_used_at: new Date() },
      { where: { id: matchedKey.id } }
    ).catch(err => console.error('Failed to update last_used_at:', err));

    // Attach API key info to request for use in rate limiting
    req.apiKey = {
      id: matchedKey.id,
      label: matchedKey.label,
      keyType: matchedKey.key_type,
      rateLimitPerMinute: matchedKey.rate_limit_per_minute || 60,
      rateLimitPerDay: matchedKey.rate_limit_per_day || 10000
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
};
