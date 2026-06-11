const { expect } = require("chai");
const {
	getMcpConfig,
	overlayMcpQueryLimits,
	isMcpEnabled,
} = require("../dist/libs/mcp/config");
const {
	isDefaultHiddenModel,
	isBlacklisted,
	isVisibilityOverridden,
	canReadModel,
	isModelVisibleMcp,
} = require("../dist/libs/mcp/model_visibility");
const { BUILTIN_MODEL_SLUGS } = require("../dist/libs/builtin_models");

describe("mcp visibility", () => {
	const prev = { ...process.env };

	afterEach(() => {
		process.env = { ...prev };
	});

	it("is disabled by default", () => {
		delete process.env.MCP_ENABLED;
		expect(isMcpEnabled()).to.be.false;
	});

	it("parses whitelist and blacklist", () => {
		process.env.MCP_MODEL_WHITELIST = "user,Config";
		process.env.MCP_MODEL_BLACKLIST = "logs";
		const cfg = getMcpConfig();
		expect(cfg.modelWhitelist.has("user")).to.be.true;
		expect(cfg.modelWhitelist.has("config")).to.be.true;
		expect(cfg.modelBlacklist.has("logs")).to.be.true;
	});

	it("default-hides builtin slugs", () => {
		const cfg = getMcpConfig();
		for (const slug of BUILTIN_MODEL_SLUGS) {
			expect(cfg.defaultHiddenModels.has(slug)).to.be.true;
		}
	});

	it("whitelist overrides default hidden but not blacklist", () => {
		const cfg = getMcpConfig();
		cfg.modelWhitelist = new Set(["user"]);
		cfg.modelBlacklist = new Set(["user"]);
		const fakeModel = { schema: { opts: { internal: false } } };
		expect(isDefaultHiddenModel("user", fakeModel, cfg)).to.be.true;
		expect(isVisibilityOverridden("user", cfg)).to.be.true;
		expect(isBlacklisted("user", cfg)).to.be.true;
	});

	it("overlay MCP query limits", () => {
		process.env.MCP_DEFAULT_LIMIT = "15";
		process.env.MCP_MAX_LIMIT = "50";
		process.env.MCP_MAX_RESPONSE_SIZE = "128kb";
		const cfg = getMcpConfig();
		const merged = overlayMcpQueryLimits({ default: 100, max: 1000 }, cfg);
		expect(merged.default).to.eql(15);
		expect(merged.max).to.eql(50);
		expect(merged.max_response_size).to.eql(131072);
	});
});

describe("mcp visibility permissions", () => {
	it("all: r allows anonymous read", async () => {
		const model = {
			schema: {
				get: () => ({ admin: "crud", all: "r" }),
			},
		};
		const ok = await canReadModel({ user: null, groups: [] }, model);
		expect(ok).to.be.true;
	});

	it("hidden model not visible without whitelist", async () => {
		const cfg = getMcpConfig();
		const model = {
			collection: { name: "apikeys" },
			schema: {
				get: () => ({ admin: "crud", user: "r" }),
				opts: {},
			},
		};
		const auth = { user: { _id: "1", admin: true }, groups: [] };
		const visible = await isModelVisibleMcp("apikey", model, auth, cfg);
		expect(visible).to.be.false;
	});
});
