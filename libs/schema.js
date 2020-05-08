const mongoose = require('mongoose');
const ObjectId = mongoose.Schema.Types.ObjectId;

const getModelFileFromRef = ref => {
    return `../models/${String(ref).toLowerCase()}_model`;
}

class Schema extends mongoose.Schema {
    constructor(definition, opts) {
        // Set default options
        opts = Object.assign({
            timestamps: true,
            toJSON: { virtuals: true },
            toObject: { virtuals: true }
        }, opts);
        // Set default defiitions
        definition = Object.assign({
            _deleted:{ type: Boolean, default: false, index: true },
            _owner_id: ObjectId,
        }, definition);
        // construct our parent
        super(definition, opts);
        // Some properties
        this.opts = opts;
        this.definition = definition;
        // Action!
        this.setPerms();
        this.generateLinks();
    }

    setPerms() {
        // Create the perms
        this.set("_perms", Object.assign({
            admin: "", // CRUD = Create, Retrieve, Update and Delete
            owner: "",
            user: "",
            all: "" // Unauthenticated users will be able to read from test, but that is all
        }, this.opts.perms));
    }

    generateLinks() {
        // Find the links in our definitions and create virtuals for non-destructive populating
        // Example: link_id: { type: ObjectId, link: "link", }
        // Example with a custom key: link_id: { type: ObjectId, link: "link", map_to: "custom_name" }
        for (let key of Object.keys(this.definition)) {
            const def = this.definition[key];
            if (!def.link) continue;
            const virtual_name = def.map_to || def.virtual || String(def.link).toLowerCase();
            const model = require(getModelFileFromRef(def.link));
            this.virtual(virtual_name, {
                ref: () => model,
                localField: key,
                foreignField: "_id",
                justOne: def.justOne || true,
                options: Object.assign({}, def.options)
            })
        }
    }
}

module.exports = Schema;