# TypeScript (v4)

JXP 4 is written in TypeScript and published as compiled JavaScript plus `.d.ts` declaration files.

## Building from source

```bash
git clone https://github.com/WorkSpaceMan/jxp.git
cd jxp
npm install --legacy-peer-deps
npm run build   # compiles src/ → dist/
npm test        # build + mocha (requires MongoDB for integration tests)
npm start       # runs dist/bin/server.js
```

During development:

```bash
npm run dev     # rebuild on src/ changes and restart the sample server
```

## Consuming JXP from JavaScript

No changes are required for existing `*_model.js` apps:

```javascript
/* global JXPSchema ObjectId Mixed */
const MySchema = new JXPSchema({ name: String }, { perms: { admin: "crud", all: "r" } });
module.exports = JXPSchema.model("MyModel", MySchema);
```

`require("jxp")` resolves to the compiled entry at `dist/libs/jxp.js`.

Deep imports remain supported, e.g. `require("jxp/libs/query_manipulation")`.

## Editor types for JS models

Add a dev dependency on `jxp@^4` and reference globals in model files:

```javascript
/// <reference types="jxp/globals" />
/* global JXPSchema ObjectId Mixed */
```

## Authoring models in TypeScript

```typescript
import JXPSchema from "jxp/libs/schema"; // or relative path when in-repo
import type { Types } from "mongoose";

export interface IWidget {
  _id?: Types.ObjectId;
  name?: string;
}

const WidgetSchema = new JXPSchema(
  { name: String },
  { perms: { admin: "crud", all: "r" } }
);

const Widget = JXPSchema.model<IWidget>("Widget", WidgetSchema);
export default Widget;
```

Compile app models to `*_model.js` in your `model_dir`, or extend the loader in a future release to accept `_model.ts` directly.

## Built-in document types

JXP ships typed built-in models (import from your compiled `dist/models` path when developing JXP itself):

| Model | Interface |
|-------|-----------|
| User | `IUser` |
| Token | `IToken` |
| RefreshToken | `IRefreshToken` |
| APIKey | `IAPIKey` |
| Usergroup | `IUserGroup` |
| Link | `ILink` |
| Test | `ITest` |

## Breaking changes in v4

- **Published package** — npm installs ship prebuilt `dist/` (not `src/`). Building from source (`npm run build`) is only required when developing from a git clone.
- **Entry point** — `main` is `dist/libs/jxp.js`; `types` points to matching `.d.ts`.
- **Node** — requires Node.js 22+.
- **Relative `model_dir`** — resolved from `process.cwd()` (typical for npm scripts), not from the server script path.
