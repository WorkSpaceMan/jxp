(function () {
	"use strict";

	const SYNC_CONFIRM = window.JXP_DIAG_SYNC_CONFIRM || "DROP_EXTRA_INDEXES";

	const REASON_LABELS = {
		collection_scan: "Collection scan",
		inefficient_index: "Inefficient index",
		collection_scan_below_threshold: "Collection scan (below threshold)",
	};

	function formatReason(reason) {
		if (!reason) return "—";
		return REASON_LABELS[reason] || reason.replace(/_/g, " ");
	}

	function formatScanStage(stage) {
		if (!stage) return "—";
		const hasCollScan = /\bCOLLSCAN\b/.test(stage);
		const cls = hasCollScan ? "text-danger fw-semibold" : "text-body-secondary";
		return `<code class="${cls}">${escapeHtml(stage)}</code>`;
	}

	function getApiKey() {
		const input = document.getElementById("docs-api-key");
		return input ? input.value.trim() : "";
	}

	function authHeaders() {
		const headers = { Accept: "application/json" };
		const key = getApiKey();
		if (key) headers["X-API-Key"] = key;
		return headers;
	}

	/** Same as api-console.js: docs login stores apikey in HttpOnly cookie; expose via /docs/session */
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
		} catch {
			/* ignore */
		}
	}

	function loadStoredKey() {
		if (localStorage.getItem("jxp_docs_remember_key") !== "1") return;
		const key = localStorage.getItem("jxp_docs_api_key");
		if (!key) return;
		const input = document.getElementById("docs-api-key");
		const remember = document.getElementById("docs-remember-key");
		if (input) input.value = key;
		if (remember) remember.checked = true;
	}

	async function ensureApiKey() {
		if (getApiKey()) return;
		await loadSessionApiKey();
		if (getApiKey()) return;
		loadStoredKey();
	}

	async function apiFetch(path, opts) {
		const res = await fetch(path, {
			...opts,
			credentials: "same-origin",
			headers: { ...authHeaders(), ...(opts && opts.headers) },
		});
		const text = await res.text();
		let body;
		try {
			body = text ? JSON.parse(text) : null;
		} catch {
			body = text;
		}
		if (!res.ok) {
			const msg =
				(body && body.message) ||
				(body && body.msg) ||
				(typeof body === "string" ? body : res.statusText);
			throw new Error(msg || `HTTP ${res.status}`);
		}
		return body;
	}

	function badgeClass(ok, kind) {
		if (ok) return "text-bg-success";
		if (kind === "missing") return "text-bg-warning";
		return "text-bg-danger";
	}

	function renderIndexes(data) {
		const table = document.getElementById("diag-indexes-table");
		const tbody = table.querySelector("tbody");
		const summary = document.getElementById("diag-indexes-summary");
		const status = document.getElementById("diag-indexes-status");

		if (!data || !data.collections) {
			status.textContent = "No audit data.";
			table.classList.add("d-none");
			return;
		}

		const s = data.summary || {};
		summary.innerHTML = `<span class="badge text-bg-secondary">${s.ok || 0}/${s.total || 0} OK</span>
      ${s.withMissing ? `<span class="badge text-bg-warning ms-1">${s.withMissing} missing</span>` : ""}
      ${s.withExtra ? `<span class="badge text-bg-danger ms-1">${s.withExtra} extra</span>` : ""}`;
		status.textContent = `Generated ${data.generatedAt || ""}`;

		tbody.innerHTML = "";
		for (const row of data.collections) {
			const tr = document.createElement("tr");
			const missing =
				row.missing && row.missing.length
					? row.missing.map((k) => JSON.stringify(k)).join(", ")
					: "—";
			const extra = row.extra && row.extra.length ? row.extra.join(", ") : "—";
			const statusLabel = row.error ? "error" : row.ok ? "ok" : "drift";
			tr.innerHTML = `
        <td><code>${escapeHtml(row.modelName)}</code></td>
        <td class="text-muted small">${escapeHtml(row.collection)}</td>
        <td><span class="badge ${badgeClass(row.ok && !row.error)}">${statusLabel}</span></td>
        <td class="small">${escapeHtml(missing)}</td>
        <td class="small">${escapeHtml(extra)}</td>`;
			tbody.appendChild(tr);
		}
		table.classList.remove("d-none");
	}

	function renderMonitorHelp(monitorStatus) {
		const help = document.getElementById("diag-query-monitor-help");
		const controls = document.querySelector("#tab-queries .d-flex.flex-wrap.gap-2.mb-3");
		if (!help) return;

		if (!monitorStatus || monitorStatus.active) {
			help.classList.add("d-none");
			help.innerHTML = "";
			if (controls) controls.classList.remove("opacity-50");
			return;
		}

		if (controls) controls.classList.add("opacity-50");

		const hints = (monitorStatus.env_hints || [])
			.map(
				(h) =>
					`<li><code>${escapeHtml(h.name)}=${escapeHtml(h.value)}</code>${h.comment ? ` <span class="text-muted">— ${escapeHtml(h.comment)}</span>` : ""}</li>`
			)
			.join("");

		const prodNote = monitorStatus.is_production
			? '<p class="mb-2 small">In <strong>production</strong>, query monitoring is off unless <code>INDEX_DIAGNOSTICS_ENABLED=true</code>. Use a low sample rate to limit overhead.</p>'
			: '<p class="mb-2 small">In development, monitoring is on by default. If you disabled it, set the variables below and restart the API.</p>';

		const envDebug = monitorStatus.env
			? `<p class="mb-2 small text-muted">Process env: <code>QUERY_INDEX_MONITOR=${escapeHtml(monitorStatus.env.QUERY_INDEX_MONITOR ?? "(unset)")}</code>, <code>INDEX_DIAGNOSTICS_ENABLED=${escapeHtml(monitorStatus.env.INDEX_DIAGNOSTICS_ENABLED ?? "(unset)")}</code>, <code>NODE_ENV=${escapeHtml(monitorStatus.env.NODE_ENV ?? "(unset)")}</code></p>`
			: "";

		const regNote = monitorStatus.registration_missing
			? '<p class="mb-2 small"><strong>Your .env has monitoring enabled</strong>, but this server never called <code>registerQueryIndexMonitor()</code> before loading models. Restart the API after upgrading <code>jxp</code> (recent versions register automatically inside <code>JXP()</code>).</p>'
			: "";

		help.className = "alert alert-info mb-3";
		help.innerHTML = `
      <h2 class="h6 alert-heading mb-2">Query monitoring is disabled</h2>
      <p class="mb-2 small">The API is not sampling read queries or running <code>explain('executionStats')</code>. Historical rows may still appear below if logging was on earlier.</p>
      ${regNote}
      ${envDebug}
      ${prodNote}
      <p class="mb-1 small fw-semibold">Enable via environment (.env)</p>
      <ol class="small mb-2">
        <li>Add to your <code>.env</code> (then restart the server):</li>
      </ol>
      <ul class="small mb-2">${hints}</ul>
      <p class="mb-1 small fw-semibold">Or in code (<code>JXP(apiconfig)</code>)</p>
      <pre class="small bg-body-secondary p-2 rounded mb-2"><code>index_diagnostics: {
  enabled: true,
  query_monitor: {
    enabled: true,
    sample_rate: ${monitorStatus.is_production ? "0.02" : "1.0"}
  }
}</code></pre>
      <p class="mb-0 small text-muted">Monitoring is registered at startup in <code>server.ts</code> via <code>registerQueryIndexMonitor()</code> before models load — a restart is required after changing config. See <a href="/docs/md/index_diagnostics.md">Index diagnostics</a>.</p>`;
	}

	function renderQueries(data) {
		const table = document.getElementById("diag-queries-table");
		const tbody = table.querySelector("tbody");
		const status = document.getElementById("diag-queries-status");
		const configEl = document.getElementById("diag-monitor-config");
		const monitorStatus = data?.monitor_status;

		renderMonitorHelp(monitorStatus);

		if (!data) {
			status.textContent = "No query log data.";
			table.classList.add("d-none");
			return;
		}

		const cfg = data.config;
		if (monitorStatus?.active && cfg) {
			configEl.innerHTML = `Monitor active: <code>sample_rate=${cfg.sample_rate}</code>,
        <code>min_docs=${cfg.min_docs_examined}</code>
        ${data.persisted ? '<span class="badge text-bg-success ms-1">MongoDB</span>' : '<span class="badge text-bg-secondary ms-1">memory buffer</span>'}`;
		} else {
			configEl.innerHTML =
				'<span class="badge text-bg-secondary">Query monitor off</span> <span class="text-muted">— enable using the steps above</span>';
		}

		const entries = data.entries || [];
		const total = data.total != null ? data.total : entries.length;
		if (monitorStatus?.active) {
			status.textContent = `${entries.length} shown${data.persisted ? ` of ${total} stored` : " (in-memory)"}`;
		} else if (entries.length) {
			status.textContent = `${entries.length} historical entries (monitoring currently off)`;
		} else {
			status.textContent = "No entries yet — enable monitoring above, then run API read traffic.";
		}

		tbody.innerHTML = "";
		for (const e of entries) {
			const tr = document.createElement("tr");
			const sev = e.severity === "alert" ? "danger" : "warning";
			tr.innerHTML = `
        <td class="small text-nowrap">${escapeHtml(e.at || "")}</td>
        <td><code>${escapeHtml(e.model)}</code></td>
        <td>${escapeHtml(e.op)}</td>
        <td><span class="badge text-bg-${sev}">${escapeHtml(e.severity)}</span></td>
        <td>${e.totalDocsExamined ?? "—"}</td>
        <td>${e.nReturned ?? "—"}</td>
        <td class="small">${formatScanStage(e.stage)}</td>
        <td class="small">${escapeHtml(formatReason(e.reason))}</td>
        <td class="small font-monospace">${escapeHtml(e.filterSummary || "")}</td>`;
			tbody.appendChild(tr);
		}
		table.classList.toggle("d-none", entries.length === 0);
	}

	function escapeHtml(s) {
		return String(s)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	async function loadIndexes(refresh) {
		const status = document.getElementById("diag-indexes-status");
		const unused = document.getElementById("diag-unused").checked;
		status.textContent = "Loading…";
		try {
			const q = new URLSearchParams();
			if (refresh) q.set("refresh", "1");
			if (unused) q.set("unused", "1");
			const data = await apiFetch(`/diagnostics/indexes?${q}`);
			renderIndexes(data);
		} catch (err) {
			status.textContent = `Error: ${err.message}`;
		}
	}

	async function loadQueries() {
		const status = document.getElementById("diag-queries-status");
		const severity = document.getElementById("diag-query-severity").value;
		const model = document.getElementById("diag-query-model").value.trim();
		status.textContent = "Loading…";
		try {
			const q = new URLSearchParams({ limit: "100" });
			if (severity) q.set("severity", severity);
			if (model) q.set("model", model);
			const data = await apiFetch(`/diagnostics/queries?${q}`);
			renderQueries(data);
		} catch (err) {
			status.textContent = `Error: ${err.message} (admin API key required)`;
		}
	}

	async function syncIndexes() {
		const confirmInput = document.getElementById("diag-sync-confirm");
		const status = document.getElementById("diag-indexes-status");
		if (confirmInput.value.trim() !== SYNC_CONFIRM) {
			status.textContent = `Type ${SYNC_CONFIRM} to confirm sync.`;
			return;
		}
		status.textContent = "Syncing…";
		try {
			await apiFetch("/diagnostics/indexes/sync", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ confirm: SYNC_CONFIRM }),
			});
			status.textContent = "Sync complete. Refreshing audit…";
			confirmInput.value = "";
			await loadIndexes(true);
		} catch (err) {
			status.textContent = `Sync failed: ${err.message}`;
		}
	}

	function wireModelFilter() {
		const input = document.getElementById("diag-query-model");
		if (!input) return;
		let debounceTimer;
		input.addEventListener("change", loadQueries);
		input.addEventListener("input", () => {
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(loadQueries, 350);
		});
	}

	function wireSyncConfirm() {
		const input = document.getElementById("diag-sync-confirm");
		const btn = document.getElementById("diag-sync-btn");
		if (!input || !btn) return;
		input.addEventListener("input", () => {
			btn.disabled = input.value.trim() !== SYNC_CONFIRM;
		});
		btn.addEventListener("click", syncIndexes);
	}

	document.addEventListener("DOMContentLoaded", async () => {
		document.getElementById("diag-refresh-indexes")?.addEventListener("click", () => loadIndexes(true));
		document.getElementById("diag-refresh-queries")?.addEventListener("click", loadQueries);
		document.getElementById("diag-query-severity")?.addEventListener("change", loadQueries);
		wireModelFilter();
		wireSyncConfirm();

		const access = document.documentElement.dataset.docsAccess;
		await loadSessionApiKey();
		if (access !== "protected") loadStoredKey();
		if (!getApiKey()) {
			const status = document.getElementById("diag-indexes-status");
			if (status) {
				status.textContent =
					"Set an admin API key in the top bar (or sign in again via /docs/login).";
			}
			return;
		}
		loadIndexes(false);

		document.getElementById("tab-queries-btn")?.addEventListener("shown.bs.tab", () => {
			if (getApiKey()) loadQueries();
		});
	});
})();
