import { db } from './db';
import { assertTenantAccess } from './reservas-data';

type CompetitionStatus = 'ACTIVE' | 'CLOSED';
type ContentPlatform = 'INSTAGRAM' | 'TIKTOK' | 'FACEBOOK';

const ALLOWED_PLATFORMS: ContentPlatform[] = ['INSTAGRAM', 'TIKTOK', 'FACEBOOK'];

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizePlatform(value: unknown): ContentPlatform | null {
  const platform = String(value ?? '').toUpperCase();
  return ALLOWED_PLATFORMS.includes(platform as ContentPlatform) ? (platform as ContentPlatform) : null;
}

function assertPublicVideoUrl(rawUrl: string, platform: ContentPlatform) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Ingresá un link válido');
  }

  const host = parsed.hostname.toLowerCase();
  if (platform === 'INSTAGRAM' && !host.includes('instagram.com')) {
    throw new Error('El link debe ser de Instagram');
  }
  if (platform === 'TIKTOK' && !host.includes('tiktok.com')) {
    throw new Error('El link debe ser de TikTok');
  }
  if (platform === 'FACEBOOK' && !host.includes('facebook.com') && !host.includes('fb.watch')) {
    throw new Error('El link debe ser de Facebook');
  }
}

function parseAbbreviatedNumber(raw: string): number | null {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, '');
  const match = normalized.match(/^([\d.,]+)([km])?$/i);
  if (!match) return null;
  const base = Number(match[1].replace(/,/g, '.'));
  if (!Number.isFinite(base)) return null;
  const suffix = match[2];
  if (suffix === 'k') return Math.round(base * 1_000);
  if (suffix === 'm') return Math.round(base * 1_000_000);
  return Math.round(base);
}

async function fetchTextWithTimeout(url: string, timeoutMs = 12000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'accept-language': 'es-AR,es;q=0.9,en;q=0.8',
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`No se pudo abrir URL (${response.status})`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractViewsFromHtml(html: string): number | null {
  const compact = html.replace(/\s+/g, ' ');
  const patterns = [
    /"video_view_count"\s*:\s*([0-9]+)/i,
    /"video_view_count"\s*:\s*"([0-9.,kKmM]+)"/i,
    /"video_view_count"\s*=\s*"([0-9.,kKmM]+)"/i,
    /"video_play_count"\s*:\s*"?([0-9.,kKmM]+)"?/i,
    /"playCount"\s*:\s*"?([0-9.,kKmM]+)"?/i,
    /"play_count"\s*:\s*"?([0-9.,kKmM]+)"?/i,
    /"view_count"\s*:\s*"?([0-9.,kKmM]+)"?/i,
    /"videoViewCount"\s*:\s*"?([0-9.,kKmM]+)"?/i,
    /"viewCount"\s*:\s*"?([0-9.,kKmM]+)"?/i,
    /"views"\s*:\s*"?([0-9.,kKmM]+)"?/i,
    /([0-9][0-9.,kKmM]*)\s+(?:views|visualizaciones|reproducciones|plays)\b/i,
  ];

  for (const pattern of patterns) {
    const match = compact.match(pattern);
    if (!match?.[1]) continue;
    const parsed = parseAbbreviatedNumber(match[1]);
    if (parsed !== null) return parsed;
  }

  return null;
}

async function resolveViewsFromVideoUrl(videoUrl: string): Promise<number> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(videoUrl);
  } catch {
    throw new Error('Link inválido para leer visitas');
  }

  const host = parsedUrl.hostname.toLowerCase();
  const directCandidates = [videoUrl];

  if (host.includes('instagram.com')) {
    const separator = videoUrl.includes('?') ? '&' : '?';
    directCandidates.push(`${videoUrl}${separator}__a=1&__d=dis`);
  }

  for (const candidate of directCandidates) {
    try {
      const html = await fetchTextWithTimeout(candidate);
      const detectedViews = extractViewsFromHtml(html);
      if (detectedViews !== null) return Math.max(0, detectedViews);
    } catch {
      // Try next candidate.
    }
  }

  // Fallback: jina.ai reader often bypasses heavy frontends and exposes plain text.
  const jinaUrl = `https://r.jina.ai/http://${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`;
  try {
    const jinaText = await fetchTextWithTimeout(jinaUrl);
    const detectedViews = extractViewsFromHtml(jinaText);
    if (detectedViews !== null) return Math.max(0, detectedViews);
  } catch {
    // final error below
  }

  throw new Error('No pudimos detectar visitas desde ese link');
}

export async function ensureContentTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS "ContentCompetition" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "title" TEXT NOT NULL,
      "prizeText" TEXT NOT NULL,
      "notes" TEXT,
      "startsAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deadlineAt" TIMESTAMPTZ NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "createdByMembershipId" TEXT NOT NULL REFERENCES "Membership"(id) ON DELETE RESTRICT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "ContentCompetition_status_check" CHECK ("status" IN ('ACTIVE', 'CLOSED'))
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS "ContentCompetition_tenant_idx"
    ON "ContentCompetition"("tenantId", "deadlineAt" DESC, "createdAt" DESC)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "ContentSubmission" (
      "id" TEXT PRIMARY KEY,
      "competitionId" TEXT NOT NULL REFERENCES "ContentCompetition"(id) ON DELETE CASCADE,
      "membershipId" TEXT NOT NULL REFERENCES "Membership"(id) ON DELETE CASCADE,
      "platform" TEXT NOT NULL,
      "videoUrl" TEXT NOT NULL,
      "views" INTEGER NOT NULL DEFAULT 0,
      "viewsUpdatedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "ContentSubmission_platform_check" CHECK ("platform" IN ('INSTAGRAM', 'TIKTOK', 'FACEBOOK')),
      CONSTRAINT "ContentSubmission_views_check" CHECK ("views" >= 0),
      UNIQUE ("competitionId", "membershipId")
    )
  `);
  await db.query(`ALTER TABLE "ContentSubmission" ADD COLUMN IF NOT EXISTS "viewsUpdatedAt" TIMESTAMPTZ`);

  await db.query(`
    CREATE INDEX IF NOT EXISTS "ContentSubmission_competition_views_idx"
    ON "ContentSubmission"("competitionId", "views" DESC, "updatedAt" ASC)
  `);
}

async function refreshCompetitionViews(competitionId: string) {
  const submissions = await db.query<{
    id: string;
    videoUrl: string;
    viewsUpdatedAt: Date | null;
  }>(
    `
      SELECT id, "videoUrl", "viewsUpdatedAt"
      FROM "ContentSubmission"
      WHERE "competitionId" = $1
    `,
    [competitionId],
  );

  const THROTTLE_MS = 10 * 60 * 1000;
  const now = Date.now();

  for (const submission of submissions.rows) {
    const lastUpdate = submission.viewsUpdatedAt ? submission.viewsUpdatedAt.getTime() : 0;
    if (now - lastUpdate < THROTTLE_MS) continue;
    try {
      const views = await resolveViewsFromVideoUrl(submission.videoUrl);
      await db.query(
        `
          UPDATE "ContentSubmission"
          SET views = $1, "viewsUpdatedAt" = NOW(), "updatedAt" = NOW()
          WHERE id = $2
        `,
        [views, submission.id],
      );
    } catch {
      // Best effort: if provider blocks scraping, keep existing value.
    }
  }
}

export async function getContentContext(input: { userId: string; tenantId: string }) {
  await ensureContentTables();

  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) throw new Error('Sin acceso al tenant');

  const canManageCompetition = membership.role === 'OWNER' || membership.role === 'MANAGER';
  const canSubmit = membership.role === 'OWNER' || membership.role === 'MANAGER' || membership.role === 'EMPLOYEE';

  const [activeCompetitionRes, competitionsRes] = await Promise.all([
    db.query<{
      id: string;
      title: string;
      prizeText: string;
      notes: string | null;
      startsAt: Date;
      deadlineAt: Date;
      status: CompetitionStatus;
      createdAt: Date;
    }>(
      `
        SELECT id, title, "prizeText", notes, "startsAt", "deadlineAt", status, "createdAt"
        FROM "ContentCompetition"
        WHERE "tenantId" = $1
          AND status = 'ACTIVE'
          AND "deadlineAt" > NOW()
        ORDER BY "deadlineAt" ASC
        LIMIT 1
      `,
      [input.tenantId],
    ),
    db.query<{
      id: string;
      title: string;
      prizeText: string;
      notes: string | null;
      startsAt: Date;
      deadlineAt: Date;
      status: CompetitionStatus;
      createdAt: Date;
    }>(
      `
        SELECT id, title, "prizeText", notes, "startsAt", "deadlineAt", status, "createdAt"
        FROM "ContentCompetition"
        WHERE "tenantId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 8
      `,
      [input.tenantId],
    ),
  ]);

  const activeCompetition = activeCompetitionRes.rows[0] ?? null;
  const activeCompetitionId = activeCompetition?.id ?? null;
  if (activeCompetitionId) {
    await refreshCompetitionViews(activeCompetitionId);
  }

  const submissionsRes = activeCompetitionId
    ? await db.query<{
        id: string;
        competitionId: string;
        membershipId: string;
        platform: ContentPlatform;
        videoUrl: string;
        views: number;
        viewsUpdatedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        role: string;
        fullName: string | null;
        email: string;
      }>(
        `
          SELECT
            s.id,
            s."competitionId",
            s."membershipId",
            s.platform::text as platform,
            s."videoUrl",
            s.views,
            s."viewsUpdatedAt",
            s."createdAt",
            s."updatedAt",
            m.role::text as role,
            u."fullName",
            u.email
          FROM "ContentSubmission" s
          INNER JOIN "Membership" m ON m.id = s."membershipId"
          INNER JOIN "User" u ON u.id = m."userId"
          WHERE s."competitionId" = $1
          ORDER BY s.views DESC, s."updatedAt" ASC
        `,
        [activeCompetitionId],
      )
    : { rows: [] as Array<any> };

  const mySubmission = submissionsRes.rows.find((row) => row.membershipId === membership.id) ?? null;

  return {
    actor: {
      membershipId: membership.id,
      role: membership.role,
      canManageCompetition,
      canSubmit,
    },
    activeCompetition: activeCompetition
      ? {
          ...activeCompetition,
          startsAt: activeCompetition.startsAt.toISOString(),
          deadlineAt: activeCompetition.deadlineAt.toISOString(),
          createdAt: activeCompetition.createdAt.toISOString(),
        }
      : null,
    ranking: submissionsRes.rows.map((row, index) => ({
      submissionId: row.id,
      membershipId: row.membershipId,
      platform: row.platform,
      videoUrl: row.videoUrl,
      views: Number(row.views ?? 0),
      role: row.role,
      name: row.fullName ?? row.email,
      updatedAt: row.updatedAt.toISOString(),
      position: index + 1,
    })),
    mySubmission: mySubmission
      ? {
          submissionId: mySubmission.id,
          platform: mySubmission.platform,
          videoUrl: mySubmission.videoUrl,
          views: Number(mySubmission.views ?? 0),
        }
      : null,
    competitions: competitionsRes.rows.map((row) => ({
      id: row.id,
      title: row.title,
      prizeText: row.prizeText,
      notes: row.notes,
      startsAt: row.startsAt.toISOString(),
      deadlineAt: row.deadlineAt.toISOString(),
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function createCompetition(input: {
  userId: string;
  tenantId: string;
  title: string;
  prizeText: string;
  deadlineAt: string;
  notes?: string | null;
}) {
  await ensureContentTables();
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) throw new Error('Sin acceso al tenant');
  if (membership.role !== 'OWNER' && membership.role !== 'MANAGER') {
    throw new Error('No tenés permisos para crear competencias');
  }

  const title = normalizeText(input.title);
  const prizeText = normalizeText(input.prizeText);
  const notes = normalizeText(input.notes);
  if (!title) throw new Error('Título obligatorio');
  if (!prizeText) throw new Error('Premio obligatorio');

  const deadline = new Date(input.deadlineAt);
  if (Number.isNaN(deadline.getTime())) throw new Error('Deadline inválido');
  if (deadline.getTime() <= Date.now()) throw new Error('La deadline debe ser futura');

  const openCompetition = await db.query<{ id: string }>(
    `
      SELECT id
      FROM "ContentCompetition"
      WHERE "tenantId" = $1
        AND status = 'ACTIVE'
        AND "deadlineAt" > NOW()
      LIMIT 1
    `,
    [input.tenantId],
  );
  if (openCompetition.rows[0]) {
    throw new Error('Ya hay una competencia activa. Esperá la deadline o cerrala primero.');
  }

  const created = await db.query<{ id: string }>(
    `
      INSERT INTO "ContentCompetition" (
        id, "tenantId", title, "prizeText", notes, "startsAt", "deadlineAt", status, "createdByMembershipId", "createdAt", "updatedAt"
      )
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW(), $5::timestamptz, 'ACTIVE', $6, NOW(), NOW())
      RETURNING id
    `,
    [input.tenantId, title, prizeText, notes, deadline.toISOString(), membership.id],
  );

  return { id: created.rows[0].id };
}

export async function upsertSubmission(input: {
  userId: string;
  tenantId: string;
  competitionId: string;
  platform: string;
  videoUrl: string;
}) {
  await ensureContentTables();
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) throw new Error('Sin acceso al tenant');
  if (membership.role !== 'OWNER' && membership.role !== 'MANAGER' && membership.role !== 'EMPLOYEE') {
    throw new Error('No tenés permisos para subir contenido');
  }

  const platform = normalizePlatform(input.platform);
  const videoUrl = normalizeText(input.videoUrl);
  if (!platform) throw new Error('Plataforma inválida');
  if (!videoUrl) throw new Error('Link obligatorio');
  assertPublicVideoUrl(videoUrl, platform);
  const previous = await db.query<{ views: number }>(
    `
      SELECT views
      FROM "ContentSubmission"
      WHERE "competitionId" = $1 AND "membershipId" = $2
      LIMIT 1
    `,
    [input.competitionId, membership.id],
  );

  let views = Number(previous.rows[0]?.views ?? 0);
  let autoDetected = false;
  try {
    views = await resolveViewsFromVideoUrl(videoUrl);
    autoDetected = true;
  } catch {
    // Fallback: keep previous views (or 0 for first save) to avoid blocking tierlist.
  }

  const competition = await db.query<{ id: string; deadlineAt: Date }>(
    `
      SELECT id, "deadlineAt"
      FROM "ContentCompetition"
      WHERE id = $1
        AND "tenantId" = $2
        AND status = 'ACTIVE'
      LIMIT 1
    `,
    [input.competitionId, input.tenantId],
  );
  const currentCompetition = competition.rows[0];
  if (!currentCompetition) throw new Error('Competencia no encontrada');
  if (currentCompetition.deadlineAt.getTime() <= Date.now()) {
    throw new Error('La competencia ya cerró por deadline');
  }

  const saved = await db.query<{ id: string }>(
    `
      INSERT INTO "ContentSubmission" (
        id, "competitionId", "membershipId", platform, "videoUrl", views, "viewsUpdatedAt", "createdAt", "updatedAt"
      )
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW(), NOW())
      ON CONFLICT ("competitionId", "membershipId")
      DO UPDATE SET
        platform = EXCLUDED.platform,
        "videoUrl" = EXCLUDED."videoUrl",
        views = EXCLUDED.views,
        "viewsUpdatedAt" = NOW(),
        "updatedAt" = NOW()
      RETURNING id
    `,
    [input.competitionId, membership.id, platform, videoUrl, views],
  );

  return {
    id: saved.rows[0].id,
    views,
    autoDetected,
  };
}
