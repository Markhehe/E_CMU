import "dotenv/config";
import bcrypt from "bcrypt";
import { randomInt } from "node:crypto";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const seedPassword = process.env.SEED_TEST_PASSWORD;
const registrar = {
  email: "seed.registrar@ecmu.test",
  fullName: "Demo Registrar Admin",
  stakeholderType: "other",
  role: "registrar",
};
const studentEmailDomain = "@cityofmalabonuniversity.edu.ph";
const seedStudents = [
  { studentId: "20234821", firstName: "Truk", middleName: "N", lastName: "Bernard", birthdate: "2004-02-14" },
  { studentId: "20230164", firstName: "Gabriel", middleName: "Cruz", lastName: "Mendoza", birthdate: "2003-07-09" },
  { studentId: "20237350", firstName: "Bianca", middleName: "Lopez", lastName: "Garcia", birthdate: "2005-11-22" },
  { studentId: "20232987", firstName: "Nathan", middleName: "Flores", lastName: "Ramos", birthdate: "2004-04-03" },
  { studentId: "20236412", firstName: "Mikaela", middleName: "Torres", lastName: "Bautista", birthdate: "2002-09-18" },
  { studentId: "20239035", firstName: "Enzo", middleName: "Aquino", lastName: "Villanueva", birthdate: "2003-12-01" },
  { studentId: "20231578", firstName: "Camille", middleName: "Navarro", lastName: "Castillo", birthdate: "2005-01-27" },
  { studentId: "20235246", firstName: "Joaquin", middleName: "Dela Cruz", lastName: "Rivera", birthdate: "2004-06-12" },
  { studentId: "20240839", firstName: "Sofia", middleName: "Mercado", lastName: "Domingo", birthdate: "2005-03-08" },
  { studentId: "20246715", firstName: "Luis", middleName: "Pascual", lastName: "Fernandez", birthdate: "2003-10-25" },
  { studentId: "20243402", firstName: "Trisha", middleName: "Manalo", lastName: "Soriano", birthdate: "2004-08-16" },
  { studentId: "20249168", firstName: "Marco", middleName: "Garcia", lastName: "Salazar", birthdate: "2002-05-30" },
  { studentId: "20242573", firstName: "Danica", middleName: "Lim", lastName: "Andrada", birthdate: "2005-12-11" },
  { studentId: "20248041", firstName: "Paolo", middleName: "Dizon", lastName: "Francisco", birthdate: "2003-03-19" },
  { studentId: "20241396", firstName: "Andrea", middleName: "Soriano", lastName: "Valdez", birthdate: "2004-07-02" },
  { studentId: "20245824", firstName: "Rafael", middleName: "Tan", lastName: "Ocampo", birthdate: "2002-11-06" },
  { studentId: "20257629", firstName: "Nicole", middleName: "Abad", lastName: "Cabrera", birthdate: "2005-04-21" },
  { studentId: "20254053", firstName: "Adrian", middleName: "Bautista", lastName: "Pineda", birthdate: "2003-09-13" },
  { studentId: "20258917", firstName: "Francesca", middleName: "Ramos", lastName: "Gutierrez", birthdate: "2004-01-05" },
  { studentId: "20252360", firstName: "Miguel", middleName: "Santiago", lastName: "Lorenzo", birthdate: "2002-06-24" },
  { studentId: "20256485", firstName: "Patricia", middleName: "Villanueva", lastName: "Aguilar", birthdate: "2005-08-07" },
  { studentId: "20251704", firstName: "Xavier", middleName: "Castro", lastName: "Montes", birthdate: "2003-02-28" },
  { studentId: "20259532", firstName: "Isabella", middleName: "Reyes", lastName: "Luna", birthdate: "2004-10-17" },
  { studentId: "20263148", firstName: "Diego", middleName: "Mendoza", lastName: "Rosales", birthdate: "2005-05-14" },
  { studentId: "20268276", firstName: "Gabriella", middleName: "Torres", lastName: "Pascual", birthdate: "2003-08-31" },
  { studentId: "20265901", firstName: "Andres", middleName: "Flores", lastName: "Del Rosario", birthdate: "2002-12-20" },
  { studentId: "20260437", firstName: "Ma. Teresa", middleName: "Navarro", lastName: "Cortez", birthdate: "2004-03-26" },
  { studentId: "20266792", firstName: "Christian", middleName: "Aquino", lastName: "Estrada", birthdate: "2005-09-04" },
  { studentId: "20262015", firstName: "Angela", middleName: "Dela Cruz", lastName: "Padilla", birthdate: "2003-04-15" },
  { studentId: "20268643", firstName: "Joshua", middleName: "Mercado", lastName: "Serrano", birthdate: "2002-01-29" },
];
const registrationTestStudent = {
  studentId: "20230554",
  firstName: "Mark",
  middleName: "",
  lastName: "hehe",
  birthdate: "2004-05-23",
};
const legacySeedStudentIds = Array.from({ length: 5 }, (_, index) => {
  return `seed.requester${String(index + 1).padStart(2, "0")}`;
});
const legacySeedStudentEmails = legacySeedStudentIds.map(
  (studentId) => `${studentId}@ecmu.test`,
);
const documentCatalog = [
  { name: "Transcript of Records (TOR)", baseFee: "150.00" },
  { name: "Certificate of Enrollment", baseFee: "50.00" },
  { name: "Certificate of Graduation/Completion", baseFee: "100.00" },
  { name: "Certificate of Grading System", baseFee: "50.00" },
  { name: "Certificate of GWA", baseFee: "50.00" },
  { name: "Diploma (only issued once)", baseFee: "500.00" },
  { name: "Certified True Copy of Original Diploma", baseFee: "100.00" },
  { name: "CAV Certification", baseFee: "150.00" },
  { name: "Honorable Dismissal", baseFee: "200.00" },
  { name: "Certificate of No Pending Disciplinary Case", baseFee: "50.00" },
];
const requestStatuses = [
  "pending_review",
  "on_hold",
  "pending_payment",
  "clearance_review",
  "paid",
  "processing",
  "ready_for_pickup",
  "fulfilled",
  "rejected",
] as const;
const demoRequestStatuses = requestStatuses.filter(
  (status) => status !== "clearance_review",
);
const demoRequestFixtures = [
  { status: "pending_review", requesterIndex: 0 },
  { status: "on_hold", requesterIndex: 0 },
  { status: "pending_payment", requesterIndex: 1 },
  { status: "pending_payment", requesterIndex: 2 },
  { status: "paid", requesterIndex: 3 },
  { status: "processing", requesterIndex: 3 },
  { status: "ready_for_pickup", requesterIndex: 4 },
  { status: "fulfilled", requesterIndex: 5 },
  { status: "rejected", requesterIndex: 6 },
  { status: "rejected", requesterIndex: 7 },
  { status: "pending_review", requesterIndex: 8 },
  { status: "pending_payment", requesterIndex: 8 },
  { status: "rejected", requesterIndex: 9 },
  { status: "processing", requesterIndex: 10 },
  { status: "pending_payment", requesterIndex: 11 },
  { status: "rejected", requesterIndex: 12 },
  { status: "pending_payment", requesterIndex: 13 },
  { status: "ready_for_pickup", requesterIndex: 14 },
  { status: "pending_review", requesterIndex: 15 },
  { status: "processing", requesterIndex: 15 },
  { status: "pending_payment", requesterIndex: 16 },
  { status: "paid", requesterIndex: 17 },
  { status: "ready_for_pickup", requesterIndex: 18 },
  { status: "fulfilled", requesterIndex: 19 },
  { status: "pending_review", requesterIndex: 20 },
  { status: "paid", requesterIndex: 20 },
  { status: "on_hold", requesterIndex: 21 },
  { status: "rejected", requesterIndex: 22 },
  { status: "processing", requesterIndex: 23 },
  { status: "fulfilled", requesterIndex: 24 },
] satisfies { status: (typeof requestStatuses)[number]; requesterIndex: number }[];
const demoClearanceFileName = "Seeded demo clearance placeholder (no upload).svg";
const demoClearanceFileData = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="#f4f6f8"/><rect x="24" y="24" width="592" height="352" rx="16" fill="#ffffff" stroke="#d0d7de" stroke-width="2"/><text x="320" y="185" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#243b64">Seeded demo clearance</text><text x="320" y="230" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#667085">Placeholder - no picture uploaded</text></svg>',
).toString("base64")}`;

async function clearApplicationData(client: pg.PoolClient) {
  await client.query(`
    DO $$
    DECLARE
      application_tables text;
    BEGIN
      SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
      INTO application_tables
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> 'migrations';

      IF application_tables IS NOT NULL THEN
        EXECUTE 'TRUNCATE TABLE ' || application_tables || ' RESTART IDENTITY CASCADE';
      END IF;
    END
    $$
  `);
}

function fullName(student: (typeof seedStudents)[number] | typeof registrationTestStudent) {
  return [student.firstName, student.middleName, student.lastName]
    .filter(Boolean)
    .join(" ");
}

async function seedDemoRequests(
  client: pg.PoolClient,
  students: typeof seedStudents,
  registrarId: string,
) {
  if (
    demoRequestFixtures.length !== 30 ||
    demoRequestStatuses.some(
      (status) => !demoRequestFixtures.some((fixture) => fixture.status === status),
    ) ||
    demoRequestFixtures.some(
      (fixture) => fixture.requesterIndex >= students.length,
    )
  ) {
    throw new Error("Demo request fixtures must include 30 requests and every required request status.");
  }

  const studentAccounts = await client.query<{ id: string; email: string }>(
    `SELECT id, email
     FROM users
     WHERE email = ANY($1::text[])`,
    [students.map((student) => `${student.studentId}${studentEmailDomain}`)],
  );
  const studentIdsByEmail = new Map(
    studentAccounts.rows.map((account) => [account.email, account.id]),
  );
  const documentTypes = await client.query<{
    id: string;
    name: string;
    base_fee: string;
    currency: string;
  }>(
    `SELECT id, name, base_fee, currency
     FROM document_types
     WHERE name = ANY($1::text[])
     ORDER BY name`,
    [documentCatalog.map((documentType) => documentType.name)],
  );
  const documentTypesByName = new Map(
    documentTypes.rows.map((documentType) => [documentType.name, documentType]),
  );

  if (studentIdsByEmail.size !== students.length) {
    throw new Error("Could not resolve every seeded student account for demo requests.");
  }
  if (documentTypesByName.size !== documentCatalog.length) {
    throw new Error("Could not resolve every seeded document type for demo requests.");
  }

  const seededRequestIds: string[] = [];
  for (const [index, fixture] of demoRequestFixtures.entries()) {
    const student = students[fixture.requesterIndex];
    const requesterId = studentIdsByEmail.get(
      `${student.studentId}${studentEmailDomain}`,
    );
    const documentType = documentCatalog[index % documentCatalog.length];
    const documentTypeRecord = documentTypesByName.get(documentType.name);
    if (!requesterId || !documentTypeRecord) {
      throw new Error(`Could not resolve demo request fixture ${index + 1}.`);
    }

    const result = await client.query<{ id: string; status: string }>(
      `INSERT INTO requests
         (requester_id, document_type_id, status, purpose, additional_details,
          fee_amount, fee_currency, submitted_at, completed_at)
       VALUES
         ($1, $2, $3::public.request_status, $4, $5::jsonb, $6, $7,
          NOW() - ($8::int * INTERVAL '1 day'),
          CASE WHEN $3::public.request_status = 'fulfilled' THEN NOW() - ($8::int * INTERVAL '1 day') ELSE NULL END)
       RETURNING id, status`,
      [
        requesterId,
        documentTypeRecord.id,
        fixture.status,
        `Demo request for ${documentType.name}`,
        JSON.stringify({
          seed: "e-cmu-demo",
          quantity: 1,
          collectionMethod: "Pickup",
          paymentMethod: "Cash",
        }),
        documentTypeRecord.base_fee,
        documentTypeRecord.currency,
        index,
      ],
    );
    const seededRequest = result.rows[0];
    if (!seededRequest) {
      throw new Error(`Could not create demo request fixture ${index + 1}.`);
    }
    seededRequestIds.push(seededRequest.id);

    await client.query(
      `INSERT INTO request_status_history
         (request_id, from_status, to_status, changed_by, comment)
       VALUES ($1, NULL, $2, $3, 'Demo request seeded')`,
      [seededRequest.id, seededRequest.status, registrarId],
    );
  }

  return seededRequestIds.length;
}

async function seedDemoClearances(
  client: pg.PoolClient,
  students: typeof seedStudents,
  registrarId: string,
) {
  const studentAccounts = await client.query<{ id: string; email: string }>(
    `SELECT id, email
     FROM users
     WHERE email = ANY($1::text[])`,
    [students.map((student) => `${student.studentId}${studentEmailDomain}`)],
  );
  const studentIdsByEmail = new Map(
    studentAccounts.rows.map((account) => [account.email, account.id]),
  );

  if (studentIdsByEmail.size !== students.length) {
    throw new Error("Could not resolve every seeded student account for demo clearances.");
  }

  const studentIds = students.map((student) => (
    studentIdsByEmail.get(`${student.studentId}${studentEmailDomain}`)
  ));
  if (studentIds.some((id) => !id)) {
    throw new Error("A seeded student account is missing while creating demo clearances.");
  }

  await client.query(
    `DELETE FROM clearance_submissions
     WHERE user_id = ANY($1::bigint[])
       AND original_name = $2
       AND file_data = $3`,
    [studentIds, demoClearanceFileName, demoClearanceFileData],
  );

  for (const [index, studentId] of studentIds.entries()) {
    const isVerified = index < students.length / 2;
    const submittedAt = new Date(Date.now() - index * 24 * 60 * 60 * 1000);
    await client.query(
      `INSERT INTO clearance_submissions
         (user_id, file_data, original_name, status, submitted_at, reviewed_by, reviewed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        studentId,
        demoClearanceFileData,
        demoClearanceFileName,
        isVerified ? "verified" : "submitted",
        submittedAt,
        isVerified ? registrarId : null,
        isVerified ? submittedAt : null,
      ],
    );
  }

  return { verified: students.length / 2, pending: students.length / 2 };
}

async function removeLegacySeedStudents(client: pg.PoolClient) {
  const users = await client.query<{ id: string }>(
    `SELECT id
     FROM users
     WHERE email = ANY($1::text[])
        OR student_id = ANY($2::varchar[])
     FOR UPDATE`,
    [legacySeedStudentEmails, legacySeedStudentIds],
  );
  const userIds = users.rows.map((user) => user.id);

  if (userIds.length > 0) {
    await client.query(
      `UPDATE requests
       SET assigned_to = NULL
       WHERE assigned_to = ANY($1::bigint[])`,
      [userIds],
    );
    await client.query(
      `DELETE FROM payments
       WHERE request_id IN (
         SELECT id
         FROM requests
         WHERE requester_id = ANY($1::bigint[])
            OR additional_details->>'seed' = 'e-cmu-demo'
       )`,
      [userIds],
    );
    await client.query(
      "DELETE FROM payments WHERE confirmed_by = ANY($1::bigint[])",
      [userIds],
    );
    await client.query(
      `DELETE FROM requests
       WHERE requester_id = ANY($1::bigint[])
          OR additional_details->>'seed' = 'e-cmu-demo'`,
      [userIds],
    );
    await client.query(
      "DELETE FROM request_files WHERE uploaded_by = ANY($1::bigint[])",
      [userIds],
    );
    await client.query(
      "DELETE FROM request_comments WHERE author_id = ANY($1::bigint[])",
      [userIds],
    );
    await client.query(
      "DELETE FROM request_reviews WHERE reviewer_id = ANY($1::bigint[])",
      [userIds],
    );
    await client.query(
      "DELETE FROM request_status_history WHERE changed_by = ANY($1::bigint[])",
      [userIds],
    );
    await client.query(
      "UPDATE retrievals SET released_by = NULL WHERE released_by = ANY($1::bigint[])",
      [userIds],
    );
    await client.query(
      "DELETE FROM audit_logs WHERE actor_id = ANY($1::bigint[])",
      [userIds],
    );
    await client.query(
      "DELETE FROM clearance_submissions WHERE user_id = ANY($1::bigint[])",
      [userIds],
    );
    await client.query(
      "UPDATE clearance_submissions SET reviewed_by = NULL WHERE reviewed_by = ANY($1::bigint[])",
      [userIds],
    );
    await client.query(
      "DELETE FROM email_verification_tokens WHERE user_id = ANY($1::bigint[])",
      [userIds],
    );
    await client.query(
      "DELETE FROM user_roles WHERE user_id = ANY($1::bigint[])",
      [userIds],
    );
    await client.query("DELETE FROM users WHERE id = ANY($1::bigint[])", [
      userIds,
    ]);
  } else {
    await client.query(
      `DELETE FROM payments
       WHERE request_id IN (
         SELECT id FROM requests
         WHERE additional_details->>'seed' = 'e-cmu-demo'
       )`,
    );
    await client.query(
      "DELETE FROM requests WHERE additional_details->>'seed' = 'e-cmu-demo'",
    );
  }

  await client.query(
    `DELETE FROM student_directory AS directory
     WHERE directory.student_id = ANY($1::varchar[])
       AND NOT EXISTS (
         SELECT 1
         FROM users
         WHERE users.student_id = directory.student_id
       )`,
    [legacySeedStudentIds],
  );

  return userIds.length;
}

async function selectUnusedStudentId(
  client: pg.PoolClient,
  reservedIds: Set<string>,
) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const year = randomInt(2023, 2027);
    const sequence = String(randomInt(0, 10_000)).padStart(4, "0");
    const studentId = `${year}${sequence}`;
    if (reservedIds.has(studentId)) continue;

    const result = await client.query(
      `SELECT 1
       FROM student_directory
       WHERE student_id = $1
       UNION ALL
       SELECT 1
       FROM users
       WHERE student_id = $1 OR email = $2
       LIMIT 1`,
      [studentId, `${studentId}${studentEmailDomain}`],
    );
    if (result.rows.length === 0) {
      reservedIds.add(studentId);
      return studentId;
    }
  }

  throw new Error("Could not find an unused student ID after 1000 attempts.");
}

async function ensureStudentFixture(
  client: pg.PoolClient,
  student: (typeof seedStudents)[number],
  passwordHash: string,
  studentRoleId: number,
  reservedIds: Set<string>,
) {
  let resolvedStudent = student;
  let directoryRecord: {
    first_name: string;
    middle_name: string | null;
    last_name: string;
    birthdate: string;
  } | undefined;

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const directoryResult = await client.query<{
      first_name: string;
      middle_name: string | null;
      last_name: string;
      birthdate: string;
    }>(
      `SELECT first_name, middle_name, last_name, birthdate
       FROM student_directory
       WHERE student_id = $1`,
      [resolvedStudent.studentId],
    );
    directoryRecord = directoryResult.rows[0];
    if (
      directoryRecord &&
      directoryRecord.first_name === resolvedStudent.firstName &&
      directoryRecord.middle_name === resolvedStudent.middleName &&
      directoryRecord.last_name === resolvedStudent.lastName &&
      directoryRecord.birthdate === resolvedStudent.birthdate
    ) {
      break;
    }

    if (!directoryRecord) {
      const email = `${resolvedStudent.studentId}${studentEmailDomain}`;
      const accountResult = await client.query(
        `SELECT 1
         FROM users
         WHERE student_id = $1 OR email = $2
         LIMIT 1`,
        [resolvedStudent.studentId, email],
      );
      if (accountResult.rows.length === 0) {
        await client.query(
          `INSERT INTO student_directory
             (student_id, first_name, middle_name, last_name, birthdate)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            resolvedStudent.studentId,
            resolvedStudent.firstName,
            resolvedStudent.middleName,
            resolvedStudent.lastName,
            resolvedStudent.birthdate,
          ],
        );
        directoryRecord = {
          first_name: resolvedStudent.firstName,
          middle_name: resolvedStudent.middleName,
          last_name: resolvedStudent.lastName,
          birthdate: resolvedStudent.birthdate,
        };
        break;
      }
    }

    reservedIds.delete(resolvedStudent.studentId);
    resolvedStudent = {
      ...student,
      studentId: await selectUnusedStudentId(client, reservedIds),
    };
  }

  if (
    !directoryRecord ||
    directoryRecord.first_name !== resolvedStudent.firstName ||
    directoryRecord.middle_name !== resolvedStudent.middleName ||
    directoryRecord.last_name !== resolvedStudent.lastName ||
    directoryRecord.birthdate !== resolvedStudent.birthdate
  ) {
    throw new Error(
      `Could not reserve a matching directory record for seed student ${fullName(student)}.`,
    );
  }
  reservedIds.add(resolvedStudent.studentId);

  const email = `${resolvedStudent.studentId}${studentEmailDomain}`;
  await client.query(
    `INSERT INTO users
       (email, password_hash, full_name, stakeholder_type, active, student_id, email_verified)
     VALUES ($1, $2, $3, 'student', TRUE, $4, TRUE)
     ON CONFLICT (email) DO NOTHING`,
    [
      email,
      passwordHash,
      fullName(resolvedStudent),
      resolvedStudent.studentId,
    ],
  );

  const accountResult = await client.query<{
    id: string;
    full_name: string;
    stakeholder_type: string;
    student_id: string | null;
  }>(
    `SELECT id, full_name, stakeholder_type, student_id
     FROM users
     WHERE email = $1
     FOR UPDATE`,
    [email],
  );
  const account = accountResult.rows[0];
  if (
    !account ||
    account.full_name !== fullName(resolvedStudent) ||
    account.stakeholder_type !== "student" ||
    account.student_id !== resolvedStudent.studentId
  ) {
    throw new Error(
      `Seed student account conflicts with existing account ${email}; no changes committed.`,
    );
  }

  await client.query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [account.id, studentRoleId],
  );
  return resolvedStudent;
}

async function resolveStudentFixture(
  client: pg.PoolClient,
  fixture: (typeof seedStudents)[number],
  reservedIds: Set<string>,
) {
  const expectedFullName = fullName(fixture);
  const existingAccounts = await client.query<{
    email: string;
    student_id: string;
  }>(
    `SELECT email, student_id
     FROM users
     WHERE full_name = $1
       AND stakeholder_type = 'student'
       AND student_id IS NOT NULL
       AND right(email, length($2)) = $2
       ORDER BY student_id`,
    [expectedFullName, studentEmailDomain],
  );

  for (const existing of existingAccounts.rows) {
    if (
        existing.email !== `${existing.student_id}${studentEmailDomain}` ||
        !/^202[3-6]\d{4}$/.test(existing.student_id)
    ) {
        continue;
    }
    reservedIds.add(existing.student_id);

    const directory = await client.query<{
        first_name: string;
        middle_name: string | null;
        last_name: string;
        birthdate: string;
    }>(
        `SELECT first_name, middle_name, last_name, birthdate
         FROM student_directory
         WHERE student_id = $1`,
        [existing.student_id],
    );
    const record = directory.rows[0];
    if (
        record?.first_name === fixture.firstName &&
        record.middle_name === fixture.middleName &&
        record.last_name === fixture.lastName &&
        record.birthdate === fixture.birthdate
    ) {
        return { ...fixture, studentId: existing.student_id };
    }
  }

  async function isAvailable(studentId: string) {
    if (reservedIds.has(studentId)) return false;
    const result = await client.query(
      `SELECT 1
       FROM student_directory
       WHERE student_id = $1
       UNION ALL
       SELECT 1
       FROM users
       WHERE student_id = $1 OR email = $2
       LIMIT 1`,
      [studentId, `${studentId}${studentEmailDomain}`],
    );
    return result.rowCount === 0;
  }

  let studentId = fixture.studentId;
  if (!(await isAvailable(studentId))) {
    let foundAvailableId = false;
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const year = randomInt(2023, 2027);
      const sequence = String(randomInt(0, 10_000)).padStart(4, "0");
      studentId = `${year}${sequence}`;
      if (await isAvailable(studentId)) {
        foundAvailableId = true;
        break;
      }
    }
    if (!foundAvailableId) {
      throw new Error(
        `Could not find an unused student ID for seed fixture ${expectedFullName}.`,
      );
    }
  }

  reservedIds.add(studentId);
  return { ...fixture, studentId };
}

async function seed() {
  if (!seedPassword || seedPassword === "ChangeMe123!") {
    throw new Error(
      "Set a non-default SEED_TEST_PASSWORD in server/.env before seeding.",
    );
  }
  if (
    seedStudents.length !== 30 ||
    new Set(seedStudents.map((student) => student.studentId)).size !== 30 ||
    seedStudents.some(
      (student) => !/^202[3-6]\d{4}$/.test(student.studentId),
    ) ||
    seedStudents.some(
      (student) => student.studentId === registrationTestStudent.studentId,
    )
  ) {
    throw new Error("Seed student fixtures must contain 30 unique eight-digit IDs from 2023-2026.");
  }

  const passwordHash = await bcrypt.hash(seedPassword, 12);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await clearApplicationData(client);
    console.log("Application data cleared; migration history preserved.");

    const removedStudents = await removeLegacySeedStudents(client);

    await client.query(
      `INSERT INTO roles (name)
       VALUES ('student'), ('registrar')
       ON CONFLICT (name) DO NOTHING`,
    );

    for (const documentType of documentCatalog) {
      await client.query(
        `INSERT INTO document_types (name, base_fee, currency)
         VALUES ($1, $2, 'PHP')
         ON CONFLICT (name) DO NOTHING`,
        [documentType.name, documentType.baseFee],
      );
    }

    const roleResult = await client.query<{ id: number }>(
      "SELECT id FROM roles WHERE name = $1",
      [registrar.role],
    );
    const roleId = roleResult.rows[0]?.id;
    if (roleId === undefined) {
      throw new Error(`Required role is missing: ${registrar.role}`);
    }

    const studentRoleResult = await client.query<{ id: number }>(
      "SELECT id FROM roles WHERE name = 'student'",
    );
    const studentRoleId = studentRoleResult.rows[0]?.id;
    if (studentRoleId === undefined) {
      throw new Error("Required role is missing: student");
    }

    await client.query(
      `INSERT INTO users
         (email, password_hash, full_name, stakeholder_type, active)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (email) DO NOTHING`,
      [
        registrar.email,
        passwordHash,
        registrar.fullName,
        registrar.stakeholderType,
      ],
    );

    const userResult = await client.query<{
      id: string;
      full_name: string;
      stakeholder_type: string;
    }>(
      `SELECT id, full_name, stakeholder_type
       FROM users
       WHERE email = $1
       FOR UPDATE`,
      [registrar.email],
    );
    const user = userResult.rows[0];
    if (
      !user ||
      user.full_name !== registrar.fullName ||
      user.stakeholder_type !== registrar.stakeholderType
    ) {
      throw new Error(
        `Seed registrar conflicts with existing account ${registrar.email}; no changes committed.`,
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
      throw new Error(`Failed to assign role ${registrar.role} to ${registrar.email}`);
    }

    const reservedStudentIds = new Set<string>([
      registrationTestStudent.studentId,
    ]);
    const resolvedStudents: typeof seedStudents = [];
    for (const fixture of seedStudents) {
      let student = await resolveStudentFixture(
        client,
        fixture,
        reservedStudentIds,
      );
      student = await ensureStudentFixture(
        client,
        student,
        passwordHash,
        studentRoleId,
        reservedStudentIds,
      );
      resolvedStudents.push(student);
    }

    await client.query(
      `INSERT INTO student_directory
         (student_id, first_name, middle_name, last_name, birthdate)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (student_id) DO NOTHING`,
      [
        registrationTestStudent.studentId,
        registrationTestStudent.firstName,
        registrationTestStudent.middleName,
        registrationTestStudent.lastName,
        registrationTestStudent.birthdate,
      ],
    );

    const registrationTestDirectoryResult = await client.query<{
      first_name: string;
      middle_name: string | null;
      last_name: string;
      birthdate: string;
    }>(
      `SELECT first_name, middle_name, last_name, birthdate
       FROM student_directory
       WHERE student_id = $1`,
      [registrationTestStudent.studentId],
    );
    const registrationTestDirectory = registrationTestDirectoryResult.rows[0];
    if (!registrationTestDirectory) {
      throw new Error(
        `Could not create registration-test directory record ${registrationTestStudent.studentId}.`,
      );
    }

    const registrationTestAccount = await client.query(
      "SELECT 1 FROM users WHERE student_id = $1",
      [registrationTestStudent.studentId],
    );
    if (registrationTestAccount.rowCount !== 0) {
      throw new Error(
        `Registration-test directory ID ${registrationTestStudent.studentId} is already linked to a user account.`,
      );
    }

    const seededDirectoryIds = [
      ...resolvedStudents.map((student) => student.studentId),
      registrationTestStudent.studentId,
    ];
    const unexpectedAccounts = await client.query<{ student_id: string }>(
      `SELECT student_id
       FROM users
       WHERE student_id = ANY($1::varchar[])
         AND email <> ALL($2::text[])`,
      [
        seededDirectoryIds,
        resolvedStudents.map(
          (student) => `${student.studentId}${studentEmailDomain}`,
        ),
      ],
    );
    if (unexpectedAccounts.rows.length > 0) {
      throw new Error(
        `Seed directory IDs are linked to unexpected accounts: ${unexpectedAccounts.rows.map((row) => row.student_id).join(", ")}`,
      );
    }

    const seededRequests = await seedDemoRequests(
      client,
      resolvedStudents,
      user.id,
    );
    const seededClearances = await seedDemoClearances(
      client,
      resolvedStudents,
      user.id,
    );

    await client.query("COMMIT");
    console.log("Seed completed.");
    console.log(`Registrar account ensured: ${registrar.email}.`);
    console.log(`Legacy demo student accounts removed: ${removedStudents}.`);
    console.log(`Demo student login accounts ensured: ${seedStudents.length}.`);
    console.log(`Demo requests created with all statuses: ${seededRequests}.`);
    console.log(
      `Demo clearances created: ${seededClearances.verified} verified, ${seededClearances.pending} awaiting verification.`,
    );
    console.log(
      `Registration-test directory record ensured without an account: ${registrationTestStudent.studentId}${studentEmailDomain}.`,
    );
    console.log(
      "New demo accounts use SEED_TEST_PASSWORD; reruns do not reset existing passwords.",
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
