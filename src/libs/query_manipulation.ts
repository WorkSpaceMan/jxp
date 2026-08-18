const traverse = require("traverse");
const ObjectId = require("mongoose").Types.ObjectId;
const moment = require("moment");

const relative_date = (offset, offset_unit, startof_unit, endof_unit) => {
    const m = moment();
    if (offset) {
        offset = Number(offset);
        if (offset > 0) {
            if (offset_unit) {
                m.add(offset, offset_unit);
            } else {
                m.add(offset)
            }
        } else {
            if (offset_unit) {
                m.subtract(Math.abs(offset), offset_unit);
            } else {
                m.subtract(Math.abs(offset))
            }
        }
    }
    if (startof_unit) {
        m.startOf(startof_unit);
    }
    if (endof_unit) {
        m.endOf(endof_unit);
    }
    return m.toDate();
}

const fix_params = s => {
    return s.split(",").map(i => i.trim().replace(/\"/g, "")).map(i => (i === "null") ? null : i);
}

const convert_literal_object = val => {
    if (!val || typeof val !== "object" || Array.isArray(val)) return null;
    const keys = Object.keys(val);
    if (keys.length !== 1) return null;
    if (keys[0] === "$oid" && typeof val.$oid === "string") {
        return ObjectId(val.$oid);
    }
    if (keys[0] === "$date" && typeof val.$date === "string") {
        return new Date(val.$date);
    }
    return null;
}

const fix_query = query => {
    const cleaned = traverse(query).map(function (this: { update: (v: unknown, keep?: boolean) => void }, val: unknown) {
        const literal = convert_literal_object(val);
        if (literal) {
            this.update(literal, true);
            return;
        }
        // Only rewrite string leaves. Stringifying arrays (e.g. `$in: [ObjectId("…"), …]`)
        // matches the ObjectId regex on the first element and collapses `$in` to a scalar.
        if (typeof val !== "string") return;
        const date_parts = /^(new Date\(\")([\d\.\-\+zZT\:]*)(\"\))/g.exec(val);
        if (date_parts) {
            const newval = new Date(date_parts[2]);
            this.update(newval, true);
            return;
        }
        const objectid_parts = /^(ObjectId\(\")([a-zA-Z\d]*)(\"\))/g.exec(val);
        if (objectid_parts) {
            const newval = ObjectId(objectid_parts[2]);
            this.update(newval, true);
            return;
        }
        const startof_parts = /^(relative_date\()(.*)(\))/g.exec(val);
        if (startof_parts) {
            const params = fix_params(startof_parts[2]);
            const newval = relative_date.apply(null, params);
            this.update(newval, true);
        }
    })
    return cleaned;
}

export { fix_query };
