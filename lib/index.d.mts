import { Context } from "@deepseek-ai/cordis";
import { ConnectionRpcHandler } from "@deepseek-ai/dsh-client-connection";
import { AuthorizationNotice, AuthorizationPrompt } from "@deepseek-ai/dsh-authorization";
//#region src/journal.d.ts
type PublicPrompt = Omit<AuthorizationPrompt, 'signal'> & {
  id: string;
};
interface PublicAttempt {
  state: 'idle' | 'running' | 'authorized' | 'cancelled' | 'failed';
  notices: readonly AuthorizationNotice[];
  prompt?: PublicPrompt;
  error?: string;
}
/**
 * Keeps only browser-safe authorization progress. In particular, answers are
 * passed straight to the provider flow and are never retained or logged.
 */
declare class AuthorizationJournal {
  #private;
  start(): void;
  notify(notice: AuthorizationNotice): void;
  prompt(prompt: AuthorizationPrompt): Promise<string>;
  answer(id: string, value: string): void;
  cancel(): void;
  reset(): void;
  settle(state: Exclude<PublicAttempt['state'], 'idle' | 'running'>, error?: string): void;
  snapshot(): PublicAttempt;
}
//#endregion
//#region src/index.d.ts
declare const name = "dsh-xai-oauth";
declare const inject: string[];
interface Config {}
interface XaiOAuthStatus {
  credential: 'llm-pi-ai/xai';
  connected: boolean;
  credentialKind?: 'api-key' | 'grant';
  writable: {
    credential: boolean;
    settings: boolean;
  };
  apiKeyOverride: {
    active: boolean;
    configured: boolean;
    reference?: string;
    writable: boolean;
  };
  flow?: {
    inFlight: boolean;
    oauthAvailable: boolean;
  };
  attempt: ReturnType<AuthorizationJournal['snapshot']>;
}
declare function createXaiOAuthRpcHandler(ctx: Context, journal?: AuthorizationJournal): ConnectionRpcHandler;
/**
 * Mount xAI OAuth as an authenticated DSH Connection channel. The Connection
 * service owns browser-session authentication plus Host/Origin/Fetch-Metadata
 * checks and scopes the route disposer to this plugin's Cordis fiber.
 */
declare function apply(ctx: Context, _config: Config): void;
//#endregion
export { Config, XaiOAuthStatus, apply, createXaiOAuthRpcHandler, inject, name };
//# sourceMappingURL=index.d.mts.map