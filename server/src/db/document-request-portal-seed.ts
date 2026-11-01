import "dotenv/config";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db, pool } from "./index.js";
import { documentTypes, roles, userRoles, users } from "./schema.js";

const TEST_PASSWORD = process.env.SEED_TEST_PASSWORD ?? "ChangeMe123!";
const PASSWORD_ROUNDS = 12;

const roleSeed = [
  { name: "requester" },
  { name: "processor" },
  { name: "finance" },
  { name: "administrator" },
];

const documentTypeSeed = [
  {
    name: "Transcript",
    description: "Official academic transcript",
    baseFee: "10.00",
    currency: "USD",
    processingDays: 5,
    active: true,
  },
  {
    name: "Certificate of Enrollment",
    description: "Official proof of current enrollment",
    baseFee: "8.00",
    currency: "USD",
    processingDays: 3,
    active: true,
  },
  {
    name: "Certificate of Completion",
    description: "Official certificate confirming completion",
    baseFee: "8.00",
    currency: "USD",
    processingDays: 3,
    active: true,
  },
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
    email: "processor.test@example.com",
    fullName: "Test Processor",
    stakeholderType: "other" as const,
    role: "processor",
  },
  {
    email: "admin.test@example.com",
    fullName: "Test Administrator",
    stakeholderType: "other" as const,
    role: "administrator",
  },
];

async function seed() {
  if (TEST_PASSWORD === "ChangeMe123!") {
    console.warn(
      "Warning: using the default seed password. Set SEED_TEST_PASSWORD before seeding.",
    );
  }

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, PASSWORD_ROUNDS);

  await db.transaction(async (tx) => {
    // Roles and document types are safe to run repeatedly because their names are unique.
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

    for (const testUser of userSeed) {
      await tx
        .insert(users)
        .values({
          email: testUser.email,
          passwordHash,
          fullName: testUser.fullName,
          stakeholderType: testUser.stakeholderType,
          active: true,
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            passwordHash,
            fullName: testUser.fullName,
            stakeholderType: testUser.stakeholderType,
            active: true,
            updatedAt: new Date(),
          },
        });

      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, testUser.email))
        .limit(1);

      const [role] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, testUser.role))
        .limit(1);

      if (!user || !role) {
        throw new Error(
          `Could not find seeded user or role for ${testUser.email}`,
        );
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
      password: TEST_PASSWORD,
    })),
  );
  console.log(
    "Document types seeded:",
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
