const { Client } = require('pg');

async function clearEmployeeData() {
  console.log("Connecting to PostgreSQL...");
  
  const client = new Client({
    connectionString: "postgresql://hr_user:hr_secure_password@localhost:5435/hr-portal?schema=public"
  });
  
  try {
    await client.connect();
    
    console.log("Deleting all records from employee_data...");
    // Using TRUNCATE is faster and resets any associated mechanisms if needed, 
    // but DELETE is safer if there are foreign keys. We'll use DELETE.
    const result = await client.query('DELETE FROM "employee_data";');
    
    console.log(`\nSuccess! Deleted ${result.rowCount} employee records.`);
    
    // Reset the ID sequence back to 1
    await client.query('ALTER SEQUENCE "employee_data_id_seq" RESTART WITH 1;');
    console.log("ID sequence reset to 1.");
    
  } catch (err) {
    console.error("Error clearing data:", err.message);
  } finally {
    await client.end();
  }
}

clearEmployeeData();
