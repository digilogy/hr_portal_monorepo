# Feasibility note: migrating the runtime ORM from TypeORM to Prisma

**Status: not attempted, not scheduled.** This is a documentation-only note
for a future, separately-scoped initiative — nothing in this migration
depends on it, and it is explicitly out of scope for the "no rewrite"
ground rule this whole migration was built under.

## Current state

Since Stage 0 of this migration, `hr-portal` deliberately runs two ORMs
side by side, each with a narrow, non-overlapping role:

- **TypeORM** (`packages/database`'s `AppDataSource` + entity classes) is
  the runtime query layer — every module's repository file
  (`*.repository.ts`) calls `AppDataSource.getRepository(Entity)` and uses
  TypeORM's query builder / repository API.
- **Prisma** (`packages/database/prisma/schema.prisma` +
  `prisma/migrations/`) is schema-of-record and migration tooling only —
  `db:generate`/`db:migrate`/`db:migrate:deploy`, nothing in the running
  application imports `@prisma/client` or calls it at request time.

This mirrors `ideas-staging-backend`'s architecture in role (Prisma owns
the schema, migrations are tracked and reviewable) without requiring a
rewrite of hr-portal's existing, working TypeORM data-access code — the
reference itself is Prisma-only at runtime, which hr-portal is not.

## What "Prisma-only runtime" would actually require

1. Regenerate the Prisma Client from the schema that's already
   tracked (`npm run db:generate --workspace=@hr-portal/database`) — this
   part is already possible today, it's just unused.
2. Rewrite every repository method across every module
   (`modules/*/​*.repository.ts`, plus `access.repository.ts` and
   `emailQueue.repository.ts`) from TypeORM's query-builder / repository
   calls to Prisma Client calls — different query API, different
   relation-loading syntax (`include`/`select` vs. `relations`/joins),
   different transaction API.
3. Retire `AppDataSource` and its entity classes
   (`packages/database/src/entities/*.ts`) once nothing references them.
4. Re-verify every module's read/write behavior is unchanged — this is a
   genuine behavior-risk change (different query generation can produce
   subtly different results for edge cases: null handling, join
   semantics, pagination), not a mechanical relocation like the package
   extractions in Stage 3.

## Why it's not part of this migration

- It touches the data-access layer of **every** module — the single
  largest, highest-behavior-risk surface in the whole codebase.
- It directly contradicts this migration's own ground rule: no rewrite of
  business logic, no DB behavior changes, every change small enough to
  verify in isolation.
- There's no functional or architectural-parity requirement forcing it —
  hr-portal's TypeORM layer already works, and Prisma already owns
  migrations, which was the actual parity gap worth closing.

## If this is picked up later

Use the same phased discipline as Stages 0–3 of this migration: one
module's repository at a time, `tsc --noEmit` + a manual smoke-test pass
after each, never touching more than one module per commit. `packages/
database`'s dual exports (`AppDataSource` + entities today, a Prisma
Client tomorrow) make it possible to migrate module-by-module without a
big-bang cutover — a module can switch to Prisma calls while its
siblings still use TypeORM, exactly the incremental pattern this
migration used throughout.
