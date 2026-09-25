import "reflect-metadata";
import dotenv from "dotenv";
import { AppDataSource, EmployeeData } from "@hr-portal/database";

dotenv.config();

const KEYCLOAK_URL = (process.env.KEYCLOAK_URL || "https://auth.cgworkflow.com").replace(/\/$/, "");
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || "digilogy-sso";
const KEYCLOAK_ADMIN = process.env.KEYCLOAK_ADMIN || "admin";
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || "";

async function getKeycloakAdminToken(): Promise<string> {
  const tokenUrl = `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    client_id: "admin-cli",
    grant_type: "password",
    username: KEYCLOAK_ADMIN,
    password: KEYCLOAK_ADMIN_PASSWORD,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to get Keycloak admin token: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function syncEmployees(): Promise<void> {
  console.log("==> Initializing Database Connection...");
  await AppDataSource.initialize();

  const employeeRepo = AppDataSource.getRepository(EmployeeData);
  const employees = await employeeRepo.find();
  console.log(`==> Found ${employees.length} employees in HR Portal roster.`);

  if (!KEYCLOAK_ADMIN_PASSWORD) {
    console.error("ERROR: KEYCLOAK_ADMIN_PASSWORD is required in environment.");
    process.exit(1);
  }

  console.log(`==> Authenticating with Keycloak at ${KEYCLOAK_URL}...`);
  let adminToken = await getKeycloakAdminToken();

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const email = emp.officialEmailId?.toLowerCase().trim();

    if (!email || !email.includes("@")) {
      skipped++;
      continue;
    }

    if (i > 0 && i % 100 === 0) {
      adminToken = await getKeycloakAdminToken();
      console.log(`--> Progress: ${i}/${employees.length} (Created: ${created}, Skipped: ${skipped}, Failed: ${failed})`);
    }

    try {
      const [firstName, ...lastParts] = (emp.fullName || email.split("@")[0]).trim().split(" ");
      const lastName = lastParts.join(" ") || "Employee";

      const searchRes = await fetch(
        `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users?email=${encodeURIComponent(email)}&exact=true`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );

      const existingUsers = (await searchRes.json().catch(() => [])) as Array<{ id: string }>;

      if (existingUsers && existingUsers.length > 0) {
        skipped++;
      } else {
        const createRes = await fetch(
          `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${adminToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              username: email,
              email,
              firstName,
              lastName,
              enabled: emp.employmentStatus?.toLowerCase() !== "terminated",
              emailVerified: true,
              attributes: {
                employeeId: [emp.employeeId || ""],
                department: [emp.department || ""],
                mobileNumber: [emp.officeMobileNumber || ""],
                zone: [emp.zone || ""],
              },
            }),
          },
        );

        if (createRes.status === 201) {
          created++;
        } else {
          failed++;
        }
      }
    } catch {
      failed++;
    }
  }

  console.log(`\n==> Employee Sync Complete:`);
  console.log(`    Total checked: ${employees.length}`);
  console.log(`    New users created in Keycloak: ${created}`);
  console.log(`    Existing / skipped: ${skipped}`);
  console.log(`    Failed: ${failed}`);

  await AppDataSource.destroy();
}

syncEmployees().catch(async (err) => {
  console.error("Sync failed:", err);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
