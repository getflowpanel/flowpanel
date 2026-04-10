const DEFAULT_REDACTION_KEYS = new Set([
	"apikey",
	"api_key",
	"authorization",
	"password",
	"token",
	"secret",
	"cookie",
	"bearer",
]);

const DEFAULT_PATTERNS: RegExp[] = [
	/sk-[a-zA-Z0-9]{20,}/g,
	/Bearer\s+[a-zA-Z0-9._-]+/g,
	/postgres:\/\/[^:]+:[^@]+@/g,
];

function isPlainObject(val: unknown): val is Record<string, unknown> {
	return typeof val === "object" && val !== null && !Array.isArray(val);
}

export function redactString(value: string): string {
	let result = value;
	for (const pattern of DEFAULT_PATTERNS) {
		// Reset lastIndex since patterns use /g flag
		pattern.lastIndex = 0;
		result = result.replace(pattern, "[REDACTED]");
	}
	return result;
}

export function redactValue(key: string, value: unknown, extraKeys: string[]): unknown {
	const lowerKey = key.toLowerCase();
	const isRedactedKey =
		DEFAULT_REDACTION_KEYS.has(lowerKey) || extraKeys.some((k) => k.toLowerCase() === lowerKey);

	if (isRedactedKey) return "[REDACTED]";
	if (typeof value === "string") return redactString(value);
	if (isPlainObject(value)) return redactObject(value, extraKeys);
	return value;
}

export function redactObject(
	obj: Record<string, unknown>,
	extraKeys: string[],
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		result[key] = redactValue(key, value, extraKeys);
	}
	return result;
}
