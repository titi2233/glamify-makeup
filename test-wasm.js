import { PrismaClient } from '@prisma/client/wasm.js';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres' });
const adapter = new PrismaPg(pool);
try {
  const prisma = new PrismaClient({ adapter });
  console.log("Success with wasm");
} catch (e) {
  console.error("Error:", e.message);
}
