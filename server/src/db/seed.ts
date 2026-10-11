import "dotenv/config";
import bcrypt from "bcrypt";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const seedPassword = process.env.SEED_TEST_PASSWORD;
const seedPrefix = "seed.";
const requestIdPrefix = "11111111-ec00-4000-8000-";

const accounts = [
  ...Array.from({ length: 5 }, (_, index) => ({
    email: `${seedPrefix}requester${String(index + 1).padStart(2, "0")}@ecmu.test`,
    fullName: `Demo Requester ${String(index + 1).padStart(2, "0")}`,
    stakeholderType: "student",
    role: "requester",
  })),
  {
    email: `${seedPrefix}registrar@ecmu.test`,
    fullName: "Demo Registrar Admin",
    stakeholderType: "other",
    role: "registrar",
  },
  {
    email: `${seedPrefix}saso@ecmu.test`,
    fullName: "Demo SASO Admin",
    stakeholderType: "other",
    role: "saso",
  },
  {
    email: `${seedPrefix}finance@ecmu.test`,
    fullName: "Demo Finance Admin",
    stakeholderType: "other",
    role: "finance",
  },
  {
    email: `${seedPrefix}administrator@ecmu.test`,
    fullName: "Demo Administrator",
    stakeholderType: "other",
    role: "administrator",
  },
];

async function seed() {
  if (!seedPassword || seedPassword === "ChangeMe123!") {
    throw new Error(
      "Set a non-default SEED_TEST_PASSWORD in server/.env before seeding.",
    );
  }

  const passwordHash = await bcrypt.hash(seedPassword, 12);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO roles (name)
       VALUES ('requester'), ('registrar'), ('saso'), ('finance'), ('administrator')
       ON CONFLICT (name) DO NOTHING`,
    );

    const roleIds = new Map<string, number>();
    const roleResult = await client.query<{ id: number; name: string }>(
      "SELECT id, name FROM roles WHERE name = ANY($1::varchar[])",
      [accounts.map((account) => account.role)],
    );
    for (const role of roleResult.rows) {
      roleIds.set(role.name, role.id);
    }

    const requesterIds: string[] = [];
    const accountIds = new Map<string, string>();

    for (const account of accounts) {
      const roleId = roleIds.get(account.role);
      if (roleId === undefined) {
        throw new Error(`Required role is missing: ${account.role}`);
      }

      await client.query(
        `INSERT INTO users (email, password_hash, full_name, stakeholder_type, active)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (email) DO NOTHING`,
        [account.email, passwordHash, account.fullName, account.stakeholderType],
      );

      const userResult = await client.query<{
        id: string;
        full_name: string;
        stakeholder_type: string;
      }>(
        `SELECT id, full_name, stakeholder_type
         FROM users
         WHERE email = $1`,
        [account.email],
      );
      const user = userResult.rows[0];
      if (
        !user ||
        user.full_name !== account.fullName ||
        user.stakeholder_type !== account.stakeholderType
      ) {
        throw new Error(
          `Seed account conflicts with existing account ${account.email}; no changes committed.`,
        );
      }

      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [user.id, roleId],
      );

      const assignedRole = await client.query(
        "SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2",
        [user.id, roleId],
      );
      if (assignedRole.rowCount !== 1) {
        throw new Error(`Failed to assign role ${account.role} to ${account.email}`);
      }

      accountIds.set(account.email, user.id);
      if (account.role === "requester") {
        requesterIds.push(user.id);
      }
    }

    const documentTypes = await client.query<{
      id: string;
      name: string;
      base_fee: string;
      currency: string;
    }>(
      `SELECT id, name, base_fee, currency
       FROM document_types
       WHERE active = TRUE
       ORDER BY id`,
    );
    if (documentTypes.rows.length === 0) {
      throw new Error("No active document types exist; cannot create sample requests.");
    }

    let requestsInserted = 0;
    for (let index = 0; index < 30; index += 1) {
      const requestNumber = index + 1;
      const requesterId = requesterIds[index % requesterIds.length];
      const documentType = documentTypes.rows[index % documentTypes.rows.length];
      const requestId = `${requestIdPrefix}${requestNumber.toString(16).padStart(12, "0")}`;
      const purpose = `Demo request ${String(requestNumber).padStart(2, "0")} for ${documentType.name}`;
      const additionalDetails = {
        seed: "e-cmu-demo",
        seedRequestNumber: requestNumber,
      };

      const inserted = await client.query(
        `INSERT INTO requests (
           id, requester_id, document_type_id, status, purpose,
           additional_details, fee_amount, fee_currency
         )
         VALUES ($1, $2, $3, 'submitted', $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          requestId,
          requesterId,
          documentType.id,
          purpose,
          JSON.stringify(additionalDetails),
          documentType.base_fee,
          documentType.currency,
        ],
      );
      requestsInserted += inserted.rowCount ?? 0;

      const existing = await client.query<{
        requester_id: string;
        document_type_id: string;
        purpose: string | null;
        additional_details: { seed?: string; seedRequestNumber?: number };
      }>(
        `SELECT requester_id, document_type_id, purpose, additional_details
         FROM requests
         WHERE id = $1`,
        [requestId],
      );
      const request = existing.rows[0];
      if (
        !request ||
        request.requester_id !== requesterId ||
        request.document_type_id !== documentType.id ||
        request.purpose !== purpose ||
        request.additional_details.seed !== "e-cmu-demo" ||
        request.additional_details.seedRequestNumber !== requestNumber
      ) {
        throw new Error(
          `Request ID collision at sample request ${requestNumber}; no changes committed.`,
        );
      }
    }

    await client.query("COMMIT");
    console.log("Seed completed.");
    console.log(`Accounts ensured: ${accountIds.size} (5 requesters, 4 admins).`);
    console.log(`New sample requests inserted: ${requestsInserted}; total seed requests: 30.`);
    console.log(
      "New demo accounts use SEED_TEST_PASSWORD; reruns do not reset existing account passwords.",
    );
    console.log(
      "Demo account emails:\n" +
        accounts.map((account) => `- ${account.email} (${account.role})`).join("\n"),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

try {
  await seed();
} catch (error) {
  console.error("Seed failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
