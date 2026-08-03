-- Add a DB-level default to "email_log"."id".
-- TypeORM's @PrimaryGeneratedColumn("uuid") emits the SQL DEFAULT keyword on
-- insert when no id is supplied, relying on the column's own default rather
-- than generating a UUID client-side (it only generates client-side when the
-- driver reports it doesn't support UUID generation, which the Postgres
-- driver does support). PostgreSQL 13+ ships gen_random_uuid() natively.
ALTER TABLE "email_log" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
