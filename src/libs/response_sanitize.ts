const DEFAULT_STRIP_FIELDS = ["password"];

function stripFromObject(obj: Record<string, unknown>, fields: Set<string>): void {
	for (const key of Object.keys(obj)) {
		if (fields.has(key)) {
			delete obj[key];
		} else if (obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key]) && !(obj[key] instanceof Date)) {
			stripFromObject(obj[key] as Record<string, unknown>, fields);
		}
	}
}

function docToPlain(doc: unknown): Record<string, unknown> {
	if (!doc || typeof doc !== "object") return {};
	if (typeof (doc as { toObject?: () => Record<string, unknown> }).toObject === "function") {
		return (doc as { toObject: () => Record<string, unknown> }).toObject();
	}
	if (typeof (doc as { _doc?: Record<string, unknown> })._doc !== "undefined") {
		return { ...(doc as { _doc: Record<string, unknown> })._doc };
	}
	return { ...(doc as Record<string, unknown>) };
}

export function sanitizeDocument(doc: unknown, stripFields?: string[]): Record<string, unknown> {
	const fields = new Set(stripFields ?? DEFAULT_STRIP_FIELDS);
	const plain = docToPlain(doc);
	stripFromObject(plain, fields);
	return plain;
}

export function sanitizeListResult(
	result: { data?: unknown[]; [key: string]: unknown },
	stripFields?: string[]
): void {
	if (!result.data || !Array.isArray(result.data)) return;
	result.data = result.data.map((row) => sanitizeDocument(row, stripFields));
}

export function sanitizeResponse(result: unknown, stripFields?: string[]): unknown {
	if (!result || typeof result !== "object") return result;
	const r = result as { data?: unknown };
	if (Array.isArray(r.data)) {
		sanitizeListResult(r as { data: unknown[] }, stripFields);
	} else if (r.data) {
		(r as { data: unknown }).data = sanitizeDocument(r.data, stripFields);
	}
	return result;
}

module.exports = {
	DEFAULT_STRIP_FIELDS,
	sanitizeDocument,
	sanitizeListResult,
	sanitizeResponse,
};
