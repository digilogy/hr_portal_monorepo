const fs = require('fs');
const readline = require('readline');
const { Client } = require('pg');

async function migrateData() {
  console.log("Connecting to PostgreSQL...");
  
  const client = new Client({
    connectionString: "postgresql://hr_user:hr_secure_password@localhost:5435/hr-portal?schema=public"
  });
  
  await client.connect();
  
  // Make PostgreSQL string escaping behave like MySQL (allows \' and \n inside strings)
  await client.query("SET standard_conforming_strings = 'off';");
  await client.query("SET escape_string_warning = 'off';");
  
  console.log("Connected! Reading SQL dump...");

  const fileStream = fs.createReadStream('hr-portal (5).sql');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let isInserting = false;
  let currentStatement = "";
  let successCount = 0;
  let failCount = 0;

  for await (const line of rl) {
    if (line.startsWith('INSERT INTO')) {
      isInserting = true;
      currentStatement = line;
    } else if (isInserting) {
      currentStatement += "\n" + line;
    }

    if (isInserting && line.trim().endsWith(';')) {
      isInserting = false;
      
      // Convert MySQL backticks to PostgreSQL double quotes
      // e.g., `employee_data` -> "employee_data"
      let pgQuery = currentStatement.replace(/`/g, '"');
      
      try {
        await client.query(pgQuery);
        successCount++;
        process.stdout.write(`\rSuccessfully migrated ${successCount} INSERT blocks...`);
      } catch (err) {
        failCount++;
        console.error("\nError inserting block:", err.message);
        console.error("Query snippet:", pgQuery.substring(0, 200) + "...\n");
      }
      
      currentStatement = "";
    }
  }

  console.log(`\n\nMigration Complete!`);
  console.log(`Success: ${successCount} blocks`);
  console.log(`Failed: ${failCount} blocks`);
  
  // Reset sequences so auto-increment IDs work correctly for new rows
  console.log("\nResetting Primary Key sequences...");
  const tables = ['user', 'timesheet', 'employee_data', 'otp', 'upload_log'];
  for (const table of tables) {
    try {
      await client.query(`SELECT setval('"${table}_id_seq"', COALESCE((SELECT MAX(id)+1 FROM "${table}"), 1), false);`);
    } catch (e) {
      // ignore if sequence doesn't exist
    }
  }
  console.log("Sequences reset!");

  await client.end();
}

migrateData().catch(console.error);
