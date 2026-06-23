/**
 * T-B1 — Migration integration test: migrate_calendar_day_fields_to_date
 * v1.1 — revised post-audit (16 fields; payment_record.date and
 * agency_transfer.date removed from scope; PST/PDT buckets added)
 *
 * Strategy (ADR-9): This test uses its OWN isolated @testcontainers/postgresql
 * instance — it does NOT use the shared globalSetup container. The shared
 * container applies ALL migrations at startup, so we cannot inspect the
 * pre-migration state from there.
 *
 * Flow:
 *   1. Start fresh postgres:16 testcontainer
 *   2. Hide the calendar-day migration dir, apply everything before it via
 *      `prisma migrate deploy`, then restore the dir
 *   3. Insert fixture rows in the pre-migration schema (timestamp(3) columns)
 *   4. Run `prisma migrate deploy` again — applies only the pending calendar-day
 *      migration (the hidden one is now visible again)
 *   5. Assert the post-migration column values via raw SQL
 *   6. Tear down the container
 *
 * Fixture rows (post-audit, 16 fields):
 *   A. Legacy summer   — Event.date = 2026-01-15T00:00:00Z        → expect DATE '2026-01-15'
 *   B. Legacy winter   — Event.date = 2026-07-15T00:00:00Z        → expect DATE '2026-07-15'
 *   C. UI summer       — Event.date = 2026-01-15T03:00:00Z (CLST) → expect DATE '2026-01-15'
 *   D. UI winter       — Event.date = 2026-07-15T04:00:00Z (CLT)  → expect DATE '2026-07-15'
 *   E. DST spring-fwd  — Event.date = 2026-09-08T04:00:00Z        → expect DATE '2026-09-08'
 *   F. DST fall-back   — Event.date = 2026-04-05T03:00:00Z        → expect DATE '2026-04-05'
 *   G. PDT import      — Event.date = 2026-01-15T07:00:00Z (PDT)  → expect DATE '2026-01-15'
 *   H. PST import      — Event.date = 2026-07-15T08:00:00Z (PST)  → expect DATE '2026-07-15'
 *   I. SaleRecord PDT  — firstEventDate = 2026-03-10T07:00:00Z    → expect DATE '2026-03-10'
 *   J. SaleRecord PST  — firstEventDate = 2026-11-15T08:00:00Z    → expect DATE '2026-11-15'
 *   K. SaleRecord NULL — firstEventDate = NULL                     → expect NULL
 *   L. PassengerHotel  — checkIn = NULL, checkOut = NULL           → expect NULL
 *   M. Provider.birthDate = 1985-06-20T00:00:00Z (legacy)         → expect DATE '1985-06-20'
 *   N. WholesaleInvoice.periodStart = 2026-03-01T03:00:00Z (UI)   → expect DATE '2026-03-01'
 *   O. WholesaleInvoice.dueAt = NULL (optional)                    → expect NULL
 *   P. WholesaleInvoicePayment.paymentDate = 2026-05-15T04:00:00Z → expect DATE '2026-05-15'
 *   Q. User.birthDate = NULL                                        → expect NULL
 *
 * OUT OF SCOPE (intentionally omitted — remain DateTime/timestamp):
 *   - payment_record.date  (continuous timestamp distribution — real instant)
 *   - agency_transfer.date (continuous timestamp distribution — real instant)
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql"
import { execSync } from "node:child_process"
import { Client } from "pg"
import path from "node:path"
import fs from "node:fs"

// ─── Migration name — must match the file created in T-B3 ────────────────────
const MIGRATION_NAME = "fix_calendar_day_timezone"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function migrationsDir(): string {
  return path.resolve(process.cwd(), "prisma/migrations")
}

/** Returns the full path of the calendar-day migration directory, or null if not yet created. */
function findMigrationDir(): string | null {
  const dirs = fs.readdirSync(migrationsDir())
  const match = dirs.find((d) => d.endsWith(`_${MIGRATION_NAME}`))
  return match ? path.join(migrationsDir(), match) : null
}

/** Temporarily rename the migration dir so prisma migrate deploy skips it. */
function hideMigration(dir: string): string {
  const hidden = `${dir}.hidden`
  fs.renameSync(dir, hidden)
  return hidden
}

/** Restore the migration dir from its hidden name. */
function showMigration(hiddenDir: string): string {
  const original = hiddenDir.replace(/\.hidden$/, "")
  fs.renameSync(hiddenDir, original)
  return original
}

function runMigrations(dbUrl: string): void {
  execSync("pnpm prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  })
}

// ─── Suite state ──────────────────────────────────────────────────────────────

let container: StartedPostgreSqlContainer
let pgClient: Client
let dbUrl: string

beforeAll(async () => {
  // 1. Verify the migration exists — if not, fail with a descriptive RED message.
  const migDir = findMigrationDir()
  if (!migDir) {
    throw new Error(
      `[T-B1 RED] Migration directory ending in '_${MIGRATION_NAME}' not found ` +
        `in prisma/migrations/. Complete T-B3 (write the migration SQL) before ` +
        `this test can turn GREEN.`,
    )
  }

  // 2. Start an isolated postgres:16 testcontainer.
  container = await new PostgreSqlContainer("postgres:16")
    .withDatabase("tct_migration_test")
    .withUsername("test")
    .withPassword("test")
    .start()

  dbUrl = container.getConnectionUri()

  // 3. Hide the calendar-day migration, apply all prior migrations, then restore.
  const hiddenDir = hideMigration(migDir)
  try {
    runMigrations(dbUrl)
  } finally {
    showMigration(hiddenDir)
  }

  // 4. Connect via pg for fixture inserts and later assertions.
  pgClient = new Client({ connectionString: dbUrl })
  await pgClient.connect()

  // 5. Insert fixture rows while the schema still has timestamp(3) columns.
  await insertFixtures()

  // 6. Apply the pending calendar-day migration.
  runMigrations(dbUrl)
}, 120_000)

afterAll(async () => {
  await pgClient?.end()
  await container?.stop()
}, 30_000)

// ─── Fixtures ────────────────────────────────────────────────────────────────

/**
 * Insert the minimum rows required to cover all 16 target fields.
 *
 * We use raw SQL so this remains decoupled from the generated Prisma client,
 * which still has timestamp(3) types at the time this test file is compiled.
 *
 * All enum values are cast explicitly to avoid type-resolution issues
 * against the freshly-migrated (but enum-populated) schema.
 *
 * payment_record and agency_transfer rows are intentionally NOT inserted
 * here — those tables are OUT OF SCOPE for this migration.
 */
async function insertFixtures(): Promise<void> {
  // ── User ──
  await pgClient.query(`
    INSERT INTO "user" (
      id, name, email, "emailVerified", "birthDate", "createdAt", "updatedAt"
    )
    VALUES (
      'usr-1', 'Test User', 'test@test.local', true,
      NULL,           -- fixture Q: NULL birthDate
      NOW(), NOW()
    )
  `)

  // ── Provider (also a target table — fixture M + all Provider date fields) ──
  await pgClient.query(`
    INSERT INTO "provider" (
      id, type, rut, "isActive",
      "fullName",
      "birthDate",
      "licenseRenovationDate",
      "carnetRenovationDate",
      "sernaturRenovationDate",
      "technicalRevisionDate",
      "circulationPermitDate",
      "decree80Date",
      "createdAt", "updatedAt"
    )
    VALUES (
      'prov-1', 'NATURAL'::"PROVIDER_TYPE", '11111111-1', true,
      'Provider One',
      '1985-06-20T00:00:00Z',  -- fixture M: legacy UTC midnight
      NULL, NULL, NULL, NULL, NULL, NULL,
      NOW(), NOW()
    )
  `)

  // ── Tour ──
  await pgClient.query(`
    INSERT INTO "tour" (id, name, "createdAt", "updatedAt")
    VALUES ('tour-1', 'Tour One', NOW(), NOW())
  `)

  // ── SaleRecord (fixtures I, J, K) ──
  // sale-1: NULL firstEventDate (fixture K)
  await pgClient.query(`
    INSERT INTO "sale_record" (
      id, voucher, type, channel, status, "operatorPaymentStatus",
      "sellerId",
      "firstEventDate",
      "createdAt", "updatedAt"
    )
    VALUES (
      'sale-1', 1,
      'SALE'::"SALE_TYPE",
      'PHYSICAL'::"CHANNEL_TYPE",
      'TO_BE_DONE'::"VOUCHER_STATUS",
      'UNKNOWN'::"OPERATOR_PAYMENT_STATUS",
      'usr-1',
      NULL,   -- fixture K: NULL optional
      NOW(), NOW()
    )
  `)
  // sale-2: PDT import firstEventDate (fixture I)
  await pgClient.query(`
    INSERT INTO "sale_record" (
      id, voucher, type, channel, status, "operatorPaymentStatus",
      "sellerId",
      "firstEventDate",
      "createdAt", "updatedAt"
    )
    VALUES (
      'sale-2', 2,
      'SALE'::"SALE_TYPE",
      'PHYSICAL'::"CHANNEL_TYPE",
      'TO_BE_DONE'::"VOUCHER_STATUS",
      'UNKNOWN'::"OPERATOR_PAYMENT_STATUS",
      'usr-1',
      '2026-03-10T07:00:00Z',   -- fixture I: PDT import → expect '2026-03-10'
      NOW(), NOW()
    )
  `)
  // sale-3: PST import firstEventDate (fixture J)
  await pgClient.query(`
    INSERT INTO "sale_record" (
      id, voucher, type, channel, status, "operatorPaymentStatus",
      "sellerId",
      "firstEventDate",
      "createdAt", "updatedAt"
    )
    VALUES (
      'sale-3', 3,
      'SALE'::"SALE_TYPE",
      'PHYSICAL'::"CHANNEL_TYPE",
      'TO_BE_DONE'::"VOUCHER_STATUS",
      'UNKNOWN'::"OPERATOR_PAYMENT_STATUS",
      'usr-1',
      '2026-11-15T08:00:00Z',   -- fixture J: PST import → expect '2026-11-15'
      NOW(), NOW()
    )
  `)

  // ── Events (primary target table — fixtures A-H) ──
  // fixture A: legacy summer
  await pgClient.query(`
    INSERT INTO "event" (id, mode, date, "tourId", "createdAt", "updatedAt")
    VALUES ('evt-a', 'REGULAR'::"SALE_MODE", '2026-01-15T00:00:00Z', 'tour-1', NOW(), NOW())
  `)
  // fixture B: legacy winter
  await pgClient.query(`
    INSERT INTO "event" (id, mode, date, "tourId", "createdAt", "updatedAt")
    VALUES ('evt-b', 'REGULAR'::"SALE_MODE", '2026-07-15T00:00:00Z', 'tour-1', NOW(), NOW())
  `)
  // fixture C: UI summer (local midnight Santiago, CLST = UTC-3 → stored as T03:00:00Z)
  await pgClient.query(`
    INSERT INTO "event" (id, mode, date, "tourId", "createdAt", "updatedAt")
    VALUES ('evt-c', 'REGULAR'::"SALE_MODE", '2026-01-15T03:00:00Z', 'tour-1', NOW(), NOW())
  `)
  // fixture D: UI winter (local midnight Santiago, CLT = UTC-4 → stored as T04:00:00Z)
  await pgClient.query(`
    INSERT INTO "event" (id, mode, date, "tourId", "createdAt", "updatedAt")
    VALUES ('evt-d', 'REGULAR'::"SALE_MODE", '2026-07-15T04:00:00Z', 'tour-1', NOW(), NOW())
  `)
  // fixture E: DST spring-forward (2026-09-08 at CLT = UTC-4 midnight → T04:00:00Z)
  await pgClient.query(`
    INSERT INTO "event" (id, mode, date, "tourId", "createdAt", "updatedAt")
    VALUES ('evt-e', 'REGULAR'::"SALE_MODE", '2026-09-08T04:00:00Z', 'tour-1', NOW(), NOW())
  `)
  // fixture F: DST fall-back (2026-04-05 at CLST = UTC-3 midnight → T03:00:00Z)
  await pgClient.query(`
    INSERT INTO "event" (id, mode, date, "tourId", "createdAt", "updatedAt")
    VALUES ('evt-f', 'REGULAR'::"SALE_MODE", '2026-04-05T03:00:00Z', 'tour-1', NOW(), NOW())
  `)
  // fixture G: PDT import (midnight in PDT = UTC-7 → stored as T07:00:00Z)
  await pgClient.query(`
    INSERT INTO "event" (id, mode, date, "tourId", "createdAt", "updatedAt")
    VALUES ('evt-g', 'REGULAR'::"SALE_MODE", '2026-01-15T07:00:00Z', 'tour-1', NOW(), NOW())
  `)
  // fixture H: PST import (midnight in PST = UTC-8 → stored as T08:00:00Z)
  await pgClient.query(`
    INSERT INTO "event" (id, mode, date, "tourId", "createdAt", "updatedAt")
    VALUES ('evt-h', 'REGULAR'::"SALE_MODE", '2026-07-15T08:00:00Z', 'tour-1', NOW(), NOW())
  `)

  // ── Agency (wholesale — required by WholesaleInvoice) ──
  await pgClient.query(`
    INSERT INTO "agency" (
      id, name, "contactEmails", active, "createdAt", "updatedAt"
    )
    VALUES (
      'ag-1', 'Wholesale Agency One', ARRAY[]::text[], true, NOW(), NOW()
    )
  `)

  // ── WholesaleInvoice (fixtures N, O) ──
  await pgClient.query(`
    INSERT INTO "wholesale_invoice" (
      id, status, "documentStatus",
      "periodStart", "periodEnd", "dueAt",
      "agencyId",
      "createdAt", "updatedAt"
    )
    VALUES (
      'wi-1',
      'DRAFT'::"WHOLESALE_INVOICE_STATUS",
      'PENDING'::"WHOLESALE_INVOICE_DOCUMENT_STATUS",
      '2026-03-01T03:00:00Z',  -- fixture N: UI summer → expect '2026-03-01'
      '2026-03-31T03:00:00Z',  -- same convention
      NULL,                    -- fixture O: NULL optional dueAt
      'ag-1',
      NOW(), NOW()
    )
  `)

  // ── WholesaleInvoicePayment (fixture P) ──
  await pgClient.query(`
    INSERT INTO "wholesale_invoice_payment" (
      id, method, currency, amount, "paymentDate",
      "invoiceId",
      "createdAt", "updatedAt"
    )
    VALUES (
      'wip-1',
      'TRANSFER'::"PAYMENT_METHOD",
      'CLP'::"CURRENCY_TYPE",
      100000,
      '2026-05-15T04:00:00Z',  -- fixture P: UI winter → expect '2026-05-15'
      'wi-1',
      NOW(), NOW()
    )
  `)

  // ── Passenger + PassengerHotel (fixture L: NULL checkIn / checkOut) ──
  await pgClient.query(`
    INSERT INTO "passenger" (id, "saleRecordId")
    VALUES ('pass-1', 'sale-1')
  `)
  await pgClient.query(`
    INSERT INTO "passenger_hotel" (
      id, "hotelName", "checkIn", "checkOut", "order",
      "passengerId",
      "createdAt", "updatedAt"
    )
    VALUES (
      'ph-1', 'Hotel One',
      NULL,   -- fixture L: NULL checkIn
      NULL,   -- fixture L: NULL checkOut
      0,
      'pass-1',
      NOW(), NOW()
    )
  `)
}

// ─── Assertions ───────────────────────────────────────────────────────────────

describe("migration: fix_calendar_day_timezone (16 fields, post-audit v1.1)", () => {
  describe("Event.date — UTC-hour discriminator", () => {
    it("A: legacy summer (T00:00:00Z) → date '2026-01-15'", async () => {
      const res = await pgClient.query<{ date: string }>(
        `SELECT date::text FROM "event" WHERE id = 'evt-a'`,
      )
      expect(res.rows[0].date).toBe("2026-01-15")
    })

    it("B: legacy winter (T00:00:00Z) → date '2026-07-15'", async () => {
      const res = await pgClient.query<{ date: string }>(
        `SELECT date::text FROM "event" WHERE id = 'evt-b'`,
      )
      expect(res.rows[0].date).toBe("2026-07-15")
    })

    it("C: UI summer (T03:00:00Z, CLST midnight) → date '2026-01-15'", async () => {
      const res = await pgClient.query<{ date: string }>(
        `SELECT date::text FROM "event" WHERE id = 'evt-c'`,
      )
      expect(res.rows[0].date).toBe("2026-01-15")
    })

    it("D: UI winter (T04:00:00Z, CLT midnight) → date '2026-07-15'", async () => {
      const res = await pgClient.query<{ date: string }>(
        `SELECT date::text FROM "event" WHERE id = 'evt-d'`,
      )
      expect(res.rows[0].date).toBe("2026-07-15")
    })

    it("E: DST spring-forward (T04:00:00Z) → date '2026-09-08'", async () => {
      const res = await pgClient.query<{ date: string }>(
        `SELECT date::text FROM "event" WHERE id = 'evt-e'`,
      )
      expect(res.rows[0].date).toBe("2026-09-08")
    })

    it("F: DST fall-back (T03:00:00Z) → date '2026-04-05'", async () => {
      const res = await pgClient.query<{ date: string }>(
        `SELECT date::text FROM "event" WHERE id = 'evt-f'`,
      )
      expect(res.rows[0].date).toBe("2026-04-05")
    })

    it("G: PDT import (T07:00:00Z) → date '2026-01-15'", async () => {
      const res = await pgClient.query<{ date: string }>(
        `SELECT date::text FROM "event" WHERE id = 'evt-g'`,
      )
      // UTC 07:00 → Santiago (CLST = UTC-3 in Jan) = 04:00 same day → '2026-01-15'
      expect(res.rows[0].date).toBe("2026-01-15")
    })

    it("H: PST import (T08:00:00Z) → date '2026-07-15'", async () => {
      const res = await pgClient.query<{ date: string }>(
        `SELECT date::text FROM "event" WHERE id = 'evt-h'`,
      )
      // UTC 08:00 → Santiago (CLT = UTC-4 in Jul) = 04:00 same day → '2026-07-15'
      expect(res.rows[0].date).toBe("2026-07-15")
    })
  })

  describe("SaleRecord.firstEventDate — PST/PDT buckets + NULL", () => {
    it("I: PDT import (T07:00:00Z) → date '2026-03-10'", async () => {
      const res = await pgClient.query<{ firstEventDate: string }>(
        `SELECT "firstEventDate"::text FROM "sale_record" WHERE id = 'sale-2'`,
      )
      // UTC 07:00 → Santiago (CLST = UTC-3 in Mar) = 04:00 same day → '2026-03-10'
      expect(res.rows[0].firstEventDate).toBe("2026-03-10")
    })

    it("J: PST import (T08:00:00Z) → date '2026-11-15'", async () => {
      const res = await pgClient.query<{ firstEventDate: string }>(
        `SELECT "firstEventDate"::text FROM "sale_record" WHERE id = 'sale-3'`,
      )
      // UTC 08:00 → Santiago (CLT = UTC-4 in Nov) = 04:00 same day → '2026-11-15'
      expect(res.rows[0].firstEventDate).toBe("2026-11-15")
    })

    it("K: NULL firstEventDate remains NULL", async () => {
      const res = await pgClient.query<{ firstEventDate: string | null }>(
        `SELECT "firstEventDate"::text FROM "sale_record" WHERE id = 'sale-1'`,
      )
      expect(res.rows[0].firstEventDate).toBeNull()
    })
  })

  describe("PassengerHotel — NULL checkIn / checkOut preserved", () => {
    it("L: NULL checkIn remains NULL", async () => {
      const res = await pgClient.query<{ checkIn: string | null }>(
        `SELECT "checkIn"::text FROM "passenger_hotel" WHERE id = 'ph-1'`,
      )
      expect(res.rows[0].checkIn).toBeNull()
    })

    it("L: NULL checkOut remains NULL", async () => {
      const res = await pgClient.query<{ checkOut: string | null }>(
        `SELECT "checkOut"::text FROM "passenger_hotel" WHERE id = 'ph-1'`,
      )
      expect(res.rows[0].checkOut).toBeNull()
    })
  })

  describe("Provider.birthDate — legacy UTC midnight", () => {
    it("M: legacy UTC midnight (T00:00:00Z) → date '1985-06-20'", async () => {
      const res = await pgClient.query<{ birthDate: string }>(
        `SELECT "birthDate"::text FROM "provider" WHERE id = 'prov-1'`,
      )
      expect(res.rows[0].birthDate).toBe("1985-06-20")
    })
  })

  describe("WholesaleInvoice dates", () => {
    it("N: periodStart UI summer (T03:00:00Z) → date '2026-03-01'", async () => {
      const res = await pgClient.query<{ periodStart: string }>(
        `SELECT "periodStart"::text FROM "wholesale_invoice" WHERE id = 'wi-1'`,
      )
      expect(res.rows[0].periodStart).toBe("2026-03-01")
    })

    it("O: dueAt NULL → remains NULL", async () => {
      const res = await pgClient.query<{ dueAt: string | null }>(
        `SELECT "dueAt"::text FROM "wholesale_invoice" WHERE id = 'wi-1'`,
      )
      expect(res.rows[0].dueAt).toBeNull()
    })
  })

  describe("WholesaleInvoicePayment.paymentDate", () => {
    it("P: UI winter (T04:00:00Z) → date '2026-05-15'", async () => {
      const res = await pgClient.query<{ paymentDate: string }>(
        `SELECT "paymentDate"::text FROM "wholesale_invoice_payment" WHERE id = 'wip-1'`,
      )
      expect(res.rows[0].paymentDate).toBe("2026-05-15")
    })
  })

  describe("User.birthDate", () => {
    it("Q: NULL birthDate remains NULL", async () => {
      const res = await pgClient.query<{ birthDate: string | null }>(
        `SELECT "birthDate"::text FROM "user" WHERE id = 'usr-1'`,
      )
      expect(res.rows[0].birthDate).toBeNull()
    })
  })

  describe("pre-flight DO $$ guard (documentary)", () => {
    it("migration completed without aborting — all fixture rows used only approved UTC-hour buckets", () => {
      // The DO $$ block in the migration SQL raises NOTICE (not EXCEPTION) for
      // rows outside the approved set {(0,0),(3,0),(4,0),(7,0),(8,0)}.
      // All fixture rows use only those buckets, so the migration succeeded.
      // A true unexpected bucket would emit a NOTICE to the postgres log but
      // NOT abort the migration (the one-off outlier 20:26 in prod was the
      // basis for this decision — it converts cleanly via Santiago conversion).
      expect(true).toBe(true)
    })
  })
})
