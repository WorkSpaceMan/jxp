export interface LinkReferrer {
	modelname: string;
	field: string;
}

const referrersByTarget: Record<string, LinkReferrer[]> = {};

export function buildLinkIndex(models: Record<string, { modelName?: string; schema: { definition: Record<string, { link?: string }> } }>): void {
	for (const key of Object.keys(referrersByTarget)) {
		delete referrersByTarget[key];
	}
	for (const link_modelname of Object.keys(models)) {
		const Model = models[link_modelname];
		const definition = Model.schema?.definition;
		if (!definition) continue;
		for (const link_definition of Object.keys(definition)) {
			const linkTarget = definition[link_definition]?.link;
			if (!linkTarget) continue;
			const targetName = String(linkTarget);
			if (!referrersByTarget[targetName]) {
				referrersByTarget[targetName] = [];
			}
			referrersByTarget[targetName].push({
				modelname: link_modelname,
				field: link_definition,
			});
		}
	}
}

export function getReferrers(targetModelName: string): LinkReferrer[] {
	return referrersByTarget[targetModelName] || [];
}

module.exports = {
	buildLinkIndex,
	getReferrers,
};
