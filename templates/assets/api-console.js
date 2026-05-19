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
	}

	function formatBody(text) {
		if (!text) return "";
		try {
			return JSON.stringify(JSON.parse(text), null, 2);
		} catch {
			return text;
		}
	}

	function formatResponse(text) {
		if (!text) return "(empty)";
		try {
			return JSON.stringify(JSON.parse(text), null, 2);
		} catch {
			return text;
		}
	}

	async function sendRequest(panel) {
		const method = panel.dataset.method;
		const pathInput = panel.querySelector(".api-path-input");
		const bodyInput = panel.querySelector(".api-body-input");
		const responseEl = panel.querySelector(".api-response");
		const metaEl = panel.querySelector(".api-response-meta");
		const btn = panel.querySelector(".api-send-btn");

		const path = pathInput ? pathInput.value.trim() : panel.dataset.defaultPath;
		if (!path.startsWith("/")) {
			responseEl.textContent = "Path must start with /";
			responseEl.classList.remove("empty");
			return;
		}

		const headers = { Accept: "application/json" };
		const apiKey = getApiKey();
		if (apiKey) headers["X-API-Key"] = apiKey;

		const opts = { method, headers };
		if (bodyInput && (method === "POST" || method === "PUT")) {
			const raw = bodyInput.value.trim();
			if (raw) {
				headers["Content-Type"] = "application/json";
				opts.body = raw;
			}
		}

		btn.disabled = true;
		responseEl.textContent = "Sending…";
		responseEl.classList.remove("empty");
		metaEl.textContent = "";

		const start = performance.now();
		try {
			const res = await fetch(path, opts);
			const elapsed = Math.round(performance.now() - start);
			const text = await res.text();
			responseEl.textContent = formatResponse(text);
			metaEl.textContent = `HTTP ${res.status} ${res.statusText} · ${elapsed} ms`;
			metaEl.className = "api-response-meta " + (res.ok ? "text-success" : "text-danger");
		} catch (err) {
			responseEl.textContent = String(err.message || err);
			metaEl.textContent = "Request failed";
			metaEl.className = "api-response-meta text-danger";
		} finally {
			btn.disabled = false;
		}
	}

	function initPanel(panel) {
		const sendBtn = panel.querySelector(".api-send-btn");
		if (sendBtn) {
			sendBtn.addEventListener("click", function () {
				saveKeyIfRemembered();
				sendRequest(panel);
			});
		}
		const bodyInput = panel.querySelector(".api-body-input");
		if (bodyInput) {
			bodyInput.addEventListener("blur", function () {
				bodyInput.value = formatBody(bodyInput.value);
			});
		}
	}

	document.addEventListener("DOMContentLoaded", function () {
		loadStoredKey();

		const keyInput = document.getElementById("docs-api-key");
		const remember = document.getElementById("docs-remember-key");
		if (keyInput) {
			keyInput.addEventListener("change", saveKeyIfRemembered);
		}
		if (remember) {
			remember.addEventListener("change", saveKeyIfRemembered);
		}

		document.querySelectorAll(".api-try-panel").forEach(initPanel);
	});
})();
