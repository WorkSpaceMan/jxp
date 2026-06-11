/** Safely serialize a Mongoose schema path for API/MCP describe output. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeField(field: any): Record<string, unknown> {
	const safeField: Record<string, unknown> = {
		path: field.path,
		instance: field.instance,
		options: { ...field.options },
		validators: field.validators?.map((v: { type?: { name?: string }; message?: string }) => ({
			type: v.type?.name,
			message: v.message,
		})),
		isRequired: field.isRequired,
	};

	if (typeof field.defaultValue === "function") {
		safeField.defaultValue = "[Function]";
	} else if (field.defaultValue === undefined && field.options.default !== undefined) {
		if (typeof field.options.default === "function") {
			safeField.defaultValue = "[Function]";
		} else {
			safeField.defaultValue = field.options.default;
		}
	} else {
		safeField.defaultValue = field.defaultValue;
	}

	if (field.instance === "Array" && field.caster) {
		safeField.arrayType = field.caster.instance;
		if (Array.isArray(safeField.defaultValue)) {
			safeField.defaultValue = JSON.stringify(safeField.defaultValue);
		}
	}
	if (field.instance === "Embedded" || field.instance === "DocumentArray") {
		safeField.schema = Object.keys(field.schema.paths).map((p: string) => ({
			path: p,
			type: field.schema.paths[p].instance,
		}));
	}

	return safeField;
}
