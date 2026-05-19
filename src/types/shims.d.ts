declare module "json2csv" {
	export function parse(data: unknown[], opts?: Record<string, unknown>): string;
}

declare module "jstransformer" {
	function jstransformer(transformer: unknown): {
		render(input: string): { body: string };
	};
	export = jstransformer;
}

declare module "nodemailer-smtp-transport" {
	import type SMTPTransport from "nodemailer/lib/smtp-transport";
	function smtpTransport(options: SMTPTransport.Options): SMTPTransport.Options;
	export = smtpTransport;
}

declare module "mongoose-friendly" {
	import type { Schema } from "mongoose";
	function friendly(schema: Schema, options: { source: string; friendly: string }): void;
	export = friendly;
}
