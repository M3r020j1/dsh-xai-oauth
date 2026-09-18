import type { Context } from '@deepseek-ai/cordis'
import type { CredentialKey, CredentialRef } from '@deepseek-ai/dsh-credentials'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { AuthorizationJournal } from './journal.js'

import type {} from '@deepseek-ai/dsh-authorization'
import type {} from '@deepseek-ai/dsh-settings'

const SERVICE_KEY = 'dshXaiOauth'
const CREDENTIAL_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const XAI_CREDENTIAL_KEY = 'llm-pi-ai/xai' as CredentialKey
const XAI_API_KEY_REF = 'XAI_API_KEY' as CredentialRef

export const name = 'dsh-xai-oauth'
export const inject = ['authorization', 'credentials', 'settings']
export interface Config {}

export interface XaiOAuthStatus {
  credential: 'llm-pi-ai/xai'
  connected: boolean
  credentialKind?: 'api-key' | 'grant'
  writable: {
    credential: boolean
    settings: boolean
  }
  apiKeyOverride: {
    active: boolean
    configured: boolean
    reference?: string
    writable: boolean
  }
  flow?: {
    inFlight: boolean
    oauthAvailable: boolean
  }
  attempt: ReturnType<AuthorizationJournal['snapshot']>
}

type PiAiSettings = {
  providers?: {
    xai?: {
      apiKeyEnv?: unknown
    }
  }
}

function isCredentialRefName(value: string): boolean {
  return CREDENTIAL_REF_PATTERN.test(value)
}

function credentialRef(value: string): CredentialRef {
  if (!isCredentialRefName(value)) {
    throw new TypeError(`credential ref "${value}" must be a POSIX shell identifier`)
  }
  return value as CredentialRef
}

class PublicError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
  }
}

function xaiApiKeyEnv(ctx: Context): string | undefined {
  const settings = ctx.settings.get('llm-pi-ai') as PiAiSettings | undefined
  const value = settings?.providers?.xai?.apiKeyEnv
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function publicFailure(error: unknown, fallbackCode = 'AUTHORIZATION_FAILED'): {
  code: string
  message: string
} {
  const code = typeof error === 'object'
    && error !== null
    && 'code' in error
    && typeof error.code === 'string'
    ? error.code
    : fallbackCode
  const message = error instanceof Error && error.message.length > 0
    ? error.message
    : typeof error === 'string' && error.length > 0
      ? error
      : code
  return { code, message }
}

function requireEmptyPayload(payload: unknown): void {
  if (
    payload === null
    || typeof payload !== 'object'
    || Array.isArray(payload)
    || Object.keys(payload).length > 0
  ) {
    throw new PublicError('INVALID_REQUEST', 'This operation does not accept parameters')
  }
}

async function statusPayload(ctx: Context, journal: AuthorizationJournal): Promise<XaiOAuthStatus> {
  const [record, defaultApiKey] = await Promise.all([
    ctx.credentials.describeRecord(XAI_CREDENTIAL_KEY),
    ctx.credentials.describe(XAI_API_KEY_REF),
  ])
  const apiKeyEnv = xaiApiKeyEnv(ctx)
  const configuredApiKey = apiKeyEnv === undefined || apiKeyEnv === 'XAI_API_KEY'
    ? defaultApiKey
    : await ctx.credentials.describe(credentialRef(apiKeyEnv))
  const flow = ctx.authorization.describe(XAI_CREDENTIAL_KEY)

  return {
    credential: 'llm-pi-ai/xai',
    connected: record.configured && record.kind === 'grant',
    ...(record.kind === undefined ? {} : { credentialKind: record.kind }),
    writable: {
      credential: record.writable,
      settings: ctx.settings.writable,
    },
    apiKeyOverride: {
      active: apiKeyEnv !== undefined,
      configured: apiKeyEnv !== undefined && configuredApiKey.configured,
      ...(apiKeyEnv === undefined ? {} : { reference: apiKeyEnv }),
      writable: configuredApiKey.writable,
    },
    ...(flow === undefined
      ? {}
      : {
          flow: {
            inFlight: flow.inFlight,
            oauthAvailable: flow.methods.some(method => method.id === 'oauth'),
          },
        }),
    attempt: journal.snapshot(),
  }
}

async function removeApiKeyOverride(ctx: Context): Promise<void> {
  const apiKeyEnv = xaiApiKeyEnv(ctx)
  if (apiKeyEnv === undefined) return
  if (!ctx.settings.writable) {
    throw new PublicError('SETTINGS_READ_ONLY', 'The DSH settings store is read-only')
  }

  await ctx.settings.mutate('llm-pi-ai', [
    { op: 'unset', path: ['providers', 'xai', 'apiKeyEnv'] },
  ])

  const references = new Set([apiKeyEnv, 'XAI_API_KEY'])
  for (const reference of references) {
    if (!isCredentialRefName(reference)) continue
    const ref = credentialRef(reference)
    const info = await ctx.credentials.describe(ref)
    if (info.configured && info.writable) await ctx.credentials.unset(ref)
  }
}

function startAuthorization(ctx: Context, journal: AuthorizationJournal): void {
  const flow = ctx.authorization.describe(XAI_CREDENTIAL_KEY)
  if (flow === undefined || !flow.methods.some(method => method.id === 'oauth')) {
    throw new PublicError('OAUTH_UNAVAILABLE', 'The xAI OAuth flow is not available')
  }

  journal.start()
  void ctx.authorization.begin({
    key: XAI_CREDENTIAL_KEY,
    method: 'oauth',
    interaction: {
      notify: notice => journal.notify(notice),
      prompt: prompt => journal.prompt(prompt),
    },
  }).then(
    outcome => journal.settle(outcome.status),
    error => {
      const failure = publicFailure(error)
      journal.settle(failure.code === 'CANCELLED' ? 'cancelled' : 'failed', failure.message)
    },
  )
}

export class XaiOAuthService extends TypertRemoteService {
  static inject = ['authorization', 'credentials', 'settings'] as const

  private readonly journal = new AuthorizationJournal()

  constructor(ctx: Context) {
    super(ctx, SERVICE_KEY)
    this.ctx.effect(() => () => {
      this.journal.cancel()
      this.ctx.authorization.cancel(XAI_CREDENTIAL_KEY)
    }, 'dsh-xai-oauth: cancel authorization on unload')
  }

  async status(): Promise<XaiOAuthStatus> {
    return statusPayload(this.ctx, this.journal)
  }

  async begin(): Promise<{ accepted: true }> {
    startAuthorization(this.ctx, this.journal)
    return { accepted: true }
  }

  async cancel(): Promise<{ cancelled: true }> {
    this.journal.cancel()
    this.ctx.authorization.cancel(XAI_CREDENTIAL_KEY)
    return { cancelled: true }
  }

  async disconnect(): Promise<{ disconnected: true }> {
    const record = await this.ctx.credentials.describeRecord(XAI_CREDENTIAL_KEY)
    this.journal.cancel()
    this.ctx.authorization.cancel(XAI_CREDENTIAL_KEY)
    if (record.configured && !record.writable) {
      throw new PublicError('CREDENTIALS_READ_ONLY', 'The xAI OAuth credential is read-only')
    }
    if (record.configured) await this.ctx.credentials.deleteRecord(XAI_CREDENTIAL_KEY)
    this.journal.reset()
    return { disconnected: true }
  }

  async repairOauth(): Promise<{ repaired: true }> {
    await removeApiKeyOverride(this.ctx)
    return { repaired: true }
  }
}

export default XaiOAuthService

const REMOTE_METHOD_DESCRIPTOR = '@deepseek-ai/dsh-typert-protocol/remote-methods'

function markRemoteMethods(serviceClass: typeof XaiOAuthService): void {
  const prototype = serviceClass.prototype as object
  const methods = Object.freeze([
    Object.freeze({ method: 'status', invocation: Object.freeze({ kind: 'direct' as const }) }),
    Object.freeze({ method: 'begin', invocation: Object.freeze({ kind: 'direct' as const }) }),
    Object.freeze({ method: 'cancel', invocation: Object.freeze({ kind: 'direct' as const }) }),
    Object.freeze({ method: 'disconnect', invocation: Object.freeze({ kind: 'direct' as const }) }),
    Object.freeze({ method: 'repairOauth', exportName: 'repair-oauth', invocation: Object.freeze({ kind: 'direct' as const }) }),
  ])
  Object.defineProperty(prototype, REMOTE_METHOD_DESCRIPTOR, {
    configurable: true,
    value: Object.freeze({ version: 1, methods }),
  })
}

markRemoteMethods(XaiOAuthService)

/** Keep the historical factory for unit tests of the OAuth business logic. */
export function createXaiOAuthRpcHandler(
  ctx: Context,
  journal = new AuthorizationJournal(),
) {
  return async (endpoint: string, payload: unknown, _signal?: AbortSignal) => {
    try {
      requireEmptyPayload(payload)

      switch (endpoint) {
        case 'status':
          return { ok: true, value: await statusPayload(ctx, journal) }

        case 'begin':
          startAuthorization(ctx, journal)
          return { ok: true, value: { accepted: true } }

        case 'cancel':
          journal.cancel()
          ctx.authorization.cancel(XAI_CREDENTIAL_KEY)
          return { ok: true, value: { cancelled: true } }

        case 'disconnect': {
          const record = await ctx.credentials.describeRecord(XAI_CREDENTIAL_KEY)
          journal.cancel()
          ctx.authorization.cancel(XAI_CREDENTIAL_KEY)
          if (record.configured && !record.writable) {
            throw new PublicError('CREDENTIALS_READ_ONLY', 'The xAI OAuth credential is read-only')
          }
          if (record.configured) await ctx.credentials.deleteRecord(XAI_CREDENTIAL_KEY)
          journal.reset()
          return { ok: true, value: { disconnected: true } }
        }

        case 'repair-oauth':
          await removeApiKeyOverride(ctx)
          return { ok: true, value: { repaired: true } }

        default:
          throw new PublicError('NOT_FOUND', 'Unknown xAI OAuth operation: ' + endpoint)
      }
    } catch (error) {
      const failure = publicFailure(error)
      return {
        ok: false,
        error: {
          ...failure,
          details: {},
        },
      }
    }
  }
}
