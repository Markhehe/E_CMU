const privilegedRoles = new Set([
    "admin",
    "administrator",
    "registrar",
    "registrar_staff",
]);

export function requiresStudentLoginVerification(roles) {
    const normalizedRoles = roles.map((role) => role.toLowerCase());
    return normalizedRoles.includes("student")
        && !normalizedRoles.some((role) => privilegedRoles.has(role));
}
