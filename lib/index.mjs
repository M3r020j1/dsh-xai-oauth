import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
//#region src/journal.ts
/**
* Keeps only browser-safe authorization progress. In particular, answers are
* passed straight to the provider flow and are never retained or logged.
*/
var AuthorizationJournal = class {
	#state = "idle";
	#notices = [];
	#prompt;
	#pending;
	#sequence = 0;
	#error;
	start() {
		if (this.#state === "running") throw new Error("An authorization attempt is already running");
		this.#state = "running";
		this.#notices = [];
		this.#prompt = void 0;
		this.#pending = void 0;
		this.#error = void 0;
	}
	notify(notice) {
		if (this.#state !== "running") return;
		this.#notices.push({ ...notice });
	}
	prompt(prompt) {
		if (this.#state !== "running") return Promise.reject(/* @__PURE__ */ new Error("Authorization is not running"));
		if (this.#pending !== void 0) return Promise.reject(/* @__PURE__ */ new Error("The previous authorization prompt has not been answered"));
		const id = String(++this.#sequence);
		this.#prompt = {
			...prompt,
			id
		};
		return new Promise((resolve, reject) => {
			this.#pending = {
				id,
				resolve,
				reject
			};
			prompt.signal?.addEventListener("abort", () => {
				if (this.#pending?.id !== id) return;
				this.#pending = void 0;
				this.#prompt = void 0;
				reject(/* @__PURE__ */ new Error("Authorization prompt was withdrawn"));
			}, { once: true });
		});
	}
	answer(id, value) {
		const pending = this.#pending;
		if (pending === void 0 || pending.id !== id) throw new Error("Unknown or expired authorization prompt");
		this.#pending = void 0;
		this.#prompt = void 0;
		pending.resolve(value);
	}
	cancel() {
		this.#pending?.reject(/* @__PURE__ */ new Error("Authorization was cancelled"));
		this.#pending = void 0;
		this.#prompt = void 0;
	}
	reset() {
		this.#state = "idle";
		this.#notices = [];
		this.#prompt = void 0;
		this.#pending = void 0;
		this.#error = void 0;
	}
	settle(state, error) {
		this.#state = state;
		this.#error = error;
		this.#pending = void 0;
		this.#prompt = void 0;
	}
	snapshot() {
		return {
			state: this.#state,
			notices: this.#notices.map((notice) => ({ ...notice })),
			...this.#prompt === void 0 ? {} : { prompt: { ...this.#prompt } },
			...this.#error === void 0 ? {} : { error: this.#error }
		};
	}
};
//#endregion
//#region src/index.ts
const SERVICE_KEY = "dshXaiOauth";
const CREDENTIAL_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const XAI_CREDENTIAL_KEY = "llm-pi-ai/xai";
const XAI_API_KEY_REF = "XAI_API_KEY";
const name = "dsh-xai-oauth";
const inject = [
	"authorization",
	"connection",
	"credentials",
	"settings",
	"webServer"
];
function isCredentialRefName(value) {
	return CREDENTIAL_REF_PATTERN.test(value);
}
function credentialRef(value) {
	if (!isCredentialRefName(value)) throw new TypeError(`credential ref "${value}" must be a POSIX shell identifier`);
	return value;
}
var PublicError = class extends Error {
	constructor(code, message) {
		super(message);
		this.code = code;
	}
};
function xaiApiKeyEnv(ctx) {
	const value = ctx.settings.get("llm-pi-ai")?.providers?.xai?.apiKeyEnv;
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
function publicFailure(error, fallbackCode = "AUTHORIZATION_FAILED") {
	const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : fallbackCode;
	return {
		code,
		message: error instanceof Error && error.message.length > 0 ? error.message : typeof error === "string" && error.length > 0 ? error : code
	};
}
function requireEmptyPayload(payload) {
	if (payload === null || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).length > 0) throw new PublicError("INVALID_REQUEST", "This operation does not accept parameters");
}
async function statusPayload(ctx, journal) {
	const [record, defaultApiKey] = await Promise.all([ctx.credentials.describeRecord(XAI_CREDENTIAL_KEY), ctx.credentials.describe(XAI_API_KEY_REF)]);
	const apiKeyEnv = xaiApiKeyEnv(ctx);
	const configuredApiKey = apiKeyEnv === void 0 || apiKeyEnv === "XAI_API_KEY" ? defaultApiKey : await ctx.credentials.describe(credentialRef(apiKeyEnv));
	const flow = ctx.authorization.describe(XAI_CREDENTIAL_KEY);
	return {
		credential: "llm-pi-ai/xai",
		connected: record.configured && record.kind === "grant",
		...record.kind === void 0 ? {} : { credentialKind: record.kind },
		writable: {
			credential: record.writable,
			settings: ctx.settings.writable
		},
		apiKeyOverride: {
			active: apiKeyEnv !== void 0,
			configured: apiKeyEnv !== void 0 && configuredApiKey.configured,
			...apiKeyEnv === void 0 ? {} : { reference: apiKeyEnv },
			writable: configuredApiKey.writable
		},
		...flow === void 0 ? {} : { flow: {
			inFlight: flow.inFlight,
			oauthAvailable: flow.methods.some((method) => method.id === "oauth")
		} },
		attempt: journal.snapshot()
	};
}
async function removeApiKeyOverride(ctx) {
	const apiKeyEnv = xaiApiKeyEnv(ctx);
	if (apiKeyEnv === void 0) return;
	if (!ctx.settings.writable) throw new PublicError("SETTINGS_READ_ONLY", "The DSH settings store is read-only");
	await ctx.settings.mutate("llm-pi-ai", [{
		op: "unset",
		path: [
			"providers",
			"xai",
			"apiKeyEnv"
		]
	}]);
	const references = /* @__PURE__ */ new Set([apiKeyEnv, "XAI_API_KEY"]);
	for (const reference of references) {
		if (!isCredentialRefName(reference)) continue;
		const ref = credentialRef(reference);
		const info = await ctx.credentials.describe(ref);
		if (info.configured && info.writable) await ctx.credentials.unset(ref);
	}
}
function startAuthorization(ctx, journal) {
	const flow = ctx.authorization.describe(XAI_CREDENTIAL_KEY);
	if (flow === void 0 || !flow.methods.some((method) => method.id === "oauth")) throw new PublicError("OAUTH_UNAVAILABLE", "The xAI OAuth flow is not available");
	journal.start();
	ctx.authorization.begin({
		key: XAI_CREDENTIAL_KEY,
		method: "oauth",
		interaction: {
			notify: (notice) => journal.notify(notice),
			prompt: (prompt) => journal.prompt(prompt)
		}
	}).then((outcome) => journal.settle(outcome.status), (error) => {
		const failure = publicFailure(error);
		journal.settle(failure.code === "CANCELLED" ? "cancelled" : "failed", failure.message);
	});
}
var XaiOAuthService = class extends TypertRemoteService {
	static {
		this.inject = [
			"authorization",
			"connection",
			"credentials",
			"settings",
			"webServer"
		];
	}
	constructor(ctx) {
		super(ctx, SERVICE_KEY);
		this.journal = new AuthorizationJournal();
		this.ctx.effect(() => () => {
			this.journal.cancel();
			this.ctx.authorization.cancel(XAI_CREDENTIAL_KEY);
		}, "dsh-xai-oauth: cancel authorization on unload");
	}
	async status() {
		return statusPayload(this.ctx, this.journal);
	}
	async begin() {
		startAuthorization(this.ctx, this.journal);
		return { accepted: true };
	}
	async cancel() {
		this.journal.cancel();
		this.ctx.authorization.cancel(XAI_CREDENTIAL_KEY);
		return { cancelled: true };
	}
	async disconnect() {
		const record = await this.ctx.credentials.describeRecord(XAI_CREDENTIAL_KEY);
		this.journal.cancel();
		this.ctx.authorization.cancel(XAI_CREDENTIAL_KEY);
		if (record.configured && !record.writable) throw new PublicError("CREDENTIALS_READ_ONLY", "The xAI OAuth credential is read-only");
		if (record.configured) await this.ctx.credentials.deleteRecord(XAI_CREDENTIAL_KEY);
		this.journal.reset();
		return { disconnected: true };
	}
	async repairOauth() {
		await removeApiKeyOverride(this.ctx);
		return { repaired: true };
	}
};
const REMOTE_METHOD_DESCRIPTOR = "@deepseek-ai/dsh-typert-protocol/remote-methods";
function markRemoteMethods(serviceClass) {
	const prototype = serviceClass.prototype;
	const methods = Object.freeze([
		Object.freeze({
			method: "status",
			invocation: Object.freeze({ kind: "direct" })
		}),
		Object.freeze({
			method: "begin",
			invocation: Object.freeze({ kind: "direct" })
		}),
		Object.freeze({
			method: "cancel",
			invocation: Object.freeze({ kind: "direct" })
		}),
		Object.freeze({
			method: "disconnect",
			invocation: Object.freeze({ kind: "direct" })
		}),
		Object.freeze({
			method: "repairOauth",
			exportName: "repair-oauth",
			invocation: Object.freeze({ kind: "direct" })
		})
	]);
	Object.defineProperty(prototype, REMOTE_METHOD_DESCRIPTOR, {
		configurable: true,
		value: Object.freeze({
			version: 1,
			methods
		})
	});
}
markRemoteMethods(XaiOAuthService);
/** Keep the historical factory for unit tests of the OAuth business logic. */
function createXaiOAuthRpcHandler(ctx, journal = new AuthorizationJournal()) {
	return async (endpoint, payload, _signal) => {
		try {
			requireEmptyPayload(payload);
			switch (endpoint) {
				case "status": return {
					ok: true,
					value: await statusPayload(ctx, journal)
				};
				case "begin":
					startAuthorization(ctx, journal);
					return {
						ok: true,
						value: { accepted: true }
					};
				case "cancel":
					journal.cancel();
					ctx.authorization.cancel(XAI_CREDENTIAL_KEY);
					return {
						ok: true,
						value: { cancelled: true }
					};
				case "disconnect": {
					const record = await ctx.credentials.describeRecord(XAI_CREDENTIAL_KEY);
					journal.cancel();
					ctx.authorization.cancel(XAI_CREDENTIAL_KEY);
					if (record.configured && !record.writable) throw new PublicError("CREDENTIALS_READ_ONLY", "The xAI OAuth credential is read-only");
					if (record.configured) await ctx.credentials.deleteRecord(XAI_CREDENTIAL_KEY);
					journal.reset();
					return {
						ok: true,
						value: { disconnected: true }
					};
				}
				case "repair-oauth":
					await removeApiKeyOverride(ctx);
					return {
						ok: true,
						value: { repaired: true }
					};
				default: throw new PublicError("NOT_FOUND", "Unknown xAI OAuth operation: " + endpoint);
			}
		} catch (error) {
			return {
				ok: false,
				error: {
					...publicFailure(error),
					details: {}
				}
			};
		}
	};
}
//#endregion
export { XaiOAuthService, XaiOAuthService as default, createXaiOAuthRpcHandler, inject, name };

//# sourceMappingURL=index.mjs.map