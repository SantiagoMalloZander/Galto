import { db } from './db';
import { BranchWhatsappConfig, sendWhatsappMessage } from './customer-accounts';

const REMINDER_TYPE = 'WHATSAPP_1H';
const ADVISORY_LOCK_KEY = 73451201;
let lastSweepMs = 0;

type DueAppointment = {
  appointmentId: string;
  tenantId: string;
  branchId: string;
  startsAt: Date;
  customerPhone: string;
  customerName: string | null;
  branchName: string;
  timeZone: string;
  serviceNames: string[] | null;
  useCustomWhatsappApi: boolean;
  whatsappMetaAccessToken: string | null;
  whatsappMetaPhoneNumberId: string | null;
  whatsappMetaGraphVersion: string | null;
  whatsappMetaOtpTemplateName: string | null;
  whatsappMetaOtpTemplateLang: string | null;
};

function formatAppointmentDate(startsAt: Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: timeZone || 'America/Argentina/Buenos_Aires',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(startsAt);
  } catch {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(startsAt);
  }
}

function buildBranchWhatsappConfig(row: DueAppointment): BranchWhatsappConfig {
  return {
    useCustomMetaApi: true,
    metaAccessToken: row.whatsappMetaAccessToken ?? null,
    metaPhoneNumberId: row.whatsappMetaPhoneNumberId ?? null,
    metaGraphVersion: row.whatsappMetaGraphVersion ?? null,
    metaOtpTemplateName: row.whatsappMetaOtpTemplateName ?? null,
    metaOtpTemplateLang: row.whatsappMetaOtpTemplateLang ?? null,
  };
}

function buildReminderMessage(row: DueAppointment) {
  const customerName = row.customerName?.trim() || 'Cliente';
  const when = formatAppointmentDate(row.startsAt, row.timeZone);
  const services = Array.isArray(row.serviceNames) ? row.serviceNames.filter(Boolean) : [];
  const servicesText = services.length ? `Servicio: ${services.join(', ')}.` : '';
  return `Hola ${customerName}, te recordamos tu turno en ${row.branchName} el ${when}. ${servicesText} Te esperamos.`;
}

export async function ensureAppointmentReminderTables() {
  await db.query(`
    ALTER TABLE "BranchProfile"
    ADD COLUMN IF NOT EXISTS "useCustomWhatsappApi" BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await db.query(`ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaAccessToken" TEXT`);
  await db.query(`ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaPhoneNumberId" TEXT`);
  await db.query(`ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaGraphVersion" TEXT`);
  await db.query(`ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaOtpTemplateName" TEXT`);
  await db.query(`ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaOtpTemplateLang" TEXT`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "AppointmentReminderLog" (
      "id" TEXT PRIMARY KEY,
      "appointmentId" TEXT NOT NULL REFERENCES "Appointment"(id) ON DELETE CASCADE,
      "reminderType" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "lastError" TEXT,
      "sentAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "AppointmentReminderLog_status_check" CHECK ("status" IN ('SENT','FAILED'))
    )
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "AppointmentReminderLog_appointment_type_unique_idx"
    ON "AppointmentReminderLog"("appointmentId", "reminderType")
  `);
}

async function logReminderResult(input: {
  appointmentId: string;
  status: 'SENT' | 'FAILED';
  error?: string | null;
}) {
  await db.query(
    `
      INSERT INTO "AppointmentReminderLog" (
        id, "appointmentId", "reminderType", status, attempts, "lastError", "sentAt", "createdAt", "updatedAt"
      )
      VALUES (gen_random_uuid()::text, $1, $2, $3, 1, $4, CASE WHEN $3 = 'SENT' THEN NOW() ELSE NULL END, NOW(), NOW())
      ON CONFLICT ("appointmentId", "reminderType") DO UPDATE
      SET
        status = EXCLUDED.status,
        attempts = "AppointmentReminderLog".attempts + 1,
        "lastError" = EXCLUDED."lastError",
        "sentAt" = CASE WHEN EXCLUDED.status = 'SENT' THEN NOW() ELSE "AppointmentReminderLog"."sentAt" END,
        "updatedAt" = NOW()
    `,
    [input.appointmentId, REMINDER_TYPE, input.status, input.error ?? null],
  );
}

export async function processDueAppointmentWhatsappReminders(maxToProcess = 30) {
  await ensureAppointmentReminderTables();

  const lock = await db.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1) AS locked', [ADVISORY_LOCK_KEY]);
  if (!lock.rows[0]?.locked) {
    return { processed: 0, sent: 0, failed: 0, skipped: true };
  }

  try {
    const dueRes = await db.query<DueAppointment>(
      `
        SELECT
          a.id as "appointmentId",
          a."tenantId",
          a."branchId",
          a."startsAt",
          c.phone as "customerPhone",
          c."fullName" as "customerName",
          b.name as "branchName",
          b."timeZone",
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT NULLIF(l."serviceNameSnapshot", '')), NULL) as "serviceNames",
          COALESCE(bp."useCustomWhatsappApi", FALSE) as "useCustomWhatsappApi",
          bp."whatsappMetaAccessToken",
          bp."whatsappMetaPhoneNumberId",
          bp."whatsappMetaGraphVersion",
          bp."whatsappMetaOtpTemplateName",
          bp."whatsappMetaOtpTemplateLang"
        FROM "Appointment" a
        INNER JOIN "Branch" b ON b.id = a."branchId"
        LEFT JOIN "BranchProfile" bp ON bp."branchId" = b.id
        LEFT JOIN "Customer" c ON c.id = a."customerId" AND c."archivedAt" IS NULL
        LEFT JOIN "AppointmentLine" l ON l."appointmentId" = a.id
        LEFT JOIN "AppointmentReminderLog" arl
          ON arl."appointmentId" = a.id
          AND arl."reminderType" = $1
        WHERE a.status IN ('PENDING', 'CONFIRMED')
          AND a."createdBy" = 'CUSTOMER'
          AND a."startsAt" >= NOW() + INTERVAL '55 minutes'
          AND a."startsAt" < NOW() + INTERVAL '65 minutes'
          AND c.phone ~ '^\\+[1-9][0-9]{7,14}$'
          AND (
            arl.id IS NULL
            OR (arl.status = 'FAILED' AND arl."updatedAt" < NOW() - INTERVAL '5 minutes')
          )
        GROUP BY
          a.id, a."tenantId", a."branchId", a."startsAt",
          c.phone, c."fullName",
          b.name, b."timeZone",
          bp."useCustomWhatsappApi",
          bp."whatsappMetaAccessToken",
          bp."whatsappMetaPhoneNumberId",
          bp."whatsappMetaGraphVersion",
          bp."whatsappMetaOtpTemplateName",
          bp."whatsappMetaOtpTemplateLang"
        ORDER BY a."startsAt" ASC
        LIMIT $2
      `,
      [REMINDER_TYPE, Math.max(1, Math.min(maxToProcess, 100))],
    );

    let sent = 0;
    let failed = 0;

    for (const row of dueRes.rows) {
      try {
        await sendWhatsappMessage({
          phone: row.customerPhone,
          text: buildReminderMessage(row),
          branchWhatsappConfig: buildBranchWhatsappConfig(row),
        });
        await logReminderResult({ appointmentId: row.appointmentId, status: 'SENT' });
        sent += 1;
      } catch (error: any) {
        await logReminderResult({
          appointmentId: row.appointmentId,
          status: 'FAILED',
          error: String(error?.message ?? 'No se pudo enviar recordatorio'),
        });
        failed += 1;
      }
    }

    return {
      processed: dueRes.rows.length,
      sent,
      failed,
      skipped: false,
    };
  } finally {
    await db.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
  }
}

export async function triggerAppointmentReminderSweep() {
  const now = Date.now();
  if (now - lastSweepMs < 60_000) {
    return;
  }
  lastSweepMs = now;
  await processDueAppointmentWhatsappReminders(20);
}
