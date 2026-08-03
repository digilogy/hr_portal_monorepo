const { Client } = require('pg');

async function patchDatabase() {
  console.log("Connecting to PostgreSQL...");
  
  const client = new Client({
    connectionString: "postgresql://hr_user:hr_secure_password@localhost:5435/hr-portal?schema=public"
  });
  
  try {
    await client.connect();
    console.log("Connected! Applying schema patches...");
    
    // Add the missing columns that TypeORM is trying to use
    await client.query('ALTER TABLE "upload_log" ADD COLUMN IF NOT EXISTS "rowIndex" integer;');
    await client.query('ALTER TABLE "upload_log" ADD COLUMN IF NOT EXISTS "status" varchar;');
    await client.query('ALTER TABLE "upload_log" ADD COLUMN IF NOT EXISTS "message" text;');
    await client.query('ALTER TABLE "upload_log" ADD COLUMN IF NOT EXISTS "payload" json;');
    
    // Make action nullable because TypeORM doesn't provide it
    await client.query('ALTER TABLE "upload_log" ALTER COLUMN "action" DROP NOT NULL;');
    
    console.log("\nSuccess! Database schema patched successfully.");
    
  } catch (err) {
    console.error("Error patching database:", err.message);
  } finally {
    await client.end();
  }
}

patchDatabase();
