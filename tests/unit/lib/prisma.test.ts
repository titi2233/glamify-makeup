import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";

// Guarda de regresión del bug "Connection terminated unexpectedly" en Cloudflare
// Workers: el cliente Prisma NO debe ser un singleton de módulo (un Pool global
// reutiliza sockets entre requests, lo que el runtime de Workers prohíbe). Debe
// resolverse por-request, de forma perezosa, vía el Proxy `prisma` / `getDb`.

const DUMMY_URL = "postgresql://user:pass@localhost:5432/glamify";

describe("lib/prisma — cliente por-request (seguro para Cloudflare Workers)", () => {
  const originalUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
  });

  it("importar el módulo NO instancia un cliente global ni abre conexión", async () => {
    // El bug original creaba `new Pool()` + `new PrismaClient()` al cargar el
    // módulo. Importar debe ser inocuo incluso sin DATABASE_URL definida.
    delete process.env.DATABASE_URL;
    const mod = await import("@/lib/prisma");
    expect(mod.prisma).toBeDefined();
    expect(typeof mod.getDb).toBe("function");
  });

  it("resuelve el cliente de forma perezosa en cada acceso (Proxy → getDb)", async () => {
    process.env.DATABASE_URL = DUMMY_URL;
    const { prisma } = await import("@/lib/prisma");
    // Métodos del cliente: el Proxy los bindea al cliente real (no pierden `this`).
    expect(typeof prisma.$queryRawUnsafe).toBe("function");
    expect(typeof prisma.$transaction).toBe("function");
    // Delegados de modelo (objetos, no funciones) también resuelven.
    expect(prisma.product).toBeDefined();
  });

  it("falla recién al USAR prisma si falta DATABASE_URL, no al importar", async () => {
    delete process.env.DATABASE_URL;
    const { prisma } = await import("@/lib/prisma");
    // El error surge al resolver el connection string en el primer acceso.
    expect(() => prisma.$queryRawUnsafe).toThrow(/DATABASE_URL/);
  });
});
