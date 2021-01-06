const fs = require("fs");
const path = require("path");
// const config = require("config");

class Docs {
    constructor(opts) {
        this.config = Object.assign({}, opts.config);
        this.models = opts.models;
    }

    async metaModels(req, res) {
        try {
            const models = await getModelFileContents(this.config.model_dir);
            res.send(models);
        } catch (err) {
            console.error(err);
            return res.send(500, { status: "error", error: err, message: err.toString() });
        }
    }

    metaModel(req, res) {
        try {
            res.send(req.Model.schema.paths);
        } catch (err) {
            console.error(err);
            return res.send(500, { status: "error", error: err, message: err.toString() });
        }
    }

    dbDiagram(req, res) {
        res.send("models");
    }
}

const getModelFileContents = (model_dir) => {
    return new Promise((resolve, reject) => {
        try {
            fs.readdir(model_dir, function(err, files) {
                if (err) {
                    return reject(err);
                }
                let models = [];
                for (file of files) {
                    const modelname = path.basename(file, ".js").replace("_model", "");
                    try {
                        const modelobj = require(path.join(model_dir, file));
                        if (
                            modelobj.schema &&
                            modelobj.schema.get("_perms") &&
                            (modelobj.schema.get("_perms").admin ||
                                modelobj.schema.get("_perms").user ||
                                modelobj.schema.get("_perms").owner ||
                                modelobj.schema.get("_perms").all)
                        ) {
                            let model = {
                                model: modelname,
                                file: file,
                                perms: modelobj.schema.get("_perms")
                            };
                            models.push(model);
                        }
                    } catch (error) {
                        console.error("Error with model " + modelname, error);
                    }
                }
                return resolve(models);
            });
        } catch(err) {
            return reject(err);
        }
    });
}

module.exports = Docs;