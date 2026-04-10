type DateFormat = "date-relative" | "date" | "datetime" | "time";

export function formatDate(value: string | Date, format: DateFormat, timezone: string): string {
	const date = typeof value === "string" ? new Date(value) : value;

	switch (format) {
		case "date-relative": {
			const diffMs = Date.now() - date.getTime();
			if (diffMs < 60_000) return "just now";
			if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
			if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
			return new Intl.DateTimeFormat(undefined, {
				timeZone: timezone,
				month: "short",
				day: "numeric",
			}).format(date);
		}
		case "date":
			return new Intl.DateTimeFormat(undefined, {
				timeZone: timezone,
				year: "numeric",
				month: "short",
				day: "numeric",
			}).format(date);
		case "datetime":
			return new Intl.DateTimeFormat(undefined, {
				timeZone: timezone,
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			}).format(date);
		case "time":
			return new Intl.DateTimeFormat(undefined, {
				timeZone: timezone,
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			}).format(date);
	}
}
