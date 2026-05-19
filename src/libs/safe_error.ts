/** Log full error server-side; return a safe client message for 500s. */
export function safeErrorMessage(err: unknown): string {
	if (err && typeof err === "object" && "message" in err && typeof (err as Error).message === "string") {
		const msg = (err as Error).message;
		if (msg.length > 0 && msg.length < 200 && !msg.includes(" at ")) {
			return msg;
		}
	}
	return "An internal error occurred";
}
