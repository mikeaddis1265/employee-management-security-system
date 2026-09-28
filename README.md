# Employee Management System

A full-stack Employee Management System built to demonstrate applied access control theory and security engineering practices for a university Computer Systems Security course. It implements five distinct access control models in a single working application, along with authentication hardening, encrypted audit logging, and role-based workflows for HR operations.

## Access Control Models

The system implements and combines five access control models rather than relying on a single authorization strategy:

- Mandatory Access Control (MAC): resources are classified as Public, Internal, or Confidential, and users can only access resources at or below their assigned security level.
- Discretionary Access Control (DAC): resource owners can grant or revoke read and write permissions to other users, with every change logged.
- Role-Based Access Control (RBAC): permissions are defined per role (Employee, Manager, HR, Admin) and stored in the database.
- Rule-Based Access Control (RuBAC): access can be restricted by time of day, day of week, or IP address, configurable by an administrator.
- Attribute-Based Access Control (ABAC): fine-grained policies evaluate role, department, and other attributes together, for example restricting payroll access to HR and Finance.

All five checks are composed in a single access control pipeline, and every denial records which layer rejected the request.

## Security Features

- Password hashing with bcrypt (12 rounds)
- JWT-based sessions stored in HTTP-only cookies with a 30-minute expiry
- Time-based one-time password (TOTP) multi-factor authentication with QR code enrollment
- Account lockout after repeated failed login attempts
- Email verification and CAPTCHA-protected registration
- Audit logs encrypted at rest with AES-256-GCM (authenticated encryption, not plain CBC)
- Environment-based secrets that fail closed if misconfigured, rather than falling back to a default key

## Tech Stack

Next.js, React, and TypeScript on the frontend and API layer; Prisma ORM over PostgreSQL for data access; Zod for runtime validation; bcrypt, jsonwebtoken, and speakeasy for authentication and MFA.

## Getting Started

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in a PostgreSQL connection string plus a JWT secret and encryption key
3. Set up the database: `npm run db:setup`
4. Start the development server: `npm run dev`

Full setup instructions, including optional email and CAPTCHA configuration, are in `SETUP_GUIDE.md`. A walkthrough of every feature is in `DEMO_GUIDE.md`.

## Testing

A unit test suite covers the access control logic, authentication, and log encryption:

```
npm test
```

## Project Structure

```
app/            Next.js pages and API routes
lib/            Access control, authentication, logging, and database logic
prisma/         Database schema, migrations, and seed data
components/     Reusable UI components
tests/          Unit tests
```

## Known Limitations

This is a coursework project, not a production system. A few tradeoffs are worth noting: rule-based access control defaults to permissive unless an administrator explicitly enables working-hours restrictions, there is no automated end-to-end test coverage for the UI, and secrets in `.env` are development-only values that must be rotated before any real deployment.
