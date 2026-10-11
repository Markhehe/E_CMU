const KNOWN_ROLES = new Set([
  "requester",
  "registrar",
  "saso",
  "finance",
  "administrator",
]);

/**
 * Require the authenticated user to have at least one of the supplied roles.
 * Use this after requireAuth because it expects req.user to exist.
 *
 * Examples:
 *   requireRole("finance")
 *   requireRole("registrar", "administrator")
 */
export function requireRole(...allowedRoles) {
  if (allowedRoles.length === 0) {
    throw new Error("requireRole() needs at least one allowed role");
  }

  const normalizedAllowedRoles = allowedRoles.map((role) => {
    const normalizedRole = String(role).trim().toLowerCase();

    if (!KNOWN_ROLES.has(normalizedRole)) {
      throw new Error(`Unknown authorization role: ${role}`);
    }

    return normalizedRole;
  });

  return function roleAuthorizationMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const userRoles = Array.isArray(req.user.roles)
      ? req.user.roles
          .filter((role) => typeof role === "string")
          .map((role) => role.trim().toLowerCase())
      : [];

    const hasAllowedRole = normalizedAllowedRoles.some((role) =>
      userRoles.includes(role),
    );

    if (!hasAllowedRole) {
      return res.status(403).json({
        error: "Insufficient permissions",
      });
    }

    next();
  };
}
