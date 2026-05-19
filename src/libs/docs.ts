import fs from "fs";
import path from "path";
import pug from "pug";
import yaml from "js-yaml";
import MarkdownIt from "markdown-it";
import util from "util";

const md = new MarkdownIt();
// Required for templates/index.pug (`include:markdown-it ../docs/index.md`)
pug.filters["markdown-it"] = (text: string) => md.render(text);
import getModelFileContents = require("./schema_description");
import errors from "restify-errors";
import type { JXPConfig } from "../types/jxp-config";
import type { Model } from "mongoose";

const readFile = util.promisify(fs.readFile);
const packageRoot = path.join(__dirname, "../..");
const assetsDir = path.join(packageRoot, "templates", "assets");

const ASSET_TYPES: Record<string, string> = {
    css: "text/css; charset=utf-8",
    js: "application/javascript; charset=utf-8",
};

const LANDING_FEATURES = [
    { title: "Auth built in", description: "API keys, tokens, and password encryption without extra wiring." },
    { title: "Smart population", description: "Load linked documents with URL-driven populate parameters." },
    { title: "Powerful queries", description: "Search, sort, filter, field selection, and limits on GET requests." },
    { title: "Schema-driven", description: "Add or change models by editing Mongoose schemas — the API updates automatically." },
    { title: "Permissions", description: "Per-model CRUD rules by user group, owner, and admin." },
    { title: "Hooks & logic", description: "pre/post hooks and custom handlers for business rules." },
];

type EndpointDef = {
    method: string;
    path: string;
    description: string;
    hasBody?: boolean;
    queryHint?: string;
};

const buildEndpoints = (modelSlug: string): EndpointDef[] => {
    const base = `/api/${modelSlug}`;
    return [
        {
            method: "GET",
            path: base,
            description: "List documents in this collection.",
            queryHint: "Supports filter, search, populate, fields, sort, limit, skip — see REST reference.",
        },
        {
            method: "GET",
            path: `${base}/{id}`,
            description: "Get a single document by MongoDB _id.",
        },
        {
            method: "POST",
            path: base,
            description: "Create a new document.",
            hasBody: true,
        },
        {
            method: "PUT",
            path: `${base}/{id}`,
            description: "Update a document (partial updates supported).",
            hasBody: true,
        },
        {
            method: "DELETE",
            path: `${base}/{id}`,
            description: "Delete a document (soft-delete when configured).",
        },
    ];
};

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

    if (field.instance === 'Array' && field.caster) {
        safeField.arrayType = field.caster.instance;
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
    mkdocs: { nav?: { [key: string]: string }[] };
    package: { name: string; version: string };

    constructor(opts: { config: JXPConfig; models: Record<string, Model<unknown>> }) {
        this.config = Object.assign({}, opts.config);
        this.models = opts.models;
        this.mkdocs = yaml.load(fs.readFileSync(path.join(packageRoot, "mkdocs.yml"), "utf8")) as { nav?: { [key: string]: string }[] };
        this.package = require(path.join(process.cwd(), "package.json"));
    }

    getFirstGuideUrl(): string | null {
        const nav = this.mkdocs.nav;
        if (!nav || !nav.length) return null;
        const first = nav[0];
        const file = Object.values(first)[0];
        return `/docs/md/${file}`;
    }

    getBaseUrl(req: { headers?: { host?: string }; connection?: { encrypted?: boolean } }): string {
        const host = req.headers?.host || "localhost";
        const proto = req.connection?.encrypted ? "https" : "http";
        return `${proto}://${host}`;
    }

    renderTemplate(
        res: { writeHead: Function; write: Function; end: Function },
        template_file: string,
        data: Record<string, unknown> = {}
    ): void {
        const template = pug.compileFile(path.join(packageRoot, `templates/${template_file}.pug`));
        data.title = data.title || `${this.package.name} API Documentation`;
        data.name = this.package.name;
        data.version = this.package.version;
        data.model_list = Object.keys(this.models).sort();
        data.guide_nav = this.mkdocs.nav || [];
        data.active_section = data.active_section || "";
        data.active_guide = data.active_guide || "";
        data.active_model = data.active_model || "";
        data.first_guide_url = data.first_guide_url ?? this.getFirstGuideUrl();
        const body = template(data);
        res.writeHead(200, {
            'Content-Length': Buffer.byteLength(body),
            'Content-Type': 'text/html; charset=utf-8'
        });
        res.write(body);
        res.end();
    }

    serveAsset(req, res, next) {
        try {
            const file = req.params.file;
            if (!file || file.includes("..") || file.includes("/") || file.includes("\\")) {
                return next(new errors.NotFoundError("Asset not found"));
            }
            const ext = path.extname(file).slice(1).toLowerCase();
            if (!ASSET_TYPES[ext]) {
                return next(new errors.NotFoundError("Asset not found"));
            }
            const resolved = path.resolve(assetsDir, file);
            const relative = path.relative(assetsDir, resolved);
            if (relative.startsWith("..") || path.isAbsolute(relative)) {
                return next(new errors.NotFoundError("Asset not found"));
            }
            if (!fs.existsSync(resolved)) {
                return next(new errors.NotFoundError("Asset not found"));
            }
            const body = fs.readFileSync(resolved);
            res.writeHead(200, {
                'Content-Length': body.length,
                'Content-Type': ASSET_TYPES[ext],
                'Cache-Control': 'public, max-age=3600',
            });
            res.write(body);
            res.end();
        } catch (err) {
            console.error(err);
            return next(new errors.InternalServerError(err.toString()));
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
            this.renderTemplate(res, "index", {
                active_section: "home",
                features: LANDING_FEATURES,
                base_url: this.getBaseUrl(req),
            });
        } catch (err) {
            console.error(err);
            return next(new errors.InternalServerError(err.toString()));
        }
    }

    md(req, res, next) {
        try {
            const docFile = req.params.md_doc;
            if (!docFile || docFile.includes("..") || docFile.includes("/") || docFile.includes("\\")) {
                return next(new errors.NotFoundError("Document not found"));
            }
            const filePath = path.join(packageRoot, "docs", docFile);
            const body = fs.readFileSync(filePath, "utf8");
            const md_contents = md.render(body);
            const titleMatch = body.match(/^#\s+(.+)$/m);
            this.renderTemplate(res, "md", {
                md_contents,
                active_section: "guides",
                active_guide: docFile,
                title: titleMatch ? `${titleMatch[1]} · ${this.package.name}` : undefined,
            });
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") {
                return next(new errors.NotFoundError("Document not found"));
            }
            console.error(err);
            return next(new errors.InternalServerError(err.toString()));
        }
    }

    apiIndex(req, res, next) {
        try {
            const model_summaries = Object.keys(this.models).sort().map(slug => {
                const model = this.models[slug];
                const perms = (model.schema as { opts?: { perms?: Record<string, string> } }).opts?.perms;
                return {
                    slug,
                    collection: model.collection.name,
                    perms: perms || null,
                };
            });
            this.renderTemplate(res, "api", {
                active_section: "api",
                model_summaries,
                title: `API · ${this.package.name}`,
            });
        } catch (err) {
            console.error(err);
            return next(new errors.InternalServerError(err.toString()));
        }
    }

    model(req, res, next) {
        try {
            const model_slug = req.params.modelname;
            const model = this.models[model_slug];
            if (!model) {
                return next(new errors.NotFoundError(`Model ${model_slug} not found`));
            }
            const fields = Object.keys(model.schema.paths);
            fields.sort();
            const perms = (model.schema as { opts?: { perms?: unknown } }).opts?.perms;

            const safeFields: Record<string, ReturnType<typeof serializeField>> = {};
            fields.forEach(fieldName => {
                safeFields[fieldName] = serializeField(model.schema.paths[fieldName]);
            });

            this.renderTemplate(res, "model", {
                model,
                model_slug,
                collection_name: model.collection.name,
                fields,
                perms,
                safeFields,
                endpoints: buildEndpoints(model_slug),
                active_section: "api",
                active_model: model_slug,
                title: `${model_slug} · API · ${this.package.name}`,
            });
        } catch (err) {
            console.error(err);
            return next(new errors.InternalServerError(err.toString()));
        }
    }
}

module.exports = Docs;
