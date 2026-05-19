/**
 * Restify pulls in `spdy` → `http-deceiver`, which uses deprecated
 * process.binding('http_parser') on Node 22+. Harmless until upstream fixes lazy loading.
 */
const originalEmit = process.emit.bind(process);

process.emit = function emit(
	name: string | symbol,
	data: unknown,
	...args: unknown[]
): boolean {
	if (
		name === "warning" &&
		typeof data === "object" &&
		data !== null &&
		"name" in data &&
		(data as NodeJS.ErrnoException).name === "DeprecationWarning" &&
		"message" in data &&
		typeof (data as Error).message === "string" &&
		(data as Error).message.includes("process.binding('http_parser')")
	) {
		return false;
	}
	return originalEmit(name, data, ...args);
} as typeof process.emit;
