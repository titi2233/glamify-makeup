import { describe, it, expect, vi } from "vitest";
import { sendEmail } from "@/lib/email/resend";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

describe("sendEmail", () => {
  it("postea a Resend cuando hay API key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "email-1" }));
    const r = await sendEmail(
      { to: "ana@example.com", subject: "Hola", html: "<p>hi</p>", from: "Glamify <p@glamify.site>" },
      { fetch: fetchMock, apiKey: "re_test" },
    );
    expect(r).toEqual({ id: "email-1", logged: false });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("api.resend.com/emails");
    expect((opts as RequestInit).headers).toMatchObject({ Authorization: "Bearer re_test" });
  });
  it("sin API key → loguea y no postea", async () => {
    const fetchMock = vi.fn();
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const r = await sendEmail({ to: "ana@example.com", subject: "Hola", html: "<p>hi</p>" }, { fetch: fetchMock, apiKey: "" });
    expect(r).toEqual({ id: null, logged: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
