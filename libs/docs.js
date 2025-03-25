const fs = require("fs");
const path = require("path");
const pug = require("pug");
const yaml = require('js-yaml');
const md = require('jstransformer')(require('jstransformer-markdown-it'));
const util = require('util');
const readFile = util.promisify(fs.readFile);
const schema_description = require("./schema_description");
const errors = require("restify-errors");

// Helper function to safely serialize schema fields
const serializeField = (field) => {
    const safeField = {
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
    constructor(opts) {
        this.config = Object.assign({}, opts.config);
        this.models = opts.models;
        this.mkdocs = yaml.load(fs.readFileSync(path.join(__dirname, `../mkdocs.yml`), 'utf8'));
        this.package = require(path.join(process.cwd(), "package.json"));
    }

    renderTemplate(res, template_file, data = {}) {
        try {
            const template = pug.compileFile(path.join(__dirname, `../templates/${template_file}.pug`));
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
            const models = await schema_description(this.config.model_dir);
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
            const body = await readFile(path.join(__dirname, `../docs`, req.params.md_doc));
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
            const perms = model.schema.opts.perms;

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