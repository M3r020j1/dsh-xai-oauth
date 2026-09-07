import type { Context } from '@deepseek-ai/cordis'
import { credentialKey, credentialRef, isCredentialRefName } from '@deepseek-ai/dsh-credentials'
import type {
  ConnectionRpcHandler,
  ConnectionRpcResult,
} from '@deepseek-ai/dsh-client-connection'
import { AuthorizationJournal } from './journal.js'

import type {} from '@deepseek-ai/dsh-authorization'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-settings'

const RPC_CHANNEL = '/dsh-xai-oauth'
const XAI_CREDENTIAL_KEY = credentialKey('llm-pi-ai', 'xai')
const XAI_API_KEY_REF = credentialRef('XAI_API_KEY')

export const name = 'dsh-xai-oauth'
export const inject = ['authorization', 'connection', 'credentials', 'settings']
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

function ok<T>(value: T): ConnectionRpcResult<T> {
  return { ok: true, value }
}

function failed(error: unknown, fallbackCode?: string): ConnectionRpcResult<never> {
  const failure = publicFailure(error, fallbackCode)
  return {
    ok: false,
    error: {
      ...failure,
      details: {},
    },
  }
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

export function createXaiOAuthRpcHandler(
  ctx: Context,
  journal = new AuthorizationJournal(),
): ConnectionRpcHandler {
  return async (endpoint, payload) => {
    try {
      requireEmptyPayload(payload)

      switch (endpoint) {
        case 'status':
          return ok(await statusPayload(ctx, journal))

        case 'begin':
          startAuthorization(ctx, journal)
          return ok({ accepted: true })

        case 'cancel':
          journal.cancel()
          ctx.authorization.cancel(XAI_CREDENTIAL_KEY)
          return ok({ cancelled: true })

        case 'disconnect': {
          const record = await ctx.credentials.describeRecord(XAI_CREDENTIAL_KEY)
          journal.cancel()
          ctx.authorization.cancel(XAI_CREDENTIAL_KEY)
          if (record.configured && !record.writable) {
            throw new PublicError('CREDENTIALS_READ_ONLY', 'The xAI OAuth credential is read-only')
          }
          if (record.configured) await ctx.credentials.deleteRecord(XAI_CREDENTIAL_KEY)
          journal.reset()
          return ok({ disconnected: true })
        }

        case 'repair-oauth':
          await removeApiKeyOverride(ctx)
          return ok({ repaired: true })

        default:
          return failed(
            new PublicError('NOT_FOUND', `Unknown xAI OAuth operation: ${endpoint}`),
          )
      }
    } catch (error) {
      return failed(error)
    }
  }
}

/**
 * Mount xAI OAuth as an authenticated DSH Connection channel. The Connection
 * service owns browser-session authentication plus Host/Origin/Fetch-Metadata
 * checks and scopes the route disposer to this plugin's Cordis fiber.
 */
export function apply(ctx: Context, _config: Config): void {
  const journal = new AuthorizationJournal()
  ctx.connection.rpc.handle(RPC_CHANNEL, createXaiOAuthRpcHandler(ctx, journal))
  ctx.effect(() => () => {
    journal.cancel()
    ctx.authorization.cancel(XAI_CREDENTIAL_KEY)
  }, 'dsh-xai-oauth: cancel authorization on unload')
}
