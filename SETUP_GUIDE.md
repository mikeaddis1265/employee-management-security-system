# Employee Management System - Complete Setup Guide

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js** (v18 or higher)
   - Download: https://nodejs.org/
   - Verify: `node --version`

2. **PostgreSQL** (v14 or higher)
   - Download: https://www.postgresql.org/download/
   - Verify: `psql --version`

3. **Git** (optional, for version control)
   - Download: https://git-scm.com/

---

## 🚀 Quick Start (5 Steps)

### Step 1: Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Next.js, React, TypeScript
- Prisma (database ORM)
- bcryptjs (password hashing)
- jsonwebtoken (JWT tokens)
- speakeasy (MFA/TOTP)
- And many more...

---

### Step 2: Set Up PostgreSQL Database

#### Option A: Windows

1. **Open pgAdmin 4** (installed with PostgreSQL)

2. **Create Database**:
   - Right-click "Databases" → Create → Database
   - Name: `ems`
   - Click "Save"

3. **Get Connection String**:
   ```
   postgresql://postgres:YOUR_PASSWORD@localhost:5432/ems
   ```
   Replace `YOUR_PASSWORD` with your PostgreSQL password

#### Option B: Command Line

```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE ems;

# Exit
\q
```

---

### Step 3: Configure Environment Variables

1. **Copy example file**:
   ```bash
   copy .env.example .env
   ```
   (On Linux/Mac use: `cp .env.example .env`)

2. **Edit `.env` file** with your settings:

```env
# REQUIRED: Database connection
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/ems?schema=public"

# REQUIRED: Security keys (generate random strings)
JWT_SECRET="change-this-to-a-random-32-character-string"
ENCRYPT_KEY="change-this-to-another-random-32-char-str"

# REQUIRED: Application URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# OPTIONAL: reCAPTCHA (for bot prevention)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=""
RECAPTCHA_SECRET_KEY=""

# OPTIONAL: Email (for verification emails)
EMAIL_USER=""
EMAIL_PASSWORD=""
```

**Important**: Replace `YOUR_PASSWORD` with your actual PostgreSQL password!

---

### Step 4: Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed database with sample data
npm run db:seed
```

**What this does**:
- Creates all database tables
- Sets up role definitions
- Creates sample users with different roles
- Adds sample resources

**Sample users created**:
- Username: `admin` / Password: `Admin123!` (ADMIN role)
- Username: `hr_user` / Password: `HR123!` (HR role)
- Username: `manager` / Password: `Manager123!` (MANAGER role)
- Username: `employee` / Password: `Employee123!` (EMPLOYEE role)

---

### Step 5: Start the Application

```bash
npm run dev
```

**Access the application**:
- Open browser: http://localhost:3000
- Login with sample credentials above

---

## 🔐 Optional: Enable reCAPTCHA (Recommended)

CAPTCHA prevents bots from creating fake accounts.

### Get reCAPTCHA Keys (FREE):

1. **Go to**: https://www.google.com/recaptcha/admin

2. **Register a new site**:
   - Label: `EMS Localhost`
   - reCAPTCHA type: **reCAPTCHA v2** → "I'm not a robot" Checkbox
   - Domains: Add `localhost`
   - Submit

3. **Copy keys**:
   - Site Key → `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
   - Secret Key → `RECAPTCHA_SECRET_KEY`

4. **Add to `.env` file**:
   ```env
   NEXT_PUBLIC_RECAPTCHA_SITE_KEY="your_site_key_here"
   RECAPTCHA_SECRET_KEY="your_secret_key_here"
   ```

5. **Restart the app**:
   ```bash
   # Stop with Ctrl+C, then restart
   npm run dev
   ```

Now registration will show "I'm not a robot" checkbox!

---

## 📧 Optional: Enable Email Verification

### For Gmail:

1. **Enable 2-Factor Authentication** on your Gmail account

2. **Create App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select app: "Mail"
   - Select device: "Other" → Type "EMS"
   - Click "Generate"
   - Copy the 16-character password

3. **Add to `.env` file**:
   ```env
   EMAIL_SERVICE="gmail"
   EMAIL_HOST="smtp.gmail.com"
   EMAIL_PORT="587"
   EMAIL_USER="your-email@gmail.com"
   EMAIL_PASSWORD="your-16-char-app-password"
   EMAIL_FROM="noreply@ems.com"
   ```

4. **Restart app**

Now verification emails will be sent!

---

## 🗂️ Database Management

### View Database (pgAdmin 4):

1. Open pgAdmin 4
2. Navigate: Servers → PostgreSQL → Databases → ems
3. Right-click `ems` → Query Tool
4. Run queries:
   ```sql
   -- View all users
   SELECT * FROM users;

   -- View all resources
   SELECT * FROM resources;

   -- View all logs
   SELECT * FROM logs;

   -- View audit trail
   SELECT * FROM audit_trail;
   ```

### Reset Database:

```bash
# Delete all data
npx prisma migrate reset

# Reseed database
npm run db:seed
```

### Create Backup:

The app has built-in backup functionality:
- Login as admin
- Navigate to admin dashboard
- Click "Create Backup"

Or manually:
```bash
pg_dump "postgresql://postgres:YOUR_PASSWORD@localhost:5432/ems" > backup.sql
```

### Restore Backup:

```bash
psql -U postgres -d ems < backup.sql
```

---

## 🧪 Testing the Application

### 1. Test Authentication

**Login**:
- Go to http://localhost:3000/login
- Username: `admin`
- Password: `Admin123!`

**MFA (Optional)**:
- Go to profile
- Enable MFA
- Scan QR code with Google Authenticator app
- Enter 6-digit code

**Account Lockout**:
- Try wrong password 3 times
- Account locked for 15 minutes
- Check logs to see failed attempts

### 2. Test Access Control

**MAC (Security Levels)**:
- Login as `employee` (PUBLIC level)
- Try to access CONFIDENTIAL resource → Denied
- Login as `admin` (CONFIDENTIAL level)
- Can access all resources → Allowed

**DAC (Permissions)**:
- Login as user who owns a resource
- Grant READ permission to another user
- Login as that user → Can read but not write

**RBAC (Roles)**:
- Login as `employee`
- Try to access admin dashboard → Denied
- Login as `admin`
- Can access everything → Allowed

**RuBAC (Time-based)**:
- Access system outside 9 AM - 5 PM
- Should be denied (check access control settings)

**ABAC (Attribute-based)**:
- Login as user in IT department
- Try to access payroll data → Denied
- Login as user in HR department
- Can access payroll → Allowed

### 3. Test Audit Logging

- Login as admin
- Go to `/logs`
- See all user activities (encrypted in database)
- Check failed login attempts
- Check access denied logs

### 4. Test Profile Management

- Go to `/profile`
- Update email/department
- Requires password verification
- Change password
- Check audit trail

### 5. Test Admin Functions

- Login as admin
- Go to `/admin`
- Change user roles
- Change security levels
- Check audit trail for changes

---

## 📁 Project Structure

```
security-project-4/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx           # Login page
│   │   └── register/page.tsx        # Registration
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts       # Login API
│   │   │   ├── register/route.ts    # Register API
│   │   │   └── logout/route.ts      # Logout API
│   │   ├── profile/
│   │   │   ├── update/route.ts      # Profile update
│   │   │   └── change-password/route.ts
│   │   ├── admin/
│   │   │   └── users/route.ts       # User management
│   │   └── backup/route.ts          # Backup API
│   ├── dashboard/page.tsx           # Main dashboard
│   ├── admin/page.tsx               # Admin panel
│   ├── logs/page.tsx                # Audit logs
│   ├── profile/page.tsx             # User profile
│   └── resources/[id]/page.tsx      # Resource access
├── lib/
│   ├── auth.ts                      # Authentication functions
│   ├── access-control.ts            # All 5 access control models
│   ├── logger.ts                    # Logging & encryption
│   ├── backup.ts                    # Backup system
│   └── prisma.ts                    # Database client
├── prisma/
│   ├── schema.prisma                # Database schema
│   └── seed.ts                      # Sample data
├── components/
│   ├── recaptcha.tsx                # reCAPTCHA component
│   └── ui/                          # UI components
├── middleware.ts                    # Route protection
├── .env                             # Environment variables
├── .env.example                     # Example configuration
└── package.json                     # Dependencies
```

---

## 🔧 Troubleshooting

### Problem: Database connection failed

**Solution**:
1. Verify PostgreSQL is running:
   ```bash
   # Windows: Check Services
   services.msc → Find "postgresql-x64-XX" → Should be "Running"
   ```

2. Test connection:
   ```bash
   psql -U postgres -d ems
   ```

3. Check `.env` DATABASE_URL is correct

### Problem: npm install fails

**Solution**:
1. Clear npm cache:
   ```bash
   npm cache clean --force
   ```

2. Delete node_modules and reinstall:
   ```bash
   rmdir /s /q node_modules
   npm install
   ```

### Problem: Prisma migrate fails

**Solution**:
1. Delete migrations folder and try again:
   ```bash
   rmdir /s /q prisma\migrations
   npm run db:migrate
   ```

2. Or reset database completely:
   ```bash
   npx prisma migrate reset
   ```

### Problem: Port 3000 already in use

**Solution**:
1. Kill process using port:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F

   # Or use different port
   npm run dev -- -p 3001
   ```

### Problem: CAPTCHA not showing

**Solution**:
1. Check `.env` has both keys:
   - `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
   - `RECAPTCHA_SECRET_KEY`

2. Verify keys are for reCAPTCHA v2 (not v3)

3. Check browser console for errors

4. Restart development server

### Problem: Can't login after registration

**Solution**:
1. Check password meets requirements:
   - At least 8 characters
   - At least 1 uppercase letter
   - At least 1 lowercase letter
   - At least 1 number

2. Check database has user:
   ```sql
   SELECT * FROM users WHERE username = 'your_username';
   ```

3. Check account not locked:
   ```sql
   SELECT is_locked FROM users WHERE username = 'your_username';
   ```

---

## 🎯 Features Implemented

### ✅ Access Control (100%)
- [x] MAC - Mandatory Access Control
- [x] DAC - Discretionary Access Control
- [x] RBAC - Role-Based Access Control
- [x] RuBAC - Rule-Based Access Control
- [x] ABAC - Attribute-Based Access Control

### ✅ Authentication (100%)
- [x] Username/Password authentication
- [x] Password hashing (bcrypt with 12 rounds)
- [x] Rainbow table protection
- [x] Account lockout (3 attempts, 15 min)
- [x] JWT token-based sessions
- [x] HTTP-only secure cookies
- [x] MFA with TOTP
- [x] Password change functionality

### ✅ Audit & Logging (100%)
- [x] User activity logging
- [x] System event logging
- [x] AES-256-CBC log encryption
- [x] Centralized logging
- [x] Alert mechanisms
- [x] Audit trail for role changes

### ✅ Security Features (100%)
- [x] reCAPTCHA bot prevention
- [x] Email verification (with nodemailer)
- [x] Profile management
- [x] Data backups (pg_dump)
- [x] Admin user management

---

## 📊 System Access Levels

| Role | Security Level | Permissions |
|------|---------------|-------------|
| **EMPLOYEE** | PUBLIC | Basic resource access |
| **MANAGER** | INTERNAL | Can access INTERNAL data, approve requests |
| **HR** | CONFIDENTIAL | Can access payroll, manage users |
| **ADMIN** | CONFIDENTIAL | Full system access, configuration |

---

## 🔒 Security Best Practices

1. **Change default secrets** in `.env` before production
2. **Use strong PostgreSQL password**
3. **Enable HTTPS** in production
4. **Configure firewall** to allow only necessary ports
5. **Regular backups** - Use built-in backup system
6. **Monitor logs** for suspicious activity
7. **Keep dependencies updated**: `npm audit`
8. **Limit admin accounts**
9. **Enable MFA** for all admin users
10. **Test security** before deployment

---

## 📞 Support

For issues or questions:
1. Check troubleshooting section above
2. Review project documentation
3. Check logs: `prisma/logs/` directory
4. Verify environment variables

---

## 🎓 Educational Use

This project demonstrates:
- Comprehensive security controls
- Industry-standard authentication
- Audit logging and compliance
- Defense-in-depth strategy
- Secure coding practices

Perfect for:
- Computer Security coursework
- Portfolio projects
- Learning web security
- Understanding access control models

---

**Last Updated**: November 30, 2025
**Version**: 1.0.0
**Status**: Production Ready
