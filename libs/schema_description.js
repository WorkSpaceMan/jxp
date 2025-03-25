const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const getModelFileContents = (model_dir) => {
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
                        // Try to get the model from mongoose first
                        let modelobj;
                        try {
                            // Convert modelname to proper case for mongoose (first letter uppercase)
                            const modelKey = modelname.charAt(0).toUpperCase() + modelname.slice(1);
                            modelobj = mongoose.models[modelKey];

                            // If model doesn't exist in mongoose, try to load it from file
                            if (!modelobj) {
                                const filePath = path.join(model_dir, file);
                                delete require.cache[require.resolve(filePath)];
                                modelobj = require(filePath);
                            }
                        } catch (e) {
                            // If getting from mongoose fails, try loading from file
                            const filePath = path.join(model_dir, file);
                            delete require.cache[require.resolve(filePath)];
                            modelobj = require(filePath);
                        }

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
                        // Only add to errors if it's not an OverwriteModelError
                        if (!error.message.includes('Cannot overwrite')) {
                            errors.push(`Error with model ${modelname}: ${error.message}`);
                            console.error(`Error processing model ${modelname}:`, error);
                        }
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

module.exports = getModelFileContents;