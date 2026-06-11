import type { Model } from "mongoose";
import { serializeField } from "../schema_serialize";

export interface ModelDescription {
	slug: string;
	collection: string;
	soft_delete: boolean;
	fields: Record<string, ReturnType<typeof serializeField>>;
	populate_hints: string[];
	filterable_fields: string[];
	notes: string[];
}

export function describeModelJson(slug: string, model: Model<unknown>): ModelDescription {
	const fields = Object.keys(model.schema.paths).sort();
	const safeFields: Record<string, ReturnType<typeof serializeField>> = {};
	const populateHints: string[] = [];
	const filterableFields: string[] = [];

	for (const fieldName of fields) {
		const path = model.schema.paths[fieldName];
		safeFields[fieldName] = serializeField(path);
		if (path.options?.index) {
			filterableFields.push(fieldName);
		}
		if (path.instance === "ObjectID" && path.options?.link) {
			const populateKey = String(
				path.options.map_to || path.options.virtual || path.options.link.toLowerCase()
			);
			populateHints.push(`populate[${fieldName}]=<fields>`);
			populateHints.push(`populate[${populateKey}]=<fields>`);
		}
	}

	return {
		slug,
		collection: model.collection.name,
		soft_delete: true,
		fields: safeFields,
		populate_hints: [...new Set(populateHints)],
		filterable_fields: filterableFields,
		notes: [
			"Use jxp_find with filter objects ($gte:, $regex:/pattern/i, etc.).",
			"Omit deleted documents by default; not applicable for single-id fetch of deleted rows.",
			"Prefer fields and low limit to keep responses small.",
		],
	};
}
