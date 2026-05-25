import restify from "restify";
import type { JXPConfig, JXPRequest, JXPResponse } from "../types/jxp-config";

export interface LoginRateLimitConfig {
	enabled?: boolean;
	/** Max attempts in a short burst (token bucket). */
	burst?: number;
	/** Sustained attempts allowed per minute per client. */
	per_minute?: number;
	/** Use X-Forwarded-For instead of remoteAddress (set when behind a reverse proxy). */
	xff?: boolean;
}

type ThrottleMiddleware = (req: JXPRequest, res: JXPResponse, next: () => void) => void;

const DEFAULT_BURST = 8;
const DEFAULT_PER_MINUTE = 12;

function resolveOptions(config: JXPConfig): LoginRateLimitConfig {
	return config.login_rate_limit ?? {};
}

/** Restify throttle handler for credential-bearing endpoints. */
export function createLoginThrottle(config: JXPConfig): ThrottleMiddleware | null {
	const opts = resolveOptions(config);
	if (opts.enabled === false) {
		return null;
	}
	const burst = opts.burst ?? DEFAULT_BURST;
	const perMinute = opts.per_minute ?? DEFAULT_PER_MINUTE;
	const rate = perMinute / 60;
	const throttleOpts: {
		burst: number;
		rate: number;
		ip?: boolean;
		xff?: boolean;
		setHeaders?: boolean;
	} = {
		burst,
		rate,
		setHeaders: true,
	};
	if (opts.xff) {
		throttleOpts.xff = true;
	} else {
		throttleOpts.ip = true;
	}
	return restify.plugins.throttle(throttleOpts) as ThrottleMiddleware;
}

export function logLoginRateLimit(config: JXPConfig): void {
	if (config.quiet_startup) return;
	const opts = resolveOptions(config);
	if (opts.enabled === false) {
		console.log("Login rate limit: disabled");
		return;
	}
	const burst = opts.burst ?? DEFAULT_BURST;
	const perMinute = opts.per_minute ?? DEFAULT_PER_MINUTE;
	const key = opts.xff ? "X-Forwarded-For" : "IP";
	console.log(`Login rate limit: ${burst} burst, ${perMinute}/min per ${key}`);
}
