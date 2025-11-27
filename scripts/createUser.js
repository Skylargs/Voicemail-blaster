const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const emailArg = args.find((a) => a.startsWith('--email='));
  const passwordArg = args.find((a) => a.startsWith('--password='));

  if (!emailArg || !passwordArg) {
    console.log('Usage: npm run create:user -- --email=test@example.com --password=secret123');
    process.exit(1);
  }

  const email = emailArg.split('=')[1]?.trim();
  const password = passwordArg.split('=')[1];

  if (!email || !password) {
    console.log('Email and password must not be empty.');
    process.exit(1);
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash },
    });
    console.log(`Created user ${user.email} with id ${user.id}`);
  } catch (err) {
    if (err.code === 'P2002') {
      console.log(`User with email ${email} already exists.`);
    } else {
      console.error('Error creating user:', err);
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Unexpected error creating user:', err);
  process.exit(1);
});


