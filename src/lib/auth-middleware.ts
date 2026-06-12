import { verifyAccessToken, type JwtPayload, type UserRole } from './auth';

/**
 * Extract and verify the JWT from the Authorization header.
 * Returns the decoded payload or null if invalid/missing.
 */
export function verifyAuth(request: Request): JwtPayload | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  return verifyAccessToken(token);
}

/**
 * Create a role-checking function that can be used in API routes.
 * Returns the user payload if they have the required role, or an error response.
 */
export function requireRoles(...roles: UserRole[]) {
  return (request: Request): { user: JwtPayload } | { error: Response } => {
    const user = verifyAuth(request);

    if (!user) {
      return {
        error: new Response(JSON.stringify({ error: 'No autenticado' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      };
    }

    if (!roles.includes(user.rol)) {
      return {
        error: new Response(JSON.stringify({ error: 'No tiene permisos para realizar esta acción' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      };
    }

    return { user };
  };
}
