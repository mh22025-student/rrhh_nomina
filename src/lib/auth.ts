import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'nomina-sv-secret-key-2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'nomina-sv-refresh-key-2026';
const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '30d';

// Types
export type UserRole = 'ADMIN' | 'ANALISTA' | 'APROBADOR' | 'GERENCIA' | 'AUDITOR' | 'EMPLEADO';

export interface JwtPayload {
  userId: string;
  email: string;
  rol: UserRole;
  nombre: string;
  apellido: string;
  empleadoId?: string;
}

export interface RefreshTokenPayload {
  userId: string;
}

/**
 * Generate an access token (JWT) for the given payload
 */
export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions);
}

/**
 * Generate a refresh token for the given user ID
 */
export function generateRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY } as jwt.SignOptions);
}

/**
 * Verify and decode an access token. Returns null if invalid/expired.
 */
export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Verify and decode a refresh token. Returns null if invalid/expired.
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Compare a plain-text password against a bcrypt hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Get the refresh token expiry as a Date (30 days from now)
 */
export function getRefreshTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  return expiry;
}
