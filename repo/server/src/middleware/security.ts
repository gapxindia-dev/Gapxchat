import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import helmet from 'helmet';

// JWT Secret Key configuration
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-temporary-chat-room-key-13245';

export interface AuthenticatedRequest extends Request {
  user?: {
    username: string;
    roomCode: string;
  };
}

/**
 * Generates a JWT token for a user session bound to a specific room
 */
export function generateToken(username: string, roomCode: string): string {
  // Sign token, valid for 24 hours (matching room lifecycle)
  return jwt.sign({ username, roomCode }, JWT_SECRET, { expiresIn: '24h' });
}

/**
 * Verifies a JWT token and returns the parsed payload
 */
export function verifyToken(token: string): { username: string; roomCode: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { username: string; roomCode: string };
  } catch (_err) { // eslint-disable-line no-unused-vars
    return null;
  }
}

/**
 * Express middleware to authenticate HTTP requests using the JWT token
 */
export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query?.token) {
    token = req.query.token as string;
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401).json({ error: 'Access denied. No token provided.' });
    return;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(403).json({ error: 'Invalid or expired token.' });
    return;
  }

  // Bind the decoded user payload to the request
  req.user = decoded;
  next();
}

/**
 * Express middleware to restrict operations to the room owner
 */
export function requireRoomOwner(db: any) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const room = await db.rooms.get(req.user.roomCode);
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      if (room.owner.toLowerCase() !== req.user.username.toLowerCase()) {
        res.status(403).json({ error: 'Forbidden. Owner privileges required.' });
        return;
      }

      next();
    } catch (err) {
      console.error('requireRoomOwner verification error:', err);
      res.status(500).json({ error: 'Database verification failed' });
    }
  };
}

// ----------------------------------------------------
// Security Configurations
// ----------------------------------------------------

// Global API rate-limiter (brute force protection)
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP. Please try again later.' },
});

// Join Room Rate limiter (tightened brute force defense for password checks)
export const joinRoomRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Limit room joins to 20 per 5 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many join attempts. Please check code or try again in a few minutes.' },
});

// Upload Rate limiter (prevents disk filling)
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15, // limit upload attempts
  message: { error: 'Too many files uploaded. Please wait a bit.' },
});

// Helmet Configuration
export const setupHelmet = () => {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://*"],
        mediaSrc: ["'self'", "data:", "blob:", "https://*"],
        connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
};

// CORS configuration matching dev proxy and standard production domains
export const setupCors = () => {
  return cors({
    origin: true, // Allow all origins for dev/sandbox ease (Vite proxy config manages header isolation)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });
};
