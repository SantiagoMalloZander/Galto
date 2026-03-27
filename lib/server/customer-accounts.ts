import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from './db';

function isE164Phone(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

function isPin(value: string) {
  return /^\d{4}$/.test(value.trim());
}

function isOtpCode(value: string) {
  return /^\d{4}$/.test(value.trim());
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function hashOtpCode(code: string) {
  const secret = process.env.CUSTOMER_OTP_SECRET ?? process.env.CUSTOMER_SESSION_SECRET ?? 'change-this-otp-secret';
  return crypto.createHmac('sha256', secret).update(code).digest('hex');
}

export type BranchWhatsappConfig = {
  useCustomMetaApi: boolean;
  metaAccessToken: string | null;
  metaPhoneNumberId: string | null;
  metaGraphVersion: string | null;
  metaOtpTemplateName: string | null;
  metaOtpTemplateLang: string | null;
};

type WhatsappSendInput = {
  phone: string;
  text: string;
  otpCode?: string | null;
  branchWhatsappConfig?: BranchWhatsappConfig | null;
};

async function sendMetaWhatsappMessage(input: {
  phone: string;
  text: string;
  accessToken: string;
  phoneNumberId: string;
  graphVersion?: string | null;
  templateName?: string | null;
  templateLang?: string | null;
  otpCode?: string | null;
}) {
  const graphVersion = input.graphVersion?.trim() || 'v21.0';
  const templateName = input.templateName?.trim() || '';
  const templateLang = input.templateLang?.trim() || 'es_AR';
  const phoneDigits = input.phone.replace(/\D/g, '');
  const endpoint = `https://graph.facebook.com/${graphVersion}/${input.phoneNumberId}/messages`;

  let body: any = {
    messaging_product: 'whatsapp',
    to: phoneDigits,
  };

  if (templateName) {
    body = {
      ...body,
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLang },
        components: input.otpCode
          ? [
              {
                type: 'body',
                parameters: [{ type: 'text', text: input.otpCode }],
              },
            ]
          : undefined,
      },
    };
  } else {
    body = {
      ...body,
      type: 'text',
      text: { body: input.text },
    };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({} as any));
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? payload?.message ?? 'No se pudo enviar WhatsApp (Meta)');
  }
}

export async function sendWhatsappMessage(input: WhatsappSendInput) {
  const branchConfig = input.branchWhatsappConfig ?? null;

  if (branchConfig?.useCustomMetaApi) {
    const accessToken = branchConfig.metaAccessToken?.trim() || '';
    const phoneNumberId = branchConfig.metaPhoneNumberId?.trim() || '';
    if (!accessToken || !phoneNumberId) {
      throw new Error('Falta configurar Access Token o Phone Number ID de WhatsApp Business en la sucursal');
    }

    await sendMetaWhatsappMessage({
      phone: input.phone,
      text: input.text,
      accessToken,
      phoneNumberId,
      graphVersion: branchConfig.metaGraphVersion,
      templateName: branchConfig.metaOtpTemplateName,
      templateLang: branchConfig.metaOtpTemplateLang,
      otpCode: input.otpCode,
    });
    return;
  }

  const provider = (process.env.CUSTOMER_OTP_PROVIDER ?? 'evolution').toLowerCase();

  if (provider === 'meta') {
    const accessToken = process.env.META_WA_ACCESS_TOKEN ?? '';
    const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID ?? '';
    if (!accessToken || !phoneNumberId) {
      throw new Error('Falta configurar META_WA_ACCESS_TOKEN y/o META_WA_PHONE_NUMBER_ID');
    }

    await sendMetaWhatsappMessage({
      phone: input.phone,
      text: input.text,
      accessToken,
      phoneNumberId,
      graphVersion: process.env.META_GRAPH_VERSION ?? 'v21.0',
      templateName: process.env.META_WA_OTP_TEMPLATE_NAME ?? '',
      templateLang: process.env.META_WA_OTP_TEMPLATE_LANG ?? 'es_AR',
      otpCode: input.otpCode,
    });
    return;
  }

  const baseUrl = (process.env.EVOLUTION_API_URL ?? 'http://127.0.0.1:8080').replace(/\/+$/, '');
  const instance = process.env.EVOLUTION_INSTANCE_NAME ?? 'Santiago_Galto';
  const apiKey = process.env.EVOLUTION_API_KEY ?? '';
  if (!apiKey) {
    throw new Error('Falta configurar EVOLUTION_API_KEY');
  }

  const phoneDigits = input.phone.replace(/\D/g, '');
  const response = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instance)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    body: JSON.stringify({
      number: phoneDigits,
      text: input.text,
    }),
  });

  const payload = await response.json().catch(() => ({} as any));
  if (!response.ok) {
    throw new Error(payload?.message ?? 'No se pudo enviar el código por WhatsApp');
  }
}

export async function getBranchWhatsappConfigBySlug(input: { tenantSlug: string; branchSlug: string }) {
  await db.query(`
    ALTER TABLE "BranchProfile"
    ADD COLUMN IF NOT EXISTS "useCustomWhatsappApi" BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await db.query(`ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaAccessToken" TEXT`);
  await db.query(`ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaPhoneNumberId" TEXT`);
  await db.query(`ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaGraphVersion" TEXT`);
  await db.query(`ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaOtpTemplateName" TEXT`);
  await db.query(`ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaOtpTemplateLang" TEXT`);

  const result = await db.query<{
    useCustomWhatsappApi: boolean;
    whatsappMetaAccessToken: string | null;
    whatsappMetaPhoneNumberId: string | null;
    whatsappMetaGraphVersion: string | null;
    whatsappMetaOtpTemplateName: string | null;
    whatsappMetaOtpTemplateLang: string | null;
  }>(
    `
      SELECT
        bp."useCustomWhatsappApi",
        bp."whatsappMetaAccessToken",
        bp."whatsappMetaPhoneNumberId",
        bp."whatsappMetaGraphVersion",
        bp."whatsappMetaOtpTemplateName",
        bp."whatsappMetaOtpTemplateLang"
      FROM "BranchProfile" bp
      INNER JOIN "Branch" b ON b.id = bp."branchId"
      INNER JOIN "Tenant" t ON t.id = b."tenantId"
      WHERE t.slug = $1
        AND b.slug = $2
      LIMIT 1
    `,
    [input.tenantSlug, input.branchSlug],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    useCustomMetaApi: true,
    metaAccessToken: row.whatsappMetaAccessToken,
    metaPhoneNumberId: row.whatsappMetaPhoneNumberId,
    metaGraphVersion: row.whatsappMetaGraphVersion,
    metaOtpTemplateName: row.whatsappMetaOtpTemplateName,
    metaOtpTemplateLang: row.whatsappMetaOtpTemplateLang,
  } satisfies BranchWhatsappConfig;
}

export async function hasBranchWhatsappConfiguredBySlug(input: { tenantSlug: string; branchSlug: string }) {
  const config = await getBranchWhatsappConfigBySlug(input);
  if (!config) return false;
  return Boolean(config.metaAccessToken?.trim() && config.metaPhoneNumberId?.trim());
}

async function upsertCustomerUserByPhone(input: { phone: string; fullName?: string | null }) {
  const phone = input.phone.trim();
  const fullName = normalizeText(input.fullName);

  const existingRes = await db.query<{ id: string; phone: string; fullName: string | null }>(
    `
      SELECT id, phone, "fullName"
      FROM "CustomerUser"
      WHERE phone = $1
      LIMIT 1
    `,
    [phone],
  );

  const existing = existingRes.rows[0];
  if (existing) {
    if (fullName && fullName !== existing.fullName) {
      await db.query(
        `
          UPDATE "CustomerUser"
          SET "fullName" = $1, "updatedAt" = NOW()
          WHERE id = $2
        `,
        [fullName, existing.id],
      );
    }
    return {
      customerUser: {
        id: existing.id,
        phone: existing.phone,
        fullName: fullName ?? existing.fullName ?? null,
      },
      isNew: false,
    };
  }

  if (!fullName || fullName.length < 2) {
    throw new Error('Para crear la cuenta ingresá nombre y apellido');
  }

  const createdRes = await db.query<{
    id: string;
    phone: string;
    fullName: string | null;
  }>(
    `
      INSERT INTO "CustomerUser" (id, phone, "fullName", email, "pinHash", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, $2, NULL, NULL, NOW(), NOW())
      RETURNING id, phone, "fullName"
    `,
    [phone, fullName],
  );

  return {
    customerUser: createdRes.rows[0],
    isNew: true,
  };
}

export async function ensureCustomerAccountTables() {
  await db.query(`
    ALTER TABLE "Tenant"
    ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ
  `);

  await db.query(`
    ALTER TABLE "Customer"
    ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await db.query(`
    ALTER TABLE "Customer"
    ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ
  `);

  await db.query(`
    ALTER TABLE "CustomerUser"
    ADD COLUMN IF NOT EXISTS "pinHash" TEXT
  `);

  await db.query(`
    ALTER TABLE "CustomerUser"
    ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "CustomerUser_phone_unique_idx"
    ON "CustomerUser"(phone)
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Customer_tenant_phone_unique_idx"
    ON "Customer"("tenantId", phone)
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "CustomerIdentity_customerUser_customer_unique_idx"
    ON "CustomerIdentity"("customerUserId", "customerId")
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "CustomerTenantPoints" (
      "id" TEXT PRIMARY KEY,
      "customerUserId" TEXT NOT NULL REFERENCES "CustomerUser"(id) ON DELETE CASCADE,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "points" INTEGER NOT NULL DEFAULT 0,
      "bookingsCount" INTEGER NOT NULL DEFAULT 0,
      "lastBookedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("customerUserId", "tenantId")
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "CustomerOtpCode" (
      "id" TEXT PRIMARY KEY,
      "phone" TEXT NOT NULL,
      "codeHash" TEXT NOT NULL,
      "fullNameSnapshot" TEXT,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "consumedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS "CustomerOtpCode_phone_idx" ON "CustomerOtpCode"("phone")`);
  await db.query(`CREATE INDEX IF NOT EXISTS "CustomerOtpCode_expires_idx" ON "CustomerOtpCode"("expiresAt")`);
}

export async function requestCustomerWhatsappOtp(input: {
  phone: string;
  fullName?: string | null;
  tenantSlug?: string | null;
  branchSlug?: string | null;
}) {
  await ensureCustomerAccountTables();

  const phone = input.phone.trim();
  const fullName = normalizeText(input.fullName);
  if (!isE164Phone(phone)) {
    throw new Error('El teléfono debe estar en formato E.164');
  }

  const cooldownRes = await db.query<{ createdAt: Date }>(
    `
      SELECT "createdAt"
      FROM "CustomerOtpCode"
      WHERE phone = $1
      ORDER BY "createdAt" DESC
      LIMIT 1
    `,
    [phone],
  );

  const lastRequestAt = cooldownRes.rows[0]?.createdAt ? new Date(cooldownRes.rows[0].createdAt) : null;
  if (lastRequestAt && Date.now() - lastRequestAt.getTime() < 30_000) {
    throw new Error('Esperá 30 segundos antes de pedir otro código');
  }

  const dailyRes = await db.query<{ total: string }>(
    `
      SELECT COUNT(*)::text as total
      FROM "CustomerOtpCode"
      WHERE phone = $1
        AND "createdAt" >= NOW() - INTERVAL '24 hours'
    `,
    [phone],
  );
  const dailyTotal = Number(dailyRes.rows[0]?.total ?? 0);
  if (dailyTotal >= 20) {
    throw new Error('Alcanzaste el límite diario de códigos. Probá mañana.');
  }

  const branchWhatsappConfig =
    input.tenantSlug && input.branchSlug
      ? await getBranchWhatsappConfigBySlug({
          tenantSlug: input.tenantSlug,
          branchSlug: input.branchSlug,
        })
      : null;

  if (input.tenantSlug && input.branchSlug) {
    if (!branchWhatsappConfig) {
      throw new Error('Esta sucursal todavía no configuró su WhatsApp Business API');
    }
    if (!branchWhatsappConfig.metaPhoneNumberId?.trim() || !branchWhatsappConfig.metaAccessToken?.trim()) {
      throw new Error('La sucursal debe cargar Phone Number ID y Access Token para enviar el código');
    }
  }

  const code = String(Math.floor(1000 + Math.random() * 9000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await db.query(
    `
      INSERT INTO "CustomerOtpCode" (id, phone, "codeHash", "fullNameSnapshot", "expiresAt", attempts, "createdAt")
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 0, NOW())
    `,
    [phone, hashOtpCode(code), fullName, expiresAt.toISOString()],
  );

  await sendWhatsappMessage({
    phone,
    text: `Tu código de acceso a Galto es: ${code}. Vence en 5 minutos.`,
    otpCode: code,
    branchWhatsappConfig,
  });

  return {
    ok: true,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function verifyCustomerWhatsappOtp(input: {
  phone: string;
  code: string;
  fullName?: string | null;
}) {
  await ensureCustomerAccountTables();

  const phone = input.phone.trim();
  const code = input.code.trim();
  const fullName = normalizeText(input.fullName);

  if (!isE164Phone(phone)) {
    throw new Error('El teléfono debe estar en formato E.164');
  }
  if (!isOtpCode(code)) {
    throw new Error('El código debe tener 4 dígitos');
  }

  const otpRes = await db.query<{
    id: string;
    codeHash: string;
    expiresAt: Date;
    attempts: number;
    consumedAt: Date | null;
    fullNameSnapshot: string | null;
  }>(
    `
      SELECT id, "codeHash", "expiresAt", attempts, "consumedAt", "fullNameSnapshot"
      FROM "CustomerOtpCode"
      WHERE phone = $1
      ORDER BY "createdAt" DESC
      LIMIT 1
    `,
    [phone],
  );

  const otp = otpRes.rows[0];
  if (!otp) {
    throw new Error('Primero pedí el código por WhatsApp');
  }
  if (otp.consumedAt) {
    throw new Error('Ese código ya fue usado. Pedí uno nuevo.');
  }
  if (new Date(otp.expiresAt).getTime() < Date.now()) {
    throw new Error('El código venció. Pedí uno nuevo.');
  }
  if (Number(otp.attempts ?? 0) >= 5) {
    throw new Error('Demasiados intentos. Pedí un nuevo código.');
  }

  const valid = hashOtpCode(code) === otp.codeHash;
  if (!valid) {
    await db.query(
      `
        UPDATE "CustomerOtpCode"
        SET attempts = attempts + 1
        WHERE id = $1
      `,
      [otp.id],
    );
    throw new Error('Código incorrecto');
  }

  await db.query(
    `
      UPDATE "CustomerOtpCode"
      SET "consumedAt" = NOW()
      WHERE id = $1
    `,
    [otp.id],
  );

  return upsertCustomerUserByPhone({
    phone,
    fullName: fullName ?? otp.fullNameSnapshot,
  });
}

export async function loginOrRegisterCustomer(input: {
  phone: string;
  pin: string;
  fullName?: string | null;
}) {
  await ensureCustomerAccountTables();

  const phone = input.phone.trim();
  const pin = input.pin.trim();
  const fullName = normalizeText(input.fullName);

  if (!isE164Phone(phone)) {
    throw new Error('El teléfono debe estar en formato E.164');
  }

  if (!isPin(pin)) {
    throw new Error('El PIN debe tener 4 dígitos');
  }

  const existingRes = await db.query<{
    id: string;
    phone: string;
    fullName: string | null;
    pinHash: string | null;
  }>(
    `
      SELECT id, phone, "fullName", "pinHash"
      FROM "CustomerUser"
      WHERE phone = $1
      LIMIT 1
    `,
    [phone],
  );

  const existing = existingRes.rows[0];
  if (existing) {
    if (!existing.pinHash) {
      throw new Error('La cuenta existe sin PIN configurado. Contactá soporte.');
    }
    const isValidPin = await bcrypt.compare(pin, existing.pinHash);
    if (!isValidPin) {
      throw new Error('PIN incorrecto');
    }

    if (fullName && fullName !== existing.fullName) {
      await db.query(
        `
          UPDATE "CustomerUser"
          SET "fullName" = $1, "updatedAt" = NOW()
          WHERE id = $2
        `,
        [fullName, existing.id],
      );
    }

    return {
      customerUser: {
        id: existing.id,
        phone: existing.phone,
        fullName: fullName ?? existing.fullName ?? null,
      },
      isNew: false,
    };
  }

  if (!fullName || fullName.length < 2) {
    throw new Error('Para crear la cuenta ingresá nombre y apellido');
  }

  const pinHash = await bcrypt.hash(pin, 10);
  const createdRes = await db.query<{
    id: string;
    phone: string;
    fullName: string | null;
  }>(
    `
      INSERT INTO "CustomerUser" (id, phone, "fullName", email, "pinHash", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, $2, NULL, $3, NOW(), NOW())
      RETURNING id, phone, "fullName"
    `,
    [phone, fullName, pinHash],
  );

  return {
    customerUser: createdRes.rows[0],
    isNew: true,
  };
}

export async function getCustomerUserById(customerUserId: string) {
  await ensureCustomerAccountTables();
  const result = await db.query<{ id: string; phone: string; fullName: string | null }>(
    `SELECT id, phone, "fullName" FROM "CustomerUser" WHERE id = $1 LIMIT 1`,
    [customerUserId],
  );
  return result.rows[0] ?? null;
}

export async function recordCustomerTenantActivity(input: {
  customerUserId: string;
  tenantSlug: string;
  fullName: string;
  phone: string;
}) {
  await ensureCustomerAccountTables();

  const tenantRes = await db.query<{ id: string }>(
    `
      SELECT id
      FROM "Tenant"
      WHERE slug = $1 AND "archivedAt" IS NULL
      LIMIT 1
    `,
    [input.tenantSlug],
  );
  const tenantId = tenantRes.rows[0]?.id;
  if (!tenantId) return;

  const customerRes = await db.query<{ id: string }>(
    `
      INSERT INTO "Customer" (id, "tenantId", "fullName", phone, "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
      ON CONFLICT ("tenantId", phone) DO UPDATE
      SET "fullName" = EXCLUDED."fullName",
          "updatedAt" = NOW()
      RETURNING id
    `,
    [tenantId, normalizeText(input.fullName) ?? 'Cliente', input.phone.trim()],
  );
  const customerId = customerRes.rows[0]?.id;
  if (!customerId) return;

  await db.query(
    `
      INSERT INTO "CustomerIdentity" (id, "customerUserId", "customerId")
      VALUES (gen_random_uuid()::text, $1, $2)
      ON CONFLICT ("customerUserId", "customerId") DO NOTHING
    `,
    [input.customerUserId, customerId],
  );

  await db.query(
    `
      INSERT INTO "CustomerTenantPoints" (
        id, "customerUserId", "tenantId", points, "bookingsCount", "lastBookedAt", "createdAt", "updatedAt"
      )
      VALUES (gen_random_uuid()::text, $1, $2, 0, 1, NOW(), NOW(), NOW())
      ON CONFLICT ("customerUserId", "tenantId") DO UPDATE
      SET "bookingsCount" = "CustomerTenantPoints"."bookingsCount" + 1,
          "lastBookedAt" = NOW(),
          "updatedAt" = NOW()
    `,
    [input.customerUserId, tenantId],
  );
}

export async function listCustomerAccounts(input: { search?: string | null; limit?: number }) {
  await ensureCustomerAccountTables();
  const search = normalizeText(input.search)?.toLowerCase() ?? null;
  const limit = Math.min(Math.max(Number(input.limit ?? 200), 1), 1000);

  const usersRes = await db.query<{
    id: string;
    phone: string;
    fullName: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `
      SELECT id, phone, "fullName", "createdAt", "updatedAt"
      FROM "CustomerUser"
      WHERE ($1::text IS NULL
        OR lower(phone) LIKE '%' || $1 || '%'
        OR lower(COALESCE("fullName", '')) LIKE '%' || $1 || '%')
        AND "archivedAt" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT $2
    `,
    [search, limit],
  );

  const ids = usersRes.rows.map((row) => row.id);
  const tenantStatsRes = ids.length
    ? await db.query<{
        customerUserId: string;
        tenantId: string;
        tenantName: string;
        tenantSlug: string;
        points: number;
        bookingsCount: number;
        lastBookedAt: Date | null;
      }>(
        `
          SELECT
            ctp."customerUserId",
            ctp."tenantId",
            t.name as "tenantName",
            t.slug as "tenantSlug",
            ctp.points,
            ctp."bookingsCount",
            ctp."lastBookedAt"
          FROM "CustomerTenantPoints" ctp
          INNER JOIN "Tenant" t ON t.id = ctp."tenantId"
          WHERE ctp."customerUserId" = ANY($1::text[])
          ORDER BY ctp."updatedAt" DESC
        `,
        [ids],
      )
    : { rows: [] as any[] };

  return usersRes.rows.map((row) => ({
    id: row.id,
    phone: row.phone,
    fullName: row.fullName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    tenants: tenantStatsRes.rows
      .filter((item) => item.customerUserId === row.id)
      .map((item) => ({
        tenantId: item.tenantId,
        tenantName: item.tenantName,
        tenantSlug: item.tenantSlug,
        points: Number(item.points ?? 0),
        bookingsCount: Number(item.bookingsCount ?? 0),
        lastBookedAt: item.lastBookedAt ? item.lastBookedAt.toISOString() : null,
      })),
  }));
}

export async function deleteCustomerAccountById(customerUserId: string) {
  await ensureCustomerAccountTables();
  const customerUserRes = await db.query<{ id: string; phone: string; fullName: string | null }>(
    `
      SELECT id, phone, "fullName"
      FROM "CustomerUser"
      WHERE id = $1
      LIMIT 1
    `,
    [customerUserId],
  );

  const customerUser = customerUserRes.rows[0];
  if (!customerUser) {
    return null;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const linkedCustomersRes = await client.query<{ customerId: string; fullName: string | null }>(
      `
        SELECT c.id AS "customerId", c."fullName"
        FROM "CustomerIdentity" ci
        INNER JOIN "Customer" c ON c.id = ci."customerId"
        WHERE ci."customerUserId" = $1
      `,
      [customerUserId],
    );

    const linkedCustomerIds = linkedCustomersRes.rows.map((row) => row.customerId);
    const snapshotName = customerUser.fullName ?? linkedCustomersRes.rows[0]?.fullName ?? 'Cliente eliminado';

    await client.query(
      `
        UPDATE "Appointment"
        SET "customerId" = NULL,
            "customerUserId" = NULL,
            "updatedAt" = NOW()
        WHERE "customerUserId" = $1
           OR (
             cardinality($2::text[]) > 0
             AND "customerId" = ANY($2::text[])
           )
      `,
      [customerUserId, linkedCustomerIds],
    );

    await client.query(
      `
        UPDATE "PosSale"
        SET "customerId" = NULL,
            "customerUserId" = NULL,
            "updatedAt" = NOW(),
            "customerNameSnapshot" = COALESCE("customerNameSnapshot", $2)
        WHERE "customerUserId" = $1
           OR (
             cardinality($3::text[]) > 0
             AND "customerId" = ANY($3::text[])
           )
      `,
      [customerUserId, snapshotName, linkedCustomerIds],
    );

    await client.query(`DELETE FROM "CustomerPointsRedemption" WHERE "customerUserId" = $1`, [customerUserId]);
    await client.query(`DELETE FROM "CustomerTenantPoints" WHERE "customerUserId" = $1`, [customerUserId]);
    await client.query(`DELETE FROM "CustomerIdentity" WHERE "customerUserId" = $1`, [customerUserId]);

    if (linkedCustomerIds.length > 0) {
      await client.query(`DELETE FROM "Customer" WHERE id = ANY($1::text[])`, [linkedCustomerIds]);
    }

    const result = await client.query<{ id: string; phone: string }>(
      `
        DELETE FROM "CustomerUser"
        WHERE id = $1
        RETURNING id, phone
      `,
      [customerUserId],
    );

    await client.query('COMMIT');
    return result.rows[0] ?? null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function archiveCustomerAccountById(customerUserId: string) {
  await ensureCustomerAccountTables();
  const result = await db.query<{ id: string; phone: string }>(
    `
      UPDATE "CustomerUser"
      SET "archivedAt" = NOW(), "updatedAt" = NOW()
      WHERE id = $1 AND "archivedAt" IS NULL
      RETURNING id, phone
    `,
    [customerUserId],
  );
  return result.rows[0] ?? null;
}
