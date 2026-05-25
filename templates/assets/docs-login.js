(function () {
	"use strict";

	document.addEventListener("DOMContentLoaded", function () {
		const form = document.getElementById("docs-login-form");
		const errEl = document.getElementById("docs-login-error");
		if (!form || !errEl) return;

		form.addEventListener("submit", async function (e) {
			e.preventDefault();
			errEl.hidden = true;
			const email = form.email.value.trim();
			const password = form.password.value;
			const next =
				form.next && form.next.value && form.next.value.startsWith("/")
					? form.next.value
					: "/docs/api";

			try {
				const loginRes = await fetch("/login", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					body: JSON.stringify({ email, password }),
				});
				const loginBody = await loginRes.json().catch(function () {
					return {};
				});
				if (loginRes.status === 429) {
					errEl.textContent =
						"Too many login attempts. Please wait a minute and try again.";
					errEl.hidden = false;
					return;
				}
				if (!loginRes.ok || !loginBody.apikey) {
					errEl.textContent =
						loginBody.message || "Incorrect email or password";
					errEl.hidden = false;
					return;
				}

				const sessRes = await fetch("/docs/session", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					credentials: "same-origin",
					body: JSON.stringify({ apikey: loginBody.apikey }),
				});
				if (!sessRes.ok) {
					errEl.textContent = "Signed in but could not start docs session";
					errEl.hidden = false;
					return;
				}

				window.location.href = next;
			} catch {
				errEl.textContent = "Login request failed";
				errEl.hidden = false;
			}
		});
	});
})();
