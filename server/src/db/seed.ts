import "dotenv/config";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db, pool } from "./index.js";
import { documentTypes, roles, userRoles, users } from "./schema.js";

const SEED_PASSWORD = process.env.SEED_TEST_PASSWORD ?? "ChangeMe123!";
const PASSWORD_ROUNDS = 12;

const roleSeed = [
  { name: "requester" },
  { name: "registrar" },
  { name: "saso" },
  { name: "finance" },
  { name: "administrator" },
];

const userSeed = [
  {
    email: "student.test@example.com",
    fullName: "Test Student",
    stakeholderType: "student" as const,
    role: "requester",
  },
  {
    email: "professor.test@example.com",
    fullName: "Test Professor",
    stakeholderType: "professor" as const,
    role: "requester",
  },
  {
    email: "registrar.admin@example.com",
    fullName: "Registrar Administrator",
    stakeholderType: "other" as const,
    role: "registrar",
  },
  {
    email: "saso.admin@example.com",
    fullName: "SASO Administrator",
    stakeholderType: "other" as const,
    role: "saso",
  },
  {
    email: "finance.admin@example.com",
    fullName: "Finance Administrator",
    stakeholderType: "other" as const,
    role: "finance",
  },
  {
    email: "system.admin@example.com",
    fullName: "System Administrator",
    stakeholderType: "other" as const,
    role: "administrator",
  },
];

const documentTypeSeed = [
  {
    name: "Transcript",
    description: "Official academic transcript",
    baseFee: "10.00",
    currency: "PHP",
    processingDays: 5,
    active: true,
  },
  {
    name: "Certificate of Enrollment",
    description: "Official proof of current enrollment",
    baseFee: "100.00",
    currency: "PHP",
    processingDays: 3,
    active: true,
  },
  {
    name: "Certificate of Completion",
    description: "Official certificate confirming completion",
    baseFee: "100.00",
    currency: "PHP",
    processingDays: 3,
    active: true,
  },
];

async function seed() {
  if (SEED_PASSWORD === "ChangeMe123!") {
    console.warn(
      "Warning: using the default seed password. Set SEED_TEST_PASSWORD in server/.env.",
    );
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, PASSWORD_ROUNDS);

  await db.transaction(async (tx) => {
    for (const role of roleSeed) {
      await tx
        .insert(roles)
        .values(role)
        .onConflictDoUpdate({
          target: roles.name,
          set: { name: role.name },
        });
    }

    for (const documentType of documentTypeSeed) {
      await tx
        .insert(documentTypes)
        .values(documentType)
        .onConflictDoUpdate({
          target: documentTypes.name,
          set: {
            description: documentType.description,
            baseFee: documentType.baseFee,
            currency: documentType.currency,
            processingDays: documentType.processingDays,
            active: documentType.active,
          },
        });
    }

    for (const account of userSeed) {
      await tx
        .insert(users)
        .values({
          email: account.email,
          passwordHash,
          fullName: account.fullName,
          stakeholderType: account.stakeholderType,
          active: true,
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            passwordHash,
            fullName: account.fullName,
            stakeholderType: account.stakeholderType,
            active: true,
            updatedAt: new Date(),
          },
        });

      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, account.email))
        .limit(1);

      const [role] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, account.role))
        .limit(1);

      if (!user || !role) {
        throw new Error(`Could not find user or role for ${account.email}`);
      }

      await tx
        .insert(userRoles)
        .values({ userId: user.id, roleId: role.id })
        .onConflictDoNothing();
    }
  });

  console.log("Seed completed successfully.");
  console.table(
    userSeed.map(({ email, role }) => ({
      email,
      role,
      password: "value from SEED_TEST_PASSWORD",
    })),
  );
  console.log(
    "Document types:",
    documentTypeSeed.map(({ name }) => name).join(", "),
  );
}

try {
  await seed();
} catch (error) {
  console.error("Seed failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
