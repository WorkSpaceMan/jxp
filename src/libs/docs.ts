import fs from "fs";
import path from "path";
import pug from "pug";
import yaml from "js-yaml";
import jstransformer from "jstransformer";
import jstransformerMarkdownIt from "jstransformer-markdown-it";
import util from "util";
import getModelFileContents = require("./schema_description");
import errors from "restify-errors";
import type { JXPConfig } from "../types/jxp-config";
import type { Model } from "mongoose";

const md = jstransformer(jstransformerMarkdownIt);
const readFile = util.promisify(fs.readFile);
const packageRoot = path.join(__dirname, "../..");

// Helper function to safely serialize schema fields
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const serializeField = (field: any) => {
    const safeField: Record<string, unknown> = {
        path: field.path,
        instance: field.instance,
        options: { ...field.options },
        validators: field.validators?.map(v => ({
            type: v.type?.name,
            message: v.message
        })),
        isRequired: field.isRequired
    };

    // Handle default value
    if (typeof field.defaultValue === 'function') {
        safeField.defaultValue = '[Function]';
    } else if (field.defaultValue === undefined && field.options.default !== undefined) {
        if (typeof field.options.default === 'function') {
            safeField.defaultValue = '[Function]';
        } else {
            safeField.defaultValue = field.options.default;
        }
    } else {
        safeField.defaultValue = field.defaultValue;
    }

    // Handle special cases for different field types
    if (field.instance === 'Array' && field.caster) {
        safeField.arrayType = field.caster.instance;
        // Handle array defaults specially
        if (Array.isArray(safeField.defaultValue)) {
            safeField.defaultValue = JSON.stringify(safeField.defaultValue);
        }
    }
    if (field.instance === 'Embedded' || field.instance === 'DocumentArray') {
        safeField.schema = Object.keys(field.schema.paths).map(p => ({
            path: p,
            type: field.schema.paths[p].instance
        }));
    }

    return safeField;
};

class Docs {
    config: JXPConfig;
    models: Record<string, Model<unknown>>;
    mkdocs: { nav?: unknown };
    package: { name: string; version: string };

    constructor(opts: { config: JXPConfig; models: Record<string, Model<unknown>> }) {
        this.config = Object.assign({}, opts.config);
        this.models = opts.models;
        this.mkdocs = yaml.load(fs.readFileSync(path.join(packageRoot, "mkdocs.yml"), "utf8")) as { nav?: unknown };
        this.package = require(path.join(process.cwd(), "package.json"));
    }

    renderTemplate(res: { writeHead: Function; write: Function; end: Function }, template_file: string, data: Record<string, unknown> = {}) {
        try {
            const template = pug.compileFile(path.join(packageRoot, `templates/${template_file}.pug`));
            data.title = data.title || `${this.package.name} API Documentation`;
            data.name = this.package.name;
            data.version = this.package.version;
            data.model_list = Object.keys(this.models);
            data.guide_nav = this.mkdocs.nav;
            const body = template(data);
            res.writeHead(200, {
                'Content-Length': Buffer.byteLength(body),
                'Content-Type': 'text/html'
            });
            res.write(body);
            res.end();
        } catch (err) {
            console.error(err);
            return new errors.InternalServerError(err.toString());
        }
    }

    async metaModels(req, res) {
        try {
            const models = await getModelFileContents(this.config.model_dir);
            res.send(models);
        } catch (err) {
            console.error(err);
            return new errors.InternalServerError(err.toString());
        }
    }

    metaModel(req, res, next) {
        try {
            if (!req.Model) {
                return new errors.NotFoundError("Model not found")
            }
            res.send(req.Model.schema.paths);
            next();
        } catch (err) {
            console.error(err);
            return new errors.InternalServerError(err.toString());
        }
    }

    dbDiagram(req, res, next) {
        try {
            res.send(this.models);
            next();
        } catch (err) {
            return new errors.InternalServerError(err.toString());
        }
    }

    frontPage(req, res, next) {
        try {
            this.renderTemplate(res, "index", {});
            next();
        } catch (err) {
            return new errors.InternalServerError(err.toString());
        }
    }

    async md(req, res) {
        try {
            const body = await readFile(path.join(packageRoot, "docs", req.params.md_doc));
            const md_contents = md.render(body.toString()).body;
            this.renderTemplate(res, "md", { md_contents });
        } catch (err) {
            return new errors.InternalServerError(err.toString());
        }
    }

    model(req, res, next) {
        try {
            const model = this.models[req.params.modelname];
            const fields = Object.keys(model.schema.paths);
            fields.sort();
            const perms = (model.schema as { opts?: { perms?: unknown } }).opts?.perms;

            // Prepare safe field data for template
            const safeFields = {};
            fields.forEach(fieldName => {
                safeFields[fieldName] = serializeField(model.schema.paths[fieldName]);
            });

            this.renderTemplate(res, "model", {
                model,
                fields,
                perms,
                safeFields
            });
            next();
        } catch (err) {
            console.error(err);
            return new errors.InternalServerError(err.toString());
        }
    }
}

module.exports = Docs;