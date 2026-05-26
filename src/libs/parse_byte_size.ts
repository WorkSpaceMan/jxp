import bytes from "bytes";

const UNIT_ALIASES: Record<string, string> = {
	b: "b",
	k: "kb",
	kb: "kb",
	kib: "kb",
	m: "mb",
	mb: "mb",
	mib: "mb",
	g: "gb",
	gb: "gb",
	gib: "gb",
	t: "tb",
	tb: "tb",
	tib: "tb",
};

/** Normalize human sizes (e.g. `10M`, `10kb`) for the `bytes` parser. */
export function normalizeByteSizeString(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return trimmed;
	}
	const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
	if (!match) {
		return trimmed.toLowerCase();
	}
	const [, num, unit] = match;
	if (!unit) {
		return num;
	}
	const mapped = UNIT_ALIASES[unit.toLowerCase()];
	if (!mapped) {
		return trimmed.toLowerCase();
	}
	return `${num}${mapped}`;
}

/**
 * Parse a byte size from a number (bytes) or string (`10mb`, `10M`, `512kb`).
 * Returns 0 for disabled (`0`, `0b`, `false`). Throws on invalid values.
 */
export function parseByteSize(value: string | number | null | undefined, label = "byte size"): number {
	if (value === null || value === undefined) {
		throw new Error(`${label} is required`);
	}
	if (typeof value === "number") {
		if (!Number.isFinite(value) || value < 0) {
			throw new Error(`${label} must be a non-negative number`);
		}
		return Math.floor(value);
	}
	const raw = String(value).trim();
	if (!raw) {
		throw new Error(`${label} must not be empty`);
	}
	if (raw === "0" || raw.toLowerCase() === "0b" || raw.toLowerCase() === "false") {
		return 0;
	}
	const normalized = normalizeByteSizeString(raw);
	const parsed = bytes.parse(normalized);
	if (parsed === null || !Number.isFinite(parsed) || parsed < 0) {
		throw new Error(`${label} "${value}" is not a valid byte size (e.g. 10mb, 512kb, 10M)`);
	}
	return parsed;
}

/** Safe parse for config/env; returns fallback when value is missing. */
export function parseByteSizeOr(
	value: string | number | null | undefined,
	fallback: string | number,
	label = "byte size"
): number {
	if (value === null || value === undefined || value === "") {
		return parseByteSize(fallback, label);
	}
	return parseByteSize(value, label);
}
