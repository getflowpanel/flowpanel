import { describe, expect, it } from "vitest";
import { redactObject, redactString } from "../redaction.js";

describe("redactObject", () => {
	it("redacts a known key", () => {
		const result = redactObject({ apiKey: "sk-1234", safe: "hello" }, []);
		expect(result.apiKey).toBe("[REDACTED]");
		expect(result.safe).toBe("hello");
	});

	it("redacts OpenAI sk- pattern in string values", () => {
		const result = redactObject({ message: "key is sk-abcdefgh12345678901234" }, []);
		expect(result.message).not.toContain("sk-abcdefgh");
		expect(result.message).toContain("[REDACTED]");
	});

	it("redacts nested object keys", () => {
		const result = redactObject({ meta: { apiKey: "secret123", name: "ok" } }, []);
		// biome-ignore lint/suspicious/noExplicitAny: test result cast
		expect((result.meta as any).apiKey).toBe("[REDACTED]");
		// biome-ignore lint/suspicious/noExplicitAny: test result cast
		expect((result.meta as any).name).toBe("ok");
	});

	it("redacts user-defined keys", () => {
		const result = redactObject({ customSecret: "hide-me", safe: "keep" }, ["customSecret"]);
		expect(result.customSecret).toBe("[REDACTED]");
		expect(result.safe).toBe("keep");
	});

	it("leaves non-sensitive keys untouched", () => {
		const result = redactObject({ tokensIn: 1200, model: "gpt-4o" }, []);
		expect(result.tokensIn).toBe(1200);
		expect(result.model).toBe("gpt-4o");
	});
});

describe("redactString", () => {
	it("redacts Bearer token", () => {
		const result = redactString("Authorization: Bearer eyJhbGciOi.abc.def");
		expect(result).toContain("[REDACTED]");
		expect(result).not.toContain("eyJhbGciOi");
	});

	it("redacts postgres connection string credentials", () => {
		const result = redactString("postgres://user:password123@localhost:5432/db");
		expect(result).not.toContain("password123");
	});
});
