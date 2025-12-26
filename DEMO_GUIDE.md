# Employee Management System (EMS) - Complete Demo Guide

## Project Overview
This is a comprehensive Employee Management System demonstrating all major access control models, authentication mechanisms, audit trails, and security features required for the Computer System Security course project.

## Features Implemented

### ✅ 1. Access Control Models

#### MAC (Mandatory Access Control)
- **Security Levels**: PUBLIC, INTERNAL, CONFIDENTIAL
- **Enforcement**: Users can only access resources at their security level or below
- **Admin Control**: Only admins can change user security levels
- **Demo Location**: Admin Panel → Users Table → Security Level column

#### DAC (Discretionary Access Control)
- **Resource Ownership**: Resource owners grant/revoke READ/WRITE permissions
- **Permission Logs**: All permission changes are logged
- **Demo Location**: Resources Detail Page → DAC Permissions section (owner only)

#### RBAC (Role-Based Access Control)
- **Roles**: EMPLOYEE, MANAGER, HR, ADMIN
- **Permissions**: Each role has predefined permissions stored in database
- **Dynamic Assignment**: Admins can change user roles dynamically
- **Audit Trail**: All role changes are logged
- **Demo Location**: Admin Panel → Assign Role section

#### RuBAC (Rule-Based Access Control)
- **Time-Based Rules**: Working hours restrictions (configurable)
- **Day-Based Rules**: Work days restrictions
- **IP-Based Rules**: Allowed/blocked IPs
- **Demo Location**: Login attempts outside working hours, Admin → Settings

#### ABAC (Attribute-Based Access Control)
- **Fine-Grained Control**: Uses role + department + time + other attributes
- **Policies**: Payroll access, leave approval, confidential access
- **Dynamic Evaluation**: Real-time policy evaluation
- **Demo Location**: Payroll page (only HR/Finance can access)

### ✅ 2. Audit Trails and Logging

#### User Activity Logging
- Logs: username, timestamp, IP address, action performed
- Encrypted storage using AES-256
- Details stored securely in database
- **Demo Location**: Logs page (Admin only)

#### System Events Logging
- System startup, shutdown, configuration changes
- Backup events, critical errors
- **Demo Location**: Logs page → Filter by "SYSTEM" user

#### Log Encryption
- AES-256-CBC encryption for sensitive log details
- Encrypted at write, decrypted at read
- Encryption key in environment variables
- **Demo Location**: Check database directly or API response

#### Centralized Logging
- All logs in single database table
- Easy monitoring and analysis
- **Demo Location**: Logs page shows all centralized logs

#### Alerting Mechanisms
- Console warnings for critical events
- Failed logins, access denials, account lockouts
- Anomaly detection in logs page
- **Demo Location**: Logs page → Red highlighted rows

### ✅ 3. Data Backups

#### Regular Backups
- Manual backup trigger available
- Database dump using pg_dump
- Stored in `/backups` directory
- Auto-cleanup keeps last 30 backups
- **Demo Location**: Admin → Settings page (or create backup API route)

### ✅ 4. Identification and Authentication

#### User Registration
- Secure registration form with validation
- Email verification required before login
- CAPTCHA protection (Google reCAPTCHA)
- **Demo Location**: /register page

#### Email Verification
- Verification token generated on registration
- Email sent via EmailJS
- Account locked until verified
- **Demo Location**: Register → Check email → /verify page

#### CAPTCHA
- Google reCAPTCHA v2
- Prevents bot registrations
- User-friendly implementation
- **Demo Location**: Registration form

#### User Profiles
- Secure profile management
- Password change functionality
- MFA enablement
- **Demo Location**: /profile page

#### Password Authentication

##### Password Policies
- Minimum 8 characters
- Uppercase + lowercase letters required
- Numbers required
- Special characters required (optional but recommended)
- Real-time validation feedback
- **Demo Location**: Registration form

##### Password Hashing
- Bcrypt algorithm (12 rounds)
- Rainbow table attack protection via salting
- **Demo Location**: Backend code (lib/auth.ts)

##### Account Lockout Policy
- 3 failed attempts → account locked
- 15-minute lockout duration
- Warnings after each failed attempt
- **Demo Location**: Login page (try wrong password 3 times)

##### Secure Password Transmission
- HTTPS in production (HTTP in development)
- Passwords never stored in plain text
- **Demo Location**: Login/Register forms

##### Password Change
- Current password verification required
- New password validation
- **Demo Location**: Profile page → Change Password

#### Token-Based Authentication
- JWT tokens with 30-minute expiry
- HTTP-only cookies
- Secure cookie flags in production
- **Demo Location**: Backend implementation

#### Session Management
- Automatic session expiry
- Logout functionality
- Token refresh on activity
- **Demo Location**: All protected routes

#### Multi-Factor Authentication (MFA)
- TOTP (Time-based One-Time Password)
- QR code generation for Google Authenticator
- 6-digit code verification
- Optional for users
- **Demo Location**: Register → Scan QR → Login with OTP

---

## Complete Demo Script for Your Teacher

### Prerequisites
```bash
# 1. Ensure PostgreSQL is running
# 2. Database is set up with users
# 3. Start the application
npm run dev
```

### Demo Flow (30-40 minutes)

#### Part 1: Registration & Authentication (8 minutes)

**1.1 User Registration**
1. Navigate to http://localhost:3000/register
2. Fill in registration form:
   - Username: `demo_employee`
   - Email: `demo@example.com`
   - Password: `SecurePass123!`
   - Department: `Engineering`
3. Complete CAPTCHA
4. Click "Create Account"
5. **Show**: MFA QR Code appears
6. **Explain**: Email verification sent (check console or EmailJS)
7. Scan QR code with Google Authenticator app (or show secret)
8. Click "Continue to Login"

**1.2 Email Verification**
1. Check console for verification link
2. Open verification link in browser
3. **Show**: Email verified successfully message
4. **Explain**: User can now log in

**1.3 Login with MFA**
1. Navigate to http://localhost:3000/login
2. Enter username and password
3. **Show**: MFA prompt appears
4. Enter 6-digit code from authenticator app
5. Successfully logged in
6. **Show**: Redirected to dashboard

**1.4 Account Lockout (Security Feature)**
1. Log out
2. Try logging in with wrong password 3 times
3. **Show**: Account locked message with countdown
4. **Explain**: Prevents brute force attacks

#### Part 2: Access Control Demonstration (12 minutes)

**2.1 MAC (Mandatory Access Control)**
1. Log in as Employee (PUBLIC security level)
2. Go to Dashboard → Resources
3. **Show**: Can only see PUBLIC resources
4. **Explain**: Cannot see INTERNAL or CONFIDENTIAL resources
5. Log out, log in as Admin
6. Admin Panel → Change employee's security level to INTERNAL
7. Log back in as employee
8. **Show**: Now sees INTERNAL resources too

**2.2 DAC (Discretionary Access Control)**
1. Log in as user who owns a resource
2. Navigate to resource detail page
3. **Show**: DAC Permissions section (only visible to owner)
4. Grant READ permission to another user
5. **Show**: Permission appears in table
6. Log in as the other user
7. **Show**: Can now access the resource
8. Log back as owner
9. Revoke permission
10. **Show**: Other user loses access

**2.3 RBAC (Role-Based Access Control)**
1. Log in as Admin
2. Admin Panel → Assign Role
3. Select a user, change role from EMPLOYEE to MANAGER
4. **Show**: Role updated successfully
5. Log in as that user
6. **Show**: Access to manager-specific features
7. **Explain**: Role defines what actions user can perform

**2.4 RuBAC (Rule-Based Access Control)**
1. Admin → Settings → Working Hours
2. **Show**: Current working hours configuration
3. Try logging in outside working hours (if time permits)
4. **Show**: Access denied message
5. **Explain**: Time-based and day-based restrictions

**2.5 ABAC (Attribute-Based Access Control)**
1. Log in as user with HR role and Payroll department
2. Navigate to /payroll
3. **Show**: Access granted (role + department match policy)
4. Log in as Engineer employee
5. Try accessing /payroll
6. **Show**: Access denied
7. **Explain**: Policy requires HR role OR Finance department

#### Part 3: Audit Trails and Logging (6 minutes)

**3.1 View Audit Logs**
1. Log in as Admin
2. Navigate to /logs
3. **Show**: Complete audit trail with:
   - Timestamps
   - Usernames
   - Actions (login, resource access, permission changes)
   - IP addresses
   - Encrypted details

**3.2 Anomaly Detection**
1. **Show**: Red highlighted rows (failed logins, access denials)
2. Filter by "failed" actions
3. **Show**: Security alerts at top of page

**3.3 Log Export**
1. Click "Export" button
2. **Show**: CSV file downloaded with all log data

**3.4 Encrypted Logs**
1. Open browser DevTools → Network
2. Refresh logs page
3. Check API response
4. **Show**: Logs are decrypted before display
5. **Explain**: Stored encrypted in database

#### Part 4: Admin Features (8 minutes)

**4.1 User Management**
1. Admin Panel
2. **Show**: All users table with:
   - Roles
   - Security levels
   - Lock status
   - Email verification status

**4.2 Role Assignment**
1. Select user
2. Choose new role
3. Assign role
4. **Show**: Audit trail updated

**4.3 Security Level Management**
1. Change user's security level from dropdown
2. **Show**: Instant update
3. **Explain**: MAC enforcement

**4.4 Permission Management**
1. Select resource
2. Select target user
3. Grant READ or WRITE permission
4. **Show**: Permission granted
5. **Explain**: DAC in action

**4.5 Resource Overview**
1. **Show**: All resources with sensitivity levels
2. Click "View" on a resource
3. **Show**: Full access control information

#### Part 5: Additional Features (6 minutes)

**5.1 Resource Management**
1. Dashboard → Create Resource
2. Create JSON resource with:
   - Name: "Salary Report"
   - Security Level: CONFIDENTIAL
   - Content: JSON data
3. **Show**: Resource created
4. Click on resource
5. **Show**: Resource detail page with access controls

**5.2 File Upload Resource**
1. Dashboard → Upload Resource File
2. Upload a PDF or document
3. **Show**: File stored securely
4. Access resource
5. **Show**: Download/view file option

**5.3 Profile Management**
1. Navigate to /profile
2. **Show**: User information
3. Change password feature
4. MFA enable/disable option

**5.4 Data Backup**
1. Create backup API endpoint test (or show in code)
2. **Explain**: Regular backups to `/backups` directory
3. **Show**: Backup files (if accessible)

---

## Key Points to Emphasize

### Security Features
✅ **No Plain Text Passwords**: All passwords hashed with bcrypt
✅ **Encrypted Logs**: AES-256 encryption for sensitive data
✅ **MFA Protection**: Optional TOTP for extra security
✅ **Account Lockout**: Prevents brute force attacks
✅ **Email Verification**: Prevents fake accounts
✅ **CAPTCHA**: Bot prevention
✅ **Session Security**: HTTP-only cookies, token expiry
✅ **Access Control**: 5 different models (MAC, DAC, RBAC, RuBAC, ABAC)
✅ **Audit Trail**: Complete logging of all activities
✅ **IP Logging**: Track user locations
✅ **Anomaly Detection**: Alert on suspicious activities

### Technical Implementation
✅ **Next.js 16**: Modern React framework
✅ **Prisma ORM**: Type-safe database access
✅ **PostgreSQL**: Robust relational database
✅ **TypeScript**: Type safety throughout
✅ **Zod**: Runtime validation
✅ **JWT**: Secure token-based authentication
✅ **Speakeasy**: TOTP implementation
✅ **EmailJS**: Email verification
✅ **Google reCAPTCHA**: Bot protection

---

## Troubleshooting

### Common Issues

**1. Database Connection Error**
```bash
# Check if PostgreSQL is running
# Verify DATABASE_URL in .env
# Run: npx prisma migrate dev
```

**2. Email Not Sending**
- Check EmailJS configuration in .env
- Verify NEXT_PUBLIC_EMAILJS_* variables are set
- Check console for verification link

**3. CAPTCHA Not Working**
- Ensure NEXT_PUBLIC_RECAPTCHA_SITE_KEY is set
- Check reCAPTCHA admin console

**4. Login Fails**
- Verify email is verified
- Check account is not locked
- Ensure correct password

**5. Access Denied**
- Check user's security level
- Verify resource sensitivity level
- Check working hours settings

---

## Testing Credentials

### Default Admin Account
```
Username: admin
Password: Admin@123456
Role: ADMIN
Security Level: CONFIDENTIAL
```

### Default Manager Account
```
Username: manager
Password: Manager@123456
Role: MANAGER
Security Level: INTERNAL
```

### Default Employee Account
```
Username: employee
Password: Employee@123456
Role: EMPLOYEE
Security Level: PUBLIC
```

---

## Demonstration Checklist

Before the demo, ensure:

- [ ] PostgreSQL is running
- [ ] Database has users (admin, manager, employee)
- [ ] Application is running (`npm run dev`)
- [ ] You have tested all features
- [ ] Google Authenticator app is installed on phone
- [ ] Browser is in clean state (clear cache/cookies)
- [ ] Have backup users ready in case of lockouts
- [ ] All pages load without errors
- [ ] Network tab is open to show API calls (optional)

---

## Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth pages (login, register, verify)
│   ├── admin/             # Admin panel
│   ├── dashboard/         # User dashboards
│   ├── resources/         # Resource management
│   ├── logs/              # Audit logs
│   ├── profile/           # User profile
│   └── api/               # API routes
├── lib/                    # Core libraries
│   ├── auth.ts            # Authentication logic
│   ├── access-control.ts  # All 5 access control models
│   ├── logger.ts          # Audit logging & encryption
│   ├── backup.ts          # Database backups
│   └── prisma.ts          # Database client
├── prisma/                # Database schema & seed
├── components/            # Reusable UI components
└── public/                # Static assets
```

---

## Quick Test Commands

```bash
# Start application
npm run dev

# Generate Prisma client
npm run db:generate

# Reset database (CAUTION!)
npx prisma migrate reset

# Seed database
npm run db:seed

# View database
npx prisma studio
```

---

## Conclusion

This project demonstrates a **production-grade** Employee Management System with:
- ✅ **5 Access Control Models** (MAC, DAC, RBAC, RuBAC, ABAC)
- ✅ **Complete Audit Trail** with encryption
- ✅ **Multi-Factor Authentication**
- ✅ **Email Verification**
- ✅ **CAPTCHA Protection**
- ✅ **Account Lockout Policy**
- ✅ **Secure Password Handling**
- ✅ **Session Management**
- ✅ **Data Backups**
- ✅ **Anomaly Detection**
- ✅ **Full UI for all features**

All requirements from the project specification have been implemented and are fully functional with a user-friendly interface.

---

## Contact & Support

If you encounter any issues during the demo:
1. Check the console for error messages
2. Verify database connection
3. Ensure all environment variables are set
4. Check the logs table for audit trail
5. Refer to this guide for troubleshooting steps

**Good luck with your presentation!** 🎓🔒
