const path = require("path");
const fs = require("fs");
const { expect } = require("chai");
const {
	buildMcpInstructions,
	buildMcpGuideMarkdown,
	loadGuideFiles,
	clearMcpGuideCache,
	MCP_GUIDE_URI,
} = require("../dist/libs/mcp/guides");
const { getMcpConfig } = require("../dist/libs/mcp/config");

describe("mcp guides", () => {
	const prev = { ...process.env };
	const fixtureGuide = path.join(__dirname, "fixtures/mcp-app-guide.md");

	afterEach(() => {
		process.env = { ...prev };
		clearMcpGuideCache();
	});

	it("buildMcpInstructions includes workflow keywords", () => {
		const mcpConfig = getMcpConfig();
		const text = buildMcpInstructions({ config: {}, mcpConfig });
		expect(text).to.include("jxp_list_models");
		expect(text).to.include("jxp-guide");
		expect(text).to.include(String(mcpConfig.defaultLimit));
	});

	it("appends config.mcp.instructions and MCP_INSTRUCTIONS_APPEND", () => {
		const mcpConfig = getMcpConfig();
		process.env.MCP_INSTRUCTIONS_APPEND = "ENV_APPEND_MARKER";
		clearMcpGuideCache();
		const text = buildMcpInstructions({
			config: { mcp: { instructions: "APP_INSTRUCTIONS_MARKER" } },
			mcpConfig,
		});
		expect(text).to.include("APP_INSTRUCTIONS_MARKER");
		expect(text).to.include("ENV_APPEND_MARKER");
	});

	it("merges default guide and MCP_GUIDE_FILES in order", () => {
		process.env.MCP_GUIDE_FILES = fixtureGuide;
		clearMcpGuideCache();
		const mcpConfig = getMcpConfig();
		const md = buildMcpGuideMarkdown({ config: {}, mcpConfig });
		expect(md).to.include("JXP MCP usage guide");
		expect(md).to.include("TEST_APP_GUIDE_MARKER");
		expect(md).to.include("Runtime limits");
	});

	it("loadGuideFiles warns on missing files without throwing", () => {
		const parts = loadGuideFiles(["./does-not-exist-mcp-guide.md"]);
		expect(parts.length).to.be.at.least(1);
		expect(parts[0]).to.include("JXP MCP usage guide");
	});

	it("exports stable guide URI", () => {
		expect(MCP_GUIDE_URI).to.eql("jxp://guide");
	});
});
