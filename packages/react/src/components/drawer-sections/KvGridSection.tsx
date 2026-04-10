import { useState } from "react";
import { useToast } from "../Toast.js";

interface KvGridSectionProps {
	data: Record<string, unknown>;
	columns?: number;
}

function CopyButton({ value }: { value: string }) {
	const [copied, setCopied] = useState(false);
	const { toast } = useToast();

	function handleCopy() {
		navigator.clipboard.writeText(value).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
			toast({ message: "Copied", variant: "info" });
		});
	}

	return (
		<button
			onClick={handleCopy}
			title="Copy to clipboard"
			style={{
				flexShrink: 0,
				width: 18,
				height: 18,
				borderRadius: 4,
				border: "1px solid var(--fp-border-1)",
				background: "transparent",
				color: copied ? "var(--fp-ok)" : "var(--fp-text-4)",
				cursor: "pointer",
				fontSize: 10,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 0,
				lineHeight: 1,
			}}
		>
			{copied ? "✓" : "⎘"}
		</button>
	);
}

export function KvGridSection({ data, columns = 2 }: KvGridSectionProps) {
	const entries = Object.entries(data ?? {});

	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: `repeat(${columns}, 1fr)`,
				gap: "1px",
				border: "1px solid var(--fp-border-1)",
				borderRadius: 8,
				overflow: "hidden",
				background: "var(--fp-border-1)",
			}}
		>
			{entries.map(([key, value]) => {
				const str = value == null ? "—" : String(value);
				return (
					<div
						key={key}
						style={{
							background: "var(--fp-surface-1)",
							padding: "8px 12px",
							display: "flex",
							flexDirection: "column",
							gap: 3,
						}}
					>
						<span
							style={{
								fontSize: 11,
								color: "var(--fp-text-4)",
								letterSpacing: "0.02em",
							}}
						>
							{key}
						</span>
						<div style={{ display: "flex", alignItems: "center", gap: 4 }}>
							<span
								style={{
									fontSize: 13,
									fontFamily: "var(--fp-font-mono, monospace)",
									color: "var(--fp-text-2)",
									wordBreak: "break-all",
									flex: 1,
								}}
							>
								{str}
							</span>
							{value != null && <CopyButton value={str} />}
						</div>
					</div>
				);
			})}
		</div>
	);
}
