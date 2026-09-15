import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { Context } from "@deepseek-ai/cordis";
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
declare class XaiOAuthService extends TypertRemoteService {
  static inject: readonly ["authorization", "connection", "credentials", "settings", "webServer"];
  private readonly journal;
  constructor(ctx: Context);
  status(): Promise<XaiOAuthStatus>;
  begin(): Promise<{
    accepted: true;
  }>;
  cancel(): Promise<{
    cancelled: true;
  }>;
  disconnect(): Promise<{
    disconnected: true;
  }>;
  repairOauth(): Promise<{
    repaired: true;
  }>;
}
/** Keep the historical factory for unit tests of the OAuth business logic. */
declare function createXaiOAuthRpcHandler(ctx: Context, journal?: AuthorizationJournal): (endpoint: string, payload: unknown, _signal?: AbortSignal) => Promise<{
  ok: boolean;
  value: XaiOAuthStatus;
  error?: undefined;
} | {
  ok: boolean;
  value: {
    accepted: boolean;
    cancelled?: undefined;
    disconnected?: undefined;
    repaired?: undefined;
  };
  error?: undefined;
} | {
  ok: boolean;
  value: {
    cancelled: boolean;
    accepted?: undefined;
    disconnected?: undefined;
    repaired?: undefined;
  };
  error?: undefined;
} | {
  ok: boolean;
  value: {
    disconnected: boolean;
    accepted?: undefined;
    cancelled?: undefined;
    repaired?: undefined;
  };
  error?: undefined;
} | {
  ok: boolean;
  value: {
    repaired: boolean;
    accepted?: undefined;
    cancelled?: undefined;
    disconnected?: undefined;
  };
  error?: undefined;
} | {
  ok: boolean;
  error: {
    details: {};
    code: string;
    message: string;
  };
  value?: undefined;
}>;
//#endregion
export { Config, XaiOAuthService, XaiOAuthService as default, XaiOAuthStatus, createXaiOAuthRpcHandler, inject, name };
//# sourceMappingURL=index.d.mts.map