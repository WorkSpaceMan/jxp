const c = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	magenta: "\x1b[35m",
	blue: "\x1b[34m",
	gray: "\x1b[90m",
};

const BANNER = [
	"     ██╗██╗  ██╗██████╗ ",
	"     ██║╚██╗██╔╝██╔══██╗",
	"     ██║ ╚███╔╝ ██████╔╝",
	"██   ██║ ██╔██╗ ██╔═══╝ ",
	"╚█████╔╝██╔╝ ██╗██║     ",
	" ╚════╝ ╚═╝  ╚═╝╚═╝     ",
].join("\n");

export interface StartupContext {
	name: string;
	version: string;
	mongoUri: string;
	accessLog?: string;
	maxPoolSize?: number;
}

export interface ReadyContext extends StartupContext {
	url: string;
	mongooseVersion: string;
	mongoConnectedAt: Date;
}

export function printBanner(ctx: StartupContext): void {
	const versionTag = `${ctx.name} v${ctx.version}`;
	const bannerWidth = BANNER.split("\n")[0]?.length ?? versionTag.length;
	const pad = Math.max(0, Math.floor((bannerWidth - versionTag.length) / 2));

	console.log("");
	console.log(`${c.cyan}${BANNER}${c.reset}`);
	console.log(
		`${c.dim}${" ".repeat(pad)}${c.bold}${c.magenta}${versionTag}${c.reset}${c.dim} · REST API framework${c.reset}`
	);
	console.log("");
}

export function printBooting(ctx: StartupContext): void {
	const mongoDisplay = maskMongoCredentials(ctx.mongoUri);
	console.log(`${c.gray}  ┌─ booting${c.reset}`);
	console.log(`${c.gray}  │${c.reset}  ${c.dim}MongoDB${c.reset}     ${mongoDisplay}`);
	if (ctx.accessLog) {
		console.log(`${c.gray}  │${c.reset}  ${c.dim}Access log${c.reset}  ${ctx.accessLog}`);
	}
	if (ctx.maxPoolSize) {
		console.log(`${c.gray}  │${c.reset}  ${c.dim}Pool max${c.reset}    ${ctx.maxPoolSize}`);
	}
	console.log(`${c.gray}  └─${c.reset}`);
	console.log("");
}

export function printReady(ctx: ReadyContext): void {
	const mongoDisplay = maskMongoCredentials(ctx.mongoUri);
	const time = ctx.mongoConnectedAt.toLocaleTimeString();

	console.log(`${c.green}${c.bold}  ✓ Ready${c.reset}`);
	console.log(`${c.gray}  ├─${c.reset}  ${c.dim}HTTP${c.reset}       ${c.cyan}${ctx.url}${c.reset}`);
	console.log(
		`${c.gray}  ├─${c.reset}  ${c.dim}MongoDB${c.reset}    ${c.green}connected${c.reset} ${c.dim}at ${time}${c.reset}`
	);
	console.log(`${c.gray}  ├─${c.reset}  ${c.dim}Database${c.reset}   ${mongoDisplay}`);
	if (ctx.accessLog) {
		console.log(`${c.gray}  ├─${c.reset}  ${c.dim}Access log${c.reset} ${ctx.accessLog}`);
	}
	console.log(
		`${c.gray}  └─${c.reset}  ${c.dim}Mongoose${c.reset}   v${ctx.mongooseVersion}${c.reset}`
	);
	console.log("");
}

function maskMongoCredentials(uri: string): string {
	return uri.replace(/\/\/([^@/]+@)/, "//***@");
}
