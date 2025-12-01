import { PrismaClient } from "../generated"; // FIXED: Matches your output path
import { PrismaPg } from "@prisma/adapter-pg"; // FIXED: Correct import
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import { randomUUID as uuidv4 } from "crypto"; // Use Node.js built-in crypto

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

const adapter = new PrismaPg(pool); // FIXED: PrismaPg

const prisma = new PrismaClient({
  adapter,
  log: ["error", "warn"],
});

async function main() {
  console.log("🌱 Starting database seed...");

  // Clear existing data (in reverse order to avoid FK errors)
  console.log("Clearing existing data...");
  await prisma.employeeDocument.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.payrollRecord.deleteMany();
  await prisma.auditTrail.deleteMany();
  await prisma.log.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.user.deleteMany();
  await prisma.roleDef.deleteMany();

  // Seed Role Definitions (RBAC)
  console.log("Creating role definitions...");
  await prisma.roleDef.createMany({
    data: [
      {
        roleName: "EMPLOYEE",
        permissions: {
          read_resource: true,
          view_own_payroll: true,
          view_own_attendance: true,
          create_leave_request: true,
          view_own_profile: true,
        },
      },
      {
        roleName: "MANAGER",
        permissions: {
          read_resource: true,
          write_resource: true,
          view_own_payroll: true,
          view_team_payroll: true,
          view_team_attendance: true,
          approve_leave: true,
          view_team_profiles: true,
          view_own_profile: true,
        },
      },
      {
        roleName: "HR",
        permissions: {
          read_resource: true,
          write_resource: true,
          view_all_payroll: true,
          approve_payroll: true,
          view_all_attendance: true,
          approve_leave: true,
          view_all_profiles: true,
          manage_employees: true,
          view_own_profile: true,
        },
      },
      {
        roleName: "ADMIN",
        permissions: {
          read_resource: true,
          write_resource: true,
          view_all_payroll: true,
          approve_payroll: true,
          view_all_attendance: true,
          approve_leave: true,
          view_all_profiles: true,
          manage_employees: true,
          manage_users: true,
          manage_roles: true,
          view_logs: true,
          create_backup: true,
          view_own_profile: true,
        },
      },
    ],
  });

  // Create test users - added explicit IDs for easy relations
  console.log("Creating test users...");

  const testPassword = await bcrypt.hash("Test@123", 12);

  const employeeMFA = speakeasy.generateSecret({
    name: "EMS:employee",
    length: 32,
  });
  const managerMFA = speakeasy.generateSecret({
    name: "EMS:manager",
    length: 32,
  });
  const hrMFA = speakeasy.generateSecret({ name: "EMS:hruser", length: 32 });
  const adminMFA = speakeasy.generateSecret({ name: "EMS:admin", length: 32 });

  const employee = await prisma.user.create({
    data: {
      id: uuidv4(), // Explicit for relations
      username: "employee",
      email: "employee@ems.com",
      hashedPassword: testPassword,
      role: "EMPLOYEE",
      department: "Engineering",
      securityLevel: "PUBLIC",
      mfaSecret: employeeMFA.base32,
      mfaEnabled: true,
      emailVerified: true,
    },
  });

  const manager = await prisma.user.create({
    data: {
      id: uuidv4(),
      username: "manager",
      email: "manager@ems.com",
      hashedPassword: testPassword,
      role: "MANAGER",
      department: "Finance",
      securityLevel: "INTERNAL",
      mfaSecret: managerMFA.base32,
      mfaEnabled: true,
      emailVerified: true,
    },
  });

  const hr = await prisma.user.create({
    data: {
      id: uuidv4(),
      username: "hruser",
      email: "hr@ems.com",
      hashedPassword: testPassword,
      role: "HR",
      department: "HR",
      securityLevel: "INTERNAL",
      mfaSecret: hrMFA.base32,
      mfaEnabled: true,
      emailVerified: true,
    },
  });

  const admin = await prisma.user.create({
    data: {
      id: uuidv4(),
      username: "admin",
      email: "admin@ems.com",
      hashedPassword: testPassword,
      role: "ADMIN",
      department: "IT",
      securityLevel: "CONFIDENTIAL",
      mfaSecret: adminMFA.base32,
      mfaEnabled: true,
      emailVerified: true,
    },
  });

  console.log("Test users created with password: Test@123");
  console.log("\nMFA Secrets (save these for testing):");
  console.log("Employee:", employeeMFA.base32);
  console.log("Manager:", managerMFA.base32);
  console.log("HR User:", hrMFA.base32);
  console.log("Admin:", adminMFA.base32);

  // Create test resources
  console.log("\nCreating test resources...");
  const publicDoc = await prisma.resource.create({
    data: {
      name: "Public Company Handbook",
      description: "General company policies and procedures",
      ownerId: admin.id,
      sensitivityLevel: "PUBLIC",
      content: { type: "document", content: "Welcome to our company..." },
    },
  });

  const internalDoc = await prisma.resource.create({
    data: {
      name: "Internal Team Directory",
      description: "Contact information for team members",
      ownerId: manager.id,
      sensitivityLevel: "INTERNAL",
      content: { type: "directory", contacts: [] },
    },
  });

  const confidentialDoc = await prisma.resource.create({
    data: {
      name: "Confidential Salary Report",
      description: "Q4 2025 salary analysis",
      ownerId: hr.id,
      sensitivityLevel: "CONFIDENTIAL",
      content: { type: "report", data: "Salary breakdown..." },
    },
  });

  // Create DAC permissions
  console.log("Creating DAC permissions...");
  await prisma.permission.create({
    data: {
      resourceId: internalDoc.id,
      userId: employee.id,
      permissionType: "READ",
      grantedById: manager.id,
    },
  });

  await prisma.permission.create({
    data: {
      resourceId: confidentialDoc.id,
      userId: manager.id,
      permissionType: "READ",
      grantedById: hr.id,
    },
  });

  // NEW: Seed Payroll (Current Month: Nov 2025)
  console.log("\nCreating test payroll records...");
  try {
    await prisma.payrollRecord.create({
      data: {
        userId: employee.id,
        month: 11, // November
        year: 2025,
        baseSalary: 55000,
        bonus: 1500,
        deductions: 4500,
        netPay: 52000,
        status: "PENDING",
        approvedById: hr.id, // HR to approve
      },
    });
    await prisma.payrollRecord.create({
      data: {
        userId: manager.id,
        month: 11,
        year: 2025,
        baseSalary: 75000,
        bonus: 3000,
        deductions: 6000,
        netPay: 72000,
        status: "APPROVED",
        approvedById: admin.id,
        approvedAt: new Date("2025-11-25T10:00:00Z"),
      },
    });
    console.log("Payroll seeded for Nov 2025.");
  } catch (error) {
    console.warn("Payroll seed skipped (FK issue?):", error.message);
  }

  // NEW: Seed Attendance (Today: Nov 30, 2025)
  console.log("\nCreating test attendance...");
  const today = new Date("2025-11-30");
  await prisma.attendance.create({
    data: {
      userId: employee.id,
      date: today,
      checkIn: new Date("2025-11-30T09:00:00Z"),
      checkOut: new Date("2025-11-30T17:30:00Z"),
      hoursWorked: 8.5,
      status: "PRESENT",
      notes: "Full day worked on Project Alpha",
    },
  });
  await prisma.attendance.create({
    data: {
      userId: manager.id,
      date: today,
      checkIn: null,
      checkOut: null,
      hoursWorked: 0,
      status: "ABSENT",
      notes: "Sick leave",
    },
  });
  console.log("Attendance seeded for today.");

  // NEW: Seed Leave Request
  console.log("\nCreating test leave request...");
  await prisma.leaveRequest.create({
    data: {
      userId: employee.id,
      leaveType: "VACATION",
      startDate: new Date("2025-12-15"),
      endDate: new Date("2025-12-20"),
      days: 6,
      reason: "Family vacation",
      status: "PENDING",
      approvedById: manager.id,
    },
  });
  console.log("Leave request seeded.");

  // NEW: Seed Audit/Log Examples
  console.log("\nCreating test audit trails and logs...");
  await prisma.auditTrail.create({
    data: {
      userId: admin.id,
      action: "USER_CREATE",
      details: "Created employee user",
      metadata: { ip: "192.168.1.1", userAgent: "EMS-App/1.0" },
    },
  });
  await prisma.log.create({
    data: {
      userId: manager.id,
      username: manager.username,
      action: "RESOURCE_ACCESS",
      details: "Accessed quarterly report",
      ip: "10.0.0.5",
      encrypted: true,
    },
  });
  console.log("Audit/log entries seeded.");

  console.log("\n✅ Database seeded successfully!");
  console.log("\n📋 Test Accounts:");
  console.log("─────────────────────────────────────────");
  console.log("Username: employee | Password: Test@123 | Role: EMPLOYEE");
  console.log("Username: manager  | Password: Test@123 | Role: MANAGER");
  console.log("Username: hruser   | Password: Test@123 | Role: HR");
  console.log("Username: admin    | Password: Test@123 | Role: ADMIN");
  console.log("─────────────────────────────────────────");
  console.log(
    "\n💡 To use MFA during login, use an authenticator app with the secrets above"
  );
  console.log("   or temporarily disable MFA for testing.");
  console.log("\n🔍 Check data: npx prisma studio");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
