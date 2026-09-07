import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply, createXaiOAuthRpcHandler } from '../src/index.js'

type FakeOptions = {
  apiKeyEnv?: string
  credential?: {
    configured: boolean
    kind?: 'api-key' | 'grant'
    writable: boolean
  }
}

function fakeContext(options: FakeOptions = {}): {
  ctx: Context
  begin: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  deleteRecord: ReturnType<typeof vi.fn>
  mutate: ReturnType<typeof vi.fn>
  unset: ReturnType<typeof vi.fn>
} {
  const state = {
    apiKeyEnv: options.apiKeyEnv,
    credential: options.credential ?? {
      configured: true,
      kind: 'grant' as const,
      writable: true,
    },
  }
  const begin = vi.fn(async (request: {
    method?: string
    interaction: { notify(notice: object): void }
  }) => {
    request.interaction.notify({
      message: 'Open xAI',
      url: 'https://accounts.x.ai',
      code: 'TEST-CODE',
    })
    return { status: 'authorized' as const }
  })
  const cancel = vi.fn()
  const deleteRecord = vi.fn(async () => {
    state.credential = { configured: false, writable: true }
  })
  const mutate = vi.fn(async () => {
    state.apiKeyEnv = undefined
  })
  const unset = vi.fn(async () => undefined)

  const ctx = {
    authorization: {
      describe: vi.fn(() => ({
        inFlight: false,
        methods: [{ id: 'oauth', label: 'OAuth' }],
      })),
      begin,
      cancel,
    },
    credentials: {
      describeRecord: vi.fn(async () => state.credential),
      describe: vi.fn(async () => ({ configured: true, writable: true, source: 'file' })),
      deleteRecord,
      unset,
    },
    settings: {
      writable: true,
      get: vi.fn(() => ({
        providers: {
          xai: state.apiKeyEnv === undefined ? {} : { apiKeyEnv: state.apiKeyEnv },
        },
      })),
      mutate,
    },
  } as unknown as Context

  return { ctx, begin, cancel, deleteRecord, mutate, unset }
}

describe('xAI OAuth RPC', () => {
  it('reports OAuth and API-key override state without exposing credentials', async () => {
    const { ctx } = fakeContext({ apiKeyEnv: 'XAI_API_KEY' })
    const result = await createXaiOAuthRpcHandler(ctx)('status', {}, new AbortController().signal)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      connected: true,
      credentialKind: 'grant',
      apiKeyOverride: {
        active: true,
        configured: true,
        reference: 'XAI_API_KEY',
      },
      flow: {
        oauthAvailable: true,
      },
    })
    expect(JSON.stringify(result.value)).not.toContain('token')
  })

  it('always starts the xAI flow with the OAuth method', async () => {
    const { ctx, begin } = fakeContext()
    const result = await createXaiOAuthRpcHandler(ctx)('begin', {}, new AbortController().signal)
    await Promise.resolve()

    expect(result).toEqual({ ok: true, value: { accepted: true } })
    expect(begin).toHaveBeenCalledOnce()
    expect(begin.mock.calls[0]?.[0]).toMatchObject({ method: 'oauth' })
  })

  it('removes an accidental API-key override but leaves the OAuth record alone', async () => {
    const { ctx, deleteRecord, mutate, unset } = fakeContext({ apiKeyEnv: 'XAI_API_KEY' })
    const result = await createXaiOAuthRpcHandler(ctx)('repair-oauth', {}, new AbortController().signal)

    expect(result).toEqual({ ok: true, value: { repaired: true } })
    expect(mutate).toHaveBeenCalledWith('llm-pi-ai', [
      { op: 'unset', path: ['providers', 'xai', 'apiKeyEnv'] },
    ])
    expect(unset).toHaveBeenCalledOnce()
    expect(deleteRecord).not.toHaveBeenCalled()
  })

  it('refuses to delete a read-only OAuth record', async () => {
    const { ctx, deleteRecord } = fakeContext({
      credential: { configured: true, kind: 'grant', writable: false },
    })
    const result = await createXaiOAuthRpcHandler(ctx)('disconnect', {}, new AbortController().signal)

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'CREDENTIALS_READ_ONLY',
      },
    })
    expect(deleteRecord).not.toHaveBeenCalled()
  })

  it('rejects unexpected request fields', async () => {
    const { ctx } = fakeContext()
    const result = await createXaiOAuthRpcHandler(ctx)(
      'status',
      { unexpected: true },
      new AbortController().signal,
    )

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
      },
    })
  })

  it('registers only the authenticated Connection channel', () => {
    const handle = vi.fn()
    const effect = vi.fn((setup: () => unknown) => setup())
    const { ctx } = fakeContext()
    Object.assign(ctx, {
      connection: { rpc: { handle } },
      effect,
    })

    apply(ctx, {})

    expect(handle).toHaveBeenCalledOnce()
    expect(handle.mock.calls[0]?.[0]).toBe('/dsh-xai-oauth')
    expect((ctx as unknown as { webServer?: unknown }).webServer).toBeUndefined()
  })
})
