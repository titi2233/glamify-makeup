import { PrismaClient } from '@prisma/client/wasm.js';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
const pool = new pg.Pool({});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
console.log("Success");
