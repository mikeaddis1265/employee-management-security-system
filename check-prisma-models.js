// Check what models are available in Prisma client
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

console.log('\n=== AVAILABLE PRISMA MODELS ===\n');
const models = Object.keys(prisma).filter(k => {
  return k !== '_' &&
         !k.startsWith('$') &&
         typeof prisma[k] === 'object' &&
         prisma[k] !== null;
});

models.forEach(model => {
  console.log('✓', model);
});

console.log('\n=== CHECKING FOR systemSettings ===');
if (prisma.systemSettings) {
  console.log('✅ systemSettings model EXISTS');
} else {
  console.log('❌ systemSettings model MISSING');
  console.log('\nThis means Prisma client needs to be regenerated.');
  console.log('Run: npx prisma generate');
}

console.log('\n');
process.exit(0);
