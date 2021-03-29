/* global ObjectId */

// Our general requirements
const mongoose = require('mongoose');
const path = require("path");
const config = require("config");
const JXPHelper = require('jxp-helper');
const modeldir = require("./modeldir");

// Set up our jxp-helper so that we call call the API from within the API (if we've set config.apikey)
const jxp_settings = {};
if (config.apikey) jxp_settings.apikey = config.apikey;
if (config.server) jxp_settings.server = config.server;
if (jxp_settings.apikey && jxp_settings.server) global.jxphelper = new JXPHelper(jxp_settings);


// Set some global types
global.ObjectId = mongoose.Schema.Types.ObjectId;
global.Mixed = mongoose.Schema.Types.Mixed;
// Add this to the top of your model to avoid eslint warnings: /* global ObjectId Mixed */

const model_dir = config.model_dir || modeldir.findModelDir(path.dirname(process.argv[1]));

const getModelFileFromRef = ref => {
    return path.join(model_dir, `${String(ref).toLowerCase()}_model`);
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
            _deleted: { type: Boolean, default: false, index: true },
            _owner_id: { type: ObjectId, link: "User", map_to: "_owner", index: true },
            _updated_by_id: { type: ObjectId, link: "User", map_to: "_updated_by", index: true },
        }, definition);
        // construct our parent
        super(definition, opts);
        // Some properties
        this.opts = opts;
        this.definition = definition;
        // Action!
        this.index({ createdAt: -1 });
        this.index({ updatedAt: -1 });
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
        let loaded_files = [];
        // Find the links in our definitions and create virtuals for non-destructive populating
        // Example: link_id: { type: ObjectId, link: "link", }
        // Example with a custom key: link_id: { type: ObjectId, link: "link", map_to: "custom_name" }
        for (let key of Object.keys(this.definition)) {
            let def = this.definition[key];
            let is_array = false;
            if (def[0]) {
                def = def[0];
                is_array = true;
            }
            if (!def.link) continue;
            const virtual_name = def.map_to || def.virtual || String(def.link).toLowerCase();
            if (!loaded_files.includes(def.link)) {
                require(getModelFileFromRef(def.link));
                loaded_files.push(def.link);
            }
            this.virtual(virtual_name, {
                ref: def.link,
                localField: key,
                foreignField: "_id",
                justOne: def.justOne || !is_array,
                options: Object.assign({}, def.options)
            })
        }
    }
}

// Now we don't even need to import mongoose into our models for type
Schema.Types = mongoose.Schema.Types;

// Slightly self-referential, try not to think about it
Schema.model = mongoose.model;

module.exports = Schema;