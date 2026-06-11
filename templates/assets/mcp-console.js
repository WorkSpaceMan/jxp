(function () {
	"use strict";

	const STORAGE_KEY = "jxp_docs_api_key";
	const STORAGE_REMEMBER = "jxp_docs_remember_key";

	function getApiKey() {
		const input = document.getElementById("docs-api-key");
		return input ? input.value.trim() : "";
	}

	function loadStoredKey() {
		if (localStorage.getItem(STORAGE_REMEMBER) !== "1") return;
		const key = localStorage.getItem(STORAGE_KEY);
		if (!key) return;
		const input = document.getElementById("docs-api-key");
		const remember = document.getElementById("docs-remember-key");
		if (input) input.value = key;
		if (remember) remember.checked = true;
	}

	function saveKeyIfRemembered() {
		const remember = document.getElementById("docs-remember-key");
		const input = document.getElementById("docs-api-key");
		if (!remember || !input) return;
		if (remember.checked) {
			localStorage.setItem(STORAGE_REMEMBER, "1");
			localStorage.setItem(STORAGE_KEY, input.value.trim());
		} else {
			localStorage.removeItem(STORAGE_REMEMBER);
			localStorage.removeItem(STORAGE_KEY);
		}
		updateMcpConfigSnippets();
	}

	function getMcpSetup() {
		const card = document.querySelector(".mcp-setup-card");
		const fromWindow = window.__MCP_SETUP__ || {};
		const baseUrl =
			fromWindow.baseUrl ||
			card?.dataset.baseUrl ||
			window.location.origin;
		const mcpPath = fromWindow.mcpPath || card?.dataset.mcpPath || "/mcp";
		const base = String(baseUrl).replace(/\/$/, "");
		const path = mcpPath.startsWith("/") ? mcpPath : `/${mcpPath}`;
		const mcpUrl = fromWindow.mcpUrl || card?.dataset.mcpUrl || `${base}${path}`;
		return {
			baseUrl: base,
			mcpUrl,
			serverSlug: fromWindow.serverSlug || card?.dataset.serverSlug || "jxp",
		};
	}

	function buildMcpJsonConfig(kind, apiKey) {
		const setup = getMcpSetup();
		const key = apiKey || "YOUR_API_KEY";
		const slug = setup.serverSlug || "jxp";
		if (kind === "stdio") {
			return JSON.stringify(
				{
					mcpServers: {
						[slug]: {
							command: "npx",
							args: ["-y", "jxp-mcp"],
							env: {
								JXP_URL: setup.baseUrl,
								JXP_API_KEY: key,
							},
						},
					},
				},
				null,
				2
			);
		}
		return JSON.stringify(
			{
				mcpServers: {
					[slug]: {
						url: setup.mcpUrl,
						headers: { "X-API-Key": key },
					},
				},
			},
			null,
			2
		);
	}

	function updateMcpConfigSnippets() {
		const apiKey = getApiKey();
		const httpEl = document.getElementById("mcpJsonHttp");
		const stdioEl = document.getElementById("mcpJsonStdio");
		if (httpEl) httpEl.textContent = buildMcpJsonConfig("http", apiKey);
		if (stdioEl) stdioEl.textContent = buildMcpJsonConfig("stdio", apiKey);
	}

	async function copyMcpConfig(targetId, btn) {
		const el = document.getElementById(targetId);
		if (!el) return;
		try {
			await navigator.clipboard.writeText(el.textContent || "");
			const label = btn.innerHTML;
			btn.innerHTML = '<i class="bi bi-check2 me-1"></i>Copied';
			setTimeout(function () {
				btn.innerHTML = label;
			}, 1500);
		} catch {
			/* ignore */
		}
	}

	function escapeHtml(text) {
		return String(text)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	function formatBody(text) {
		if (!text) return "";
		try {
			return JSON.stringify(JSON.parse(text), null, 2);
		} catch {
			return text;
		}
	}

	function appendMessage(thread, role, bodyHtml, isError) {
		const wrap = document.createElement("div");
		wrap.className = "mcp-msg mcp-msg-" + role + (isError ? " mcp-msg-error" : "");
		const label = document.createElement("div");
		label.className = "mcp-msg-label";
		label.textContent = role === "user" ? "You" : "Assistant";
		const body = document.createElement("div");
		body.className = "mcp-msg-body";
		body.innerHTML = bodyHtml;
		wrap.appendChild(label);
		wrap.appendChild(body);
		thread.appendChild(wrap);
		thread.scrollTop = thread.scrollHeight;
	}

	function appendToolNote(thread, toolName, args) {
		const argsText = Object.keys(args).length ? JSON.stringify(args) : "{}";
		appendMessage(
			thread,
			"user",
			`<p class="mb-0"><code>${escapeHtml(toolName)}</code> <span class="text-muted">${escapeHtml(argsText)}</span></p>`,
			false
		);
	}

	function appendResult(thread, text, isError) {
		const formatted = escapeHtml(formatBody(text));
		appendMessage(thread, "bot", `<pre class="mcp-result mb-0">${formatted}</pre>`, isError);
	}

	async function callMcpTool(name, args) {
		const headers = { "Content-Type": "application/json", Accept: "application/json" };
		const apiKey = getApiKey();
		if (apiKey) headers["X-API-Key"] = apiKey;

		const res = await fetch("/docs/mcp/call", {
			method: "POST",
			credentials: "same-origin",
			headers,
			body: JSON.stringify({ name, arguments: args }),
		});
		const payload = await res.json().catch(() => ({ text: res.statusText, isError: true }));
		if (!res.ok) {
			const msg = payload.message || payload.text || res.statusText;
			throw new Error(msg);
		}
		return payload;
	}

	async function runTool(thread, name, args) {
		appendToolNote(thread, name, args);
		try {
			const result = await callMcpTool(name, args);
			appendResult(thread, result.text || "", !!result.isError);
		} catch (err) {
			appendResult(thread, String(err.message || err), true);
		}
	}

	function parseLimit(text) {
		const match = text.match(/\blimit\s*=\s*(\d+)/i);
		return match ? parseInt(match[1], 10) : 5;
	}

	function parseCommand(input) {
		const text = input.trim();
		if (!text) return null;

		const lower = text.toLowerCase();
		if (lower === "help" || lower === "?") {
			return {
				help: true,
				html:
					"<p>Commands:</p><ul class=\"mb-0\"><li><code>list models</code></li>" +
					"<li><code>describe MODEL</code></li><li><code>count MODEL</code></li>" +
					"<li><code>find MODEL</code> or <code>find MODEL limit=10</code></li></ul>",
			};
		}

		if (/^list\s+models?$/i.test(text)) {
			return { tool: "jxp_list_models", args: {} };
		}

		const describeMatch = text.match(/^describe\s+(\S+)/i);
		if (describeMatch) {
			return { tool: "jxp_describe_model", args: { model: describeMatch[1] } };
		}

		const countMatch = text.match(/^count\s+(\S+)/i);
		if (countMatch) {
			return { tool: "jxp_count", args: { model: countMatch[1] } };
		}

		const findMatch = text.match(/^find\s+(\S+)/i);
		if (findMatch) {
			return {
				tool: "jxp_find",
				args: { model: findMatch[1], limit: parseLimit(text) },
			};
		}

		return {
			error:
				"I didn't understand that. Try <code>list models</code>, <code>describe MODEL</code>, " +
				"<code>count MODEL</code>, or <code>find MODEL limit=5</code>. Type <code>help</code> for more.",
		};
	}

	async function handleUserInput(thread, input) {
		const text = input.trim();
		if (!text) return;

		appendMessage(thread, "user", `<p class="mb-0">${escapeHtml(text)}</p>`, false);

		const parsed = parseCommand(text);
		if (!parsed) return;

		if (parsed.help) {
			appendMessage(thread, "bot", parsed.html, false);
			return;
		}
		if (parsed.error) {
			appendMessage(thread, "bot", `<p class="mb-0">${parsed.error}</p>`, true);
			return;
		}

		await runTool(thread, parsed.tool, parsed.args);
	}

	async function loadSessionApiKey() {
		const access = document.documentElement.dataset.docsAccess;
		if (access !== "protected") return;
		try {
			const res = await fetch("/docs/session", { credentials: "same-origin" });
			if (!res.ok) return;
			const data = await res.json();
			if (!data.apikey) return;
			const input = document.getElementById("docs-api-key");
			if (input) input.value = data.apikey;
			updateMcpConfigSnippets();
		} catch {
			/* ignore */
		}
	}

	document.addEventListener("DOMContentLoaded", function () {
		const access = document.documentElement.dataset.docsAccess;
		const thread = document.getElementById("mcpChatThread");
		const form = document.getElementById("mcpChatForm");
		const chatInput = document.getElementById("mcpChatInput");
		const toolSelect = document.getElementById("mcpToolSelect");
		const toolArgs = document.getElementById("mcpToolArgs");
		const toolRun = document.getElementById("mcpToolRun");

		if (!thread) return;

		loadSessionApiKey().then(function () {
			if (access !== "protected") loadStoredKey();
			updateMcpConfigSnippets();
		});

		const keyInput = document.getElementById("docs-api-key");
		const remember = document.getElementById("docs-remember-key");
		if (keyInput) {
			keyInput.addEventListener("change", saveKeyIfRemembered);
			keyInput.addEventListener("input", updateMcpConfigSnippets);
		}
		if (remember) remember.addEventListener("change", saveKeyIfRemembered);

		document.querySelectorAll(".mcp-copy-btn").forEach(function (btn) {
			btn.addEventListener("click", function () {
				const target = btn.getAttribute("data-target");
				if (target) copyMcpConfig(target, btn);
			});
		});

		if (form && chatInput) {
			form.addEventListener("submit", function (e) {
				e.preventDefault();
				saveKeyIfRemembered();
				const value = chatInput.value;
				chatInput.value = "";
				handleUserInput(thread, value);
			});
		}

		document.querySelectorAll(".mcp-quick-btn").forEach(function (btn) {
			btn.addEventListener("click", function () {
				saveKeyIfRemembered();
				const cmd = btn.getAttribute("data-cmd") || "";
				if (chatInput) chatInput.value = cmd;
				handleUserInput(thread, cmd);
				if (chatInput) chatInput.value = "";
			});
		});

		if (toolRun && toolSelect && toolArgs) {
			toolRun.addEventListener("click", function () {
				saveKeyIfRemembered();
				let args = {};
				const raw = toolArgs.value.trim();
				if (raw) {
					try {
						args = JSON.parse(raw);
					} catch (err) {
						appendResult(thread, "Invalid JSON arguments: " + err.message, true);
						return;
					}
				}
				runTool(thread, toolSelect.value, args);
			});
		}
	});
})();
