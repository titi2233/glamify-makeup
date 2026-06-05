import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyMpSignature } from "@/lib/payments/signature";

const SECRET = "test_webhook_secret";
const dataId = "123456789";
const requestId = "req-abc";
const ts = "1717500000";

function validV1(): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return createHmac("sha256", SECRET).update(manifest).digest("hex");
}

describe("verifyMpSignature", () => {
  it("acepta una firma válida", async () => {
    const xSignature = `ts=${ts},v1=${validV1()}`;
    await expect(verifyMpSignature({ xSignature, xRequestId: requestId, dataId, secret: SECRET })).resolves.toBe(true);
  });
  it("rechaza una firma alterada", async () => {
    const xSignature = `ts=${ts},v1=${"0".repeat(64)}`;
    await expect(verifyMpSignature({ xSignature, xRequestId: requestId, dataId, secret: SECRET })).resolves.toBe(false);
  });
  it("rechaza si cambia el dataId (manifest distinto)", async () => {
    const xSignature = `ts=${ts},v1=${validV1()}`;
    await expect(verifyMpSignature({ xSignature, xRequestId: requestId, dataId: "999", secret: SECRET })).resolves.toBe(false);
  });
  it("rechaza header ausente o malformado", async () => {
    await expect(verifyMpSignature({ xSignature: null, xRequestId: requestId, dataId, secret: SECRET })).resolves.toBe(false);
    await expect(verifyMpSignature({ xSignature: "garbage", xRequestId: requestId, dataId, secret: SECRET })).resolves.toBe(false);
  });
  it("rechaza si falta el secret", async () => {
    const xSignature = `ts=${ts},v1=${validV1()}`;
    await expect(verifyMpSignature({ xSignature, xRequestId: requestId, dataId, secret: "" })).resolves.toBe(false);
  });
});
