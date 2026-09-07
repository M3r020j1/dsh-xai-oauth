window.__ModuleLoader__.load({
	id: "dsh-xai-oauth",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		//#region src/client/index.ts
		const inject = [
			"connection",
			"locale",
			"slots"
		];
		const RPC_CHANNEL = "/dsh-xai-oauth";
		const LOCALE_NS = "dsh-xai-oauth";
		const FAST_POLL_MS = 1e3;
		const IDLE_POLL_MS = 15e3;
		const dictionaries = {
			en: {
				title: "xAI OAuth",
				description: "Sign in to xAI through the DSH credential vault. OAuth tokens are never displayed here.",
				connected: "Connected with xAI OAuth",
				connecting: "OAuth sign-in in progress…",
				disconnected: "Not connected with xAI OAuth",
				apiKeyRecord: "A non-OAuth xAI credential is stored",
				routeExplanation: "This OAuth control belongs to the xAI model provider above. The Edit button remains available only if you intentionally want to switch to API-key authentication.",
				apiKeyWarning: "An API-key setting currently overrides OAuth.",
				apiKeyConfigured: "A stored API key currently overrides OAuth.",
				repair: "Restore OAuth",
				repairConfirm: "Remove the xAI API-key override and keep the existing OAuth connection?",
				connect: "Connect with xAI",
				disconnect: "Disconnect",
				disconnectConfirm: "Disconnect the xAI OAuth account from this DSH installation?",
				cancel: "Cancel sign-in",
				refresh: "Refresh",
				working: "Working…",
				openAuthorization: "Open the authorization page",
				copyCode: "Copy code",
				copied: "Copied",
				unavailable: "The xAI OAuth flow is unavailable in this DSH profile.",
				readOnly: "This credential store is read-only.",
				error: "Error"
			},
			zh: {
				title: "xAI OAuth",
				description: "通过 DSH 凭据保险库登录 xAI。OAuth 令牌不会显示在此处。",
				connected: "已通过 xAI OAuth 连接",
				connecting: "正在进行 OAuth 登录…",
				disconnected: "尚未通过 xAI OAuth 连接",
				apiKeyRecord: "已存储非 OAuth 的 xAI 凭据",
				routeExplanation: "此 OAuth 控件属于上方的 xAI 模型提供商。仅当你确实要切换到 API 密钥认证时，才使用 Edit 按钮。",
				apiKeyWarning: "API 密钥设置当前正在覆盖 OAuth。",
				apiKeyConfigured: "已存储的 API 密钥当前正在覆盖 OAuth。",
				repair: "恢复 OAuth",
				repairConfirm: "移除 xAI API 密钥覆盖并保留现有 OAuth 连接？",
				connect: "连接 xAI",
				disconnect: "断开连接",
				disconnectConfirm: "从此 DSH 安装中断开 xAI OAuth 帐户？",
				cancel: "取消登录",
				refresh: "刷新",
				working: "处理中…",
				openAuthorization: "打开授权页面",
				copyCode: "复制代码",
				copied: "已复制",
				unavailable: "此 DSH 配置中没有可用的 xAI OAuth 流程。",
				readOnly: "此凭据存储为只读。",
				error: "错误"
			}
		};
		const buttonStyle = {
			border: "1px solid var(--dsw-alias-border-l2, #d4d4d4)",
			borderRadius: 8,
			padding: "7px 11px",
			cursor: "pointer"
		};
		function messageOf(reason) {
			return reason instanceof Error ? reason.message : String(reason);
		}
		function safeHttpsUrl(value) {
			if (value === void 0) return void 0;
			try {
				const url = new URL(value);
				return url.protocol === "https:" ? url.href : void 0;
			} catch {
				return;
			}
		}
		async function rpc(connection, endpoint) {
			const result = await connection.rpc.call(RPC_CHANNEL, endpoint, {});
			if (!result.ok) throw new Error(result.error.message || result.error.code);
			return result.value;
		}
		function XaiOAuthCard(props) {
			const { connection, t } = props;
			const [status, setStatus] = (0, react.useState)(void 0);
			const [error, setError] = (0, react.useState)(void 0);
			const [busy, setBusy] = (0, react.useState)(false);
			const [copiedCode, setCopiedCode] = (0, react.useState)(void 0);
			const refresh = (0, react.useCallback)(async () => {
				try {
					setStatus(await rpc(connection, "status"));
					setError(void 0);
				} catch (reason) {
					setError(messageOf(reason));
				}
			}, [connection]);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			const running = status?.flow?.inFlight === true || status?.attempt.state === "running";
			(0, react.useEffect)(() => {
				let stopped = false;
				let timer;
				const schedule = () => {
					if (stopped) return;
					timer = window.setTimeout(() => {
						if (document.visibilityState === "visible") refresh();
						schedule();
					}, running ? FAST_POLL_MS : IDLE_POLL_MS);
				};
				const onVisibility = () => {
					if (document.visibilityState === "visible") refresh();
				};
				schedule();
				document.addEventListener("visibilitychange", onVisibility);
				return () => {
					stopped = true;
					if (timer !== void 0) window.clearTimeout(timer);
					document.removeEventListener("visibilitychange", onVisibility);
				};
			}, [refresh, running]);
			(0, react.useEffect)(() => {
				if (copiedCode === void 0) return;
				const timer = window.setTimeout(() => setCopiedCode(void 0), 2e3);
				return () => window.clearTimeout(timer);
			}, [copiedCode]);
			const reloadWithoutClearingError = async () => {
				try {
					setStatus(await rpc(connection, "status"));
				} catch {}
			};
			const act = async (endpoint) => {
				setBusy(true);
				try {
					await rpc(connection, endpoint);
					setStatus(await rpc(connection, "status"));
					setError(void 0);
				} catch (reason) {
					setError(messageOf(reason));
					await reloadWithoutClearingError();
				} finally {
					setBusy(false);
				}
			};
			const disconnect = () => {
				if (window.confirm(t("disconnectConfirm"))) act("disconnect");
			};
			const repairOAuth = () => {
				if (window.confirm(t("repairConfirm"))) act("repair-oauth");
			};
			const copyCode = async (code) => {
				try {
					await navigator.clipboard.writeText(code);
					setCopiedCode(code);
				} catch (reason) {
					setError(messageOf(reason));
				}
			};
			const connected = status?.connected === true;
			const hasCredential = status?.credentialKind !== void 0;
			const notices = status?.attempt.notices ?? [];
			const statusLabel = connected ? t("connected") : running ? t("connecting") : status?.credentialKind === "api-key" ? t("apiKeyRecord") : t("disconnected");
			return (0, react.createElement)("div", { style: {
				borderTop: "1px solid var(--dsw-alias-border-l2, #ddd)",
				marginTop: 12,
				paddingTop: 12,
				display: "grid",
				gap: 10
			} }, (0, react.createElement)("strong", null, t("title")), (0, react.createElement)("p", { style: {
				margin: 0,
				color: "var(--dsw-alias-text-secondary, #666)"
			} }, t("description")), (0, react.createElement)("div", null, (0, react.createElement)("strong", null, statusLabel), (0, react.createElement)("p", { style: {
				margin: "6px 0 0",
				color: "var(--dsw-alias-text-secondary, #666)"
			} }, t("routeExplanation"))), status?.flow !== void 0 && !status.flow.oauthAvailable ? (0, react.createElement)("p", { style: {
				margin: 0,
				color: "#b91c1c"
			} }, t("unavailable")) : null, status?.apiKeyOverride.active ? (0, react.createElement)("div", { style: {
				border: "1px solid #b7791f",
				borderRadius: 8,
				padding: 10,
				background: "color-mix(in srgb, #b7791f 10%, transparent)"
			} }, (0, react.createElement)("strong", null, status.apiKeyOverride.configured ? t("apiKeyConfigured") : t("apiKeyWarning")), (0, react.createElement)("button", {
				type: "button",
				style: {
					...buttonStyle,
					marginLeft: 10
				},
				disabled: busy || !status.writable.settings,
				onClick: repairOAuth
			}, busy ? t("working") : t("repair"))) : null, status !== void 0 && !status.writable.credential && hasCredential ? (0, react.createElement)("p", { style: {
				margin: 0,
				color: "#b91c1c"
			} }, t("readOnly")) : null, (0, react.createElement)("div", { style: {
				display: "flex",
				gap: 8,
				flexWrap: "wrap"
			} }, connected || hasCredential ? (0, react.createElement)("button", {
				type: "button",
				style: buttonStyle,
				disabled: busy || status?.writable.credential === false,
				onClick: disconnect
			}, busy ? t("working") : t("disconnect")) : (0, react.createElement)("button", {
				type: "button",
				style: buttonStyle,
				disabled: busy || running || status?.flow?.oauthAvailable === false,
				onClick: () => {
					act("begin");
				}
			}, busy || running ? t("working") : t("connect")), running ? (0, react.createElement)("button", {
				type: "button",
				style: buttonStyle,
				disabled: busy,
				onClick: () => {
					act("cancel");
				}
			}, t("cancel")) : null, (0, react.createElement)("button", {
				type: "button",
				style: buttonStyle,
				disabled: busy,
				onClick: () => {
					refresh();
				}
			}, t("refresh"))), ...notices.map((notice, index) => {
				const url = safeHttpsUrl(notice.url);
				return (0, react.createElement)("div", {
					key: `${index}:${notice.code ?? notice.message}`,
					style: {
						border: "1px solid var(--dsw-alias-border-l2, #ddd)",
						borderRadius: 8,
						padding: 10
					}
				}, (0, react.createElement)("div", null, notice.message), url === void 0 ? null : (0, react.createElement)("a", {
					href: url,
					target: "_blank",
					rel: "noopener noreferrer",
					style: {
						display: "inline-block",
						marginTop: 8
					}
				}, t("openAuthorization")), notice.code === void 0 ? null : (0, react.createElement)("div", { style: {
					display: "flex",
					gap: 8,
					alignItems: "center",
					marginTop: 8
				} }, (0, react.createElement)("code", { style: { fontSize: 18 } }, notice.code), (0, react.createElement)("button", {
					type: "button",
					style: buttonStyle,
					onClick: () => {
						copyCode(notice.code);
					}
				}, copiedCode === notice.code ? t("copied") : t("copyCode"))));
			}), status?.attempt.error ? (0, react.createElement)("p", { style: {
				margin: 0,
				color: "#b91c1c"
			} }, `${t("error")}: ${status.attempt.error}`) : null, error ? (0, react.createElement)("p", { style: {
				margin: 0,
				color: "#b91c1c"
			} }, `${t("error")}: ${error}`) : null);
		}
		function ProviderCardExtension(props) {
			if (props.provider.provider !== "xai") return null;
			return (0, react.createElement)(XaiOAuthCard, props);
		}
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(LOCALE_NS, "en", dictionaries.en), "dsh-xai-oauth: English dictionary");
			ctx.effect(() => ctx.locale.register(LOCALE_NS, "zh", dictionaries.zh), "dsh-xai-oauth: Chinese dictionary");
			ctx.slots.inject("settings.models.provider-card", () => ctx.slots.register({
				name: "settings.models.provider-card",
				key: "llm-pi-ai",
				locale: LOCALE_NS
			}, (props) => (0, react.createElement)(ProviderCardExtension, {
				...props,
				connection: ctx.connection
			})));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map