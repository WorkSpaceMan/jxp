const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

type ModelRegistry = Record<string, {
    modelName?: string;
    schema?: { get(name: string): unknown };
}>;

function normalizeModelName(name: string): string {
    return name.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function resolveLoadedModel(modelname: string, filePath: string, models: ModelRegistry) {
    if (models[modelname]) return models[modelname];

    const cached = require.cache[require.resolve(filePath)]?.exports;
    if (cached) return cached.default || cached;

    const normalized = normalizeModelName(modelname);
    const registered = Object.values(mongoose.models).find(
        (model: { modelName?: string }) =>
            model.modelName && normalizeModelName(model.modelName) === normalized
    );
    if (registered) return registered;

    // Model files are normally preloaded by JXP. This fallback supports callers
    // that use schema_description directly without mutating the module cache.
    const loaded = require(filePath);
    return loaded.default || loaded;
}

const getModelFileContents = (model_dir, registeredModels: ModelRegistry = {}) => {
    return new Promise((resolve, reject) => {
        try {
            fs.readdir(model_dir, function (err, files) {
                if (err) {
                    return reject(err);
                }

                // Filter for only model files first
                const modelFiles = files.filter(file =>
                    file.endsWith('_model.js') &&
                    fs.statSync(path.join(model_dir, file)).isFile()
                );

                // Limit number of files processed at once
                const MAX_FILES = 1000;
                if (modelFiles.length > MAX_FILES) {
                    return reject(new Error(`Too many model files (${modelFiles.length}). Maximum allowed is ${MAX_FILES}`));
                }

                let models = [];
                let errors = [];

                for (const file of modelFiles) {
                    const modelname = path.basename(file, ".js").replace("_model", "");
                    try {
                        const filePath = path.join(model_dir, file);
                        const modelobj = resolveLoadedModel(
                            modelname,
                            filePath,
                            registeredModels
                        );

                        // Check if we have a valid model with schema and permissions
                        if (modelobj && modelobj.schema) {
                            const perms = modelobj.schema.get("_perms");
                            if (perms && (perms.admin || perms.user || perms.owner || perms.all)) {
                                models.push({
                                    model: modelname,
                                    file: file,
                                    perms: perms
                                });
                                continue; // Skip error handling if successful
                            }
                        }

                        // If we get here, the model was loaded but didn't have proper schema/perms
                        errors.push(`Invalid model structure for ${modelname}`);

                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        errors.push(`Error with model ${modelname}: ${message}`);
                        console.error(`Error processing model ${modelname}:`, error);
                    }
                }

                // If we have errors but also some valid models, just log the errors
                if (errors.length > 0 && models.length > 0) {
                    console.warn('Some models failed to load:', errors);
                }

                // Return empty array if no models found, but don't treat it as an error
                return resolve(models);
            });
        } catch (err) {
            return reject(err);
        }
    });
}

export = getModelFileContents;