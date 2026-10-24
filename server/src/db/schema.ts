import {
  bigint,
  bigserial,
  boolean,
  char,
  check,
  decimal,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const stakeholderType = pgEnum("stakeholder_type", [
  "student",
  "professor",
  "other",
]);

export const requestStatus = pgEnum("request_status", [
  "submitted",
  "needs_information",
  "approved",
  "awaiting_payment",
  "paid",
  "processing",
  "ready",
  "fulfilled",
  "rejected",
  "cancelled",
  "registrar_review",
  "registrar_approved",
  "registrar_rejected",
  "saso_review",
  "saso_cleared",
  "saso_rejected",
  "payment_review",
  "ready_for_retrieval",
]);

export const reviewStage = pgEnum("review_stage", ["registrar", "saso"]);

export const reviewDecision = pgEnum("review_decision", [
  "approved",
  "rejected",
  "needs_information",
]);

export const paymentMethod = pgEnum("payment_method", ["cash", "gcash"]);

export const retrievalMethod = pgEnum("retrieval_method", [
  "download",
  "in_person",
  "authorized_representative",
  "other",
]);

export const retrievalStatus = pgEnum("retrieval_status", [
  "pending",
  "released",
  "completed",
]);

export const notificationChannel = pgEnum("notification_channel", [
  "in_app",
  "email",
]);

export const users = pgTable(
  "users",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    studentId: varchar("student_id", { length: 64 }).references(
      () => studentDirectory.studentId,
    ),
    contactPhone: varchar("contact_phone", { length: 40 }),
    contactAddress: text("contact_address"),
    stakeholderType: stakeholderType("stakeholder_type").notNull(),
    active: boolean("active").notNull().default(true),
    emailVerified: boolean("email_verified").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_student_id_unique")
      .on(table.studentId)
      .where(sql`${table.studentId} is not null`),
    index("users_full_name_trgm_idx").using(
      "gin",
      sql`lower(${table.fullName}) gin_trgm_ops`,
    ),
  ],
);

export const studentDirectory = pgTable(
  "student_directory",
  {
    studentId: varchar("student_id", { length: 64 }).primaryKey(),
    firstName: varchar("first_name", { length: 120 }).notNull(),
    lastName: varchar("last_name", { length: 120 }).notNull(),
    middleName: varchar("middle_name", { length: 120 }),
    birthdate: date("birthdate", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("student_directory_first_name_trgm_idx").using(
      "gin",
      sql`lower(${table.firstName}) gin_trgm_ops`,
    ),
    index("student_directory_middle_name_trgm_idx").using(
      "gin",
      sql`lower(${table.middleName}) gin_trgm_ops`,
    ),
    index("student_directory_last_name_trgm_idx").using(
      "gin",
      sql`lower(${table.lastName}) gin_trgm_ops`,
    ),
  ],
);

export const clearanceSubmissions = pgTable(
  "clearance_submissions",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileData: text("file_data").notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    status: varchar("status", { length: 20 })
      .$type<"submitted" | "needs_update" | "verified">()
      .notNull()
      .default("submitted"),
    comment: text("comment"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedBy: bigint("reviewed_by", { mode: "number" }).references(
      () => users.id,
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "clearance_submissions_status_check",
      sql`${table.status} in ('submitted', 'needs_update', 'verified')`,
    ),
    index("clearance_submissions_user_idx").on(
      table.userId,
      table.submittedAt.desc(),
    ),
  ],
);

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    userId: bigint("user_id", { mode: "number" })
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: char("code_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: smallint("attempts").notNull().default(0),
  },
  (table) => [
    check(
      "email_verification_tokens_attempts_check",
      sql`${table.attempts} between 0 and 5`,
    ),
  ],
);

export const documentTypes = pgTable(
  "document_types",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: text("name").notNull().unique(),
    description: text("description"),
    baseFee: decimal("base_fee", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    processingDays: integer("processing_days").notNull().default(5),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("document_types_base_fee_check", sql`${table.baseFee} >= 0`),
    check(
      "document_types_processing_days_check",
      sql`${table.processingDays} > 0`,
    ),
  ],
);

export const requests = pgTable(
  "requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayCode: varchar("display_code", { length: 6 })
      .notNull()
      .default(
        sql`upper(lpad(to_hex(nextval('public.request_display_code_seq')), 6, '0'))`,
      )
      .unique(),
    requesterId: bigint("requester_id", { mode: "number" })
      .notNull()
      .references(() => users.id),
    documentTypeId: bigint("document_type_id", { mode: "number" })
      .notNull()
      .references(() => documentTypes.id),
    status: requestStatus("status").notNull().default("submitted"),
    purpose: text("purpose"),
    additionalDetails: jsonb("additional_details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    feeAmount: decimal("fee_amount", { precision: 12, scale: 2 }),
    feeCurrency: char("fee_currency", { length: 3 }),
    assignedTo: bigint("assigned_to", { mode: "number" }).references(
      () => users.id,
    ),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "requests_display_code_hex_chk",
      sql`${table.displayCode} ~ '^[0-9A-F]{6}$'`,
    ),
    check("requests_fee_amount_check", sql`${table.feeAmount} >= 0`),
    index("requests_requester_idx").on(table.requesterId),
    index("requests_status_idx").on(table.status),
  ],
);

export const requestReviews = pgTable(
  "request_reviews",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    stage: reviewStage("stage").notNull(),
    decision: reviewDecision("decision").notNull(),
    reviewerId: bigint("reviewer_id", { mode: "number" })
      .notNull()
      .references(() => users.id),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("request_reviews_request_idx").on(table.requestId)],
);

export const requestComments = pgTable(
  "request_comments",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    authorId: bigint("author_id", { mode: "number" })
      .notNull()
      .references(() => users.id),
    visibility: varchar("visibility", { length: 20 })
      .$type<"requester" | "staff">()
      .notNull(),
    comment: text("comment").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "request_comments_visibility_check",
      sql`${table.visibility} in ('requester', 'staff')`,
    ),
    check(
      "request_comments_comment_check",
      sql`char_length(${table.comment}) between 1 and 2000`,
    ),
    index("request_comments_request_idx").on(table.requestId, table.createdAt),
  ],
);

export const requestCommentReads = pgTable(
  "request_comment_reads",
  {
    commentId: bigint("comment_id", { mode: "number" })
      .notNull()
      .references(() => requestComments.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.commentId, table.userId] }),
    index("request_comment_reads_user_idx").on(table.userId, table.commentId),
  ],
);

export const requestStatusHistory = pgTable(
  "request_status_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    fromStatus: requestStatus("from_status"),
    toStatus: requestStatus("to_status").notNull(),
    changedBy: bigint("changed_by", { mode: "number" }).references(
      () => users.id,
    ),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("request_history_request_idx").on(table.requestId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => requests.id),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    method: paymentMethod("method").notNull(),
    provider: text("provider").notNull(),
    providerReference: text("provider_reference").unique(),
    status: text("status", {
      enum: ["pending", "succeeded", "failed", "ref"],
    })
      .notNull()
      .default("pending"),
    confirmedBy: bigint("confirmed_by", { mode: "number" }).references(
      () => users.id,
    ),
    notes: text("notes"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("payments_amount_check", sql`${table.amount} >= 0`),
    check(
      "payments_status_check",
      sql`${table.status} in ('pending', 'succeeded', 'failed', 'ref')`,
    ),
    index("payments_request_idx").on(table.requestId),
  ],
);

export const requestFiles = pgTable(
  "request_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    uploadedBy: bigint("uploaded_by", { mode: "number" })
      .notNull()
      .references(() => users.id),
    storageKey: text("storage_key").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    fileKind: text("file_kind", {
      enum: ["supporting", "fulfilled"],
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "request_files_file_kind_check",
      sql`${table.fileKind} in ('supporting', 'fulfilled')`,
    ),
    index("request_files_request_idx").on(table.requestId),
  ],
);

export const retrievals = pgTable(
  "retrievals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    method: retrievalMethod("method").notNull(),
    status: retrievalStatus("status").notNull().default("pending"),
    releasedBy: bigint("released_by", { mode: "number" }).references(
      () => users.id,
    ),
    recipientName: varchar("recipient_name", { length: 255 }),
    recipientIdType: varchar("recipient_id_type", { length: 100 }),
    recipientIdReference: varchar("recipient_id_reference", { length: 255 }),
    notes: text("notes"),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("retrievals_request_unique").on(table.requestId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestId: uuid("request_id").references(() => requests.id, {
      onDelete: "cascade",
    }),
    channel: notificationChannel("channel").notNull().default("in_app"),
    type: varchar("type", { length: 100 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("notifications_user_idx").on(table.userId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: bigint("actor_id", { mode: "number" }).references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  roles: many(userRoles),
  requests: many(requests),
  reviews: many(requestReviews),
  requestComments: many(requestComments),
  paymentsConfirmed: many(payments),
  notifications: many(notifications),
}));

export const requestsRelations = relations(requests, ({ one, many }) => ({
  requester: one(users, {
    fields: [requests.requesterId],
    references: [users.id],
  }),
  documentType: one(documentTypes, {
    fields: [requests.documentTypeId],
    references: [documentTypes.id],
  }),
  reviews: many(requestReviews),
  comments: many(requestComments),
  history: many(requestStatusHistory),
  payments: many(payments),
  files: many(requestFiles),
  retrieval: one(retrievals),
  notifications: many(notifications),
}));
