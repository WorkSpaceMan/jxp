/**
 * Load ESM-only packages from CommonJS output without TypeScript rewriting
 * `import()` to `require()` (which breaks @modelcontextprotocol/* v2).
 */
export function dynamicImport<T = Record<string, unknown>>(specifier: string): Promise<T> {
	const fn = new Function("specifier", "return import(specifier)") as (s: string) => Promise<T>;
	return fn(specifier);
}
