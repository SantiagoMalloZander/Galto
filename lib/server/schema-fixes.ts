import { db } from './db';

export async function ensureAppointmentLineServiceFkDeleteSetNull() {
  await db.query(`
    DO $$
    DECLARE
      fk_record record;
      is_nullable text;
      has_service_id boolean;
    BEGIN
      IF to_regclass('"AppointmentLine"') IS NULL OR to_regclass('"Service"') IS NULL THEN
        RETURN;
      END IF;

      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'AppointmentLine'
          AND c.column_name = 'serviceId'
      )
      INTO has_service_id;
      IF NOT has_service_id THEN
        RETURN;
      END IF;

      SELECT c.is_nullable
      INTO is_nullable
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'AppointmentLine'
        AND c.column_name = 'serviceId'
      LIMIT 1;

      IF is_nullable = 'NO' THEN
        ALTER TABLE "AppointmentLine"
        ALTER COLUMN "serviceId" DROP NOT NULL;
      END IF;

      FOR fk_record IN
        SELECT con.conname
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace ns ON ns.oid = rel.relnamespace
        INNER JOIN unnest(con.conkey) AS key(attnum) ON TRUE
        INNER JOIN pg_attribute attr ON attr.attrelid = rel.oid AND attr.attnum = key.attnum
        WHERE con.contype = 'f'
          AND ns.nspname = 'public'
          AND rel.relname = 'AppointmentLine'
          AND attr.attname = 'serviceId'
      LOOP
        EXECUTE format('ALTER TABLE "AppointmentLine" DROP CONSTRAINT IF EXISTS %I', fk_record.conname);
      END LOOP;

      BEGIN
        ALTER TABLE "AppointmentLine"
        ADD CONSTRAINT "AppointmentLine_serviceId_fkey"
        FOREIGN KEY ("serviceId") REFERENCES "Service"(id) ON UPDATE CASCADE ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN
          NULL;
      END;
    END $$;
  `);
}
