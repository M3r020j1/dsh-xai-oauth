import { createElement as h, useCallback, useEffect, useState } from 'react'

import type { ConnectionRpcResult } from '@deepseek-ai/dsh-client-connection/client'
import type { ProviderCardExtrasOwnerProps } from '@deepseek-ai/dsh-client-ui-settings-models/client'

export const inject = ['connection', 'locale', 'slots']

const RPC_CHANNEL = '/dsh-xai-oauth'
const LOCALE_NS = 'dsh-xai-oauth'
const FAST_POLL_MS = 1_000
const IDLE_POLL_MS = 15_000

type Notice = { message: string; url?: string; code?: string }
type Status = {
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
  attempt: {
    state: 'idle' | 'running' | 'authorized' | 'cancelled' | 'failed'
    notices: Notice[]
    error?: string
  }
}

type Translate = (key: string) => string
type Connection = {
  rpc: {
    call(channel: string, endpoint: string, payload: unknown): Promise<ConnectionRpcResult<unknown>>
  }
}
type CardProps = ProviderCardExtrasOwnerProps & {
  connection: Connection
  t: Translate
}

const dictionaries = {
  en: {
    title: 'xAI OAuth',
    description: 'Sign in to xAI through the DSH credential vault. OAuth tokens are never displayed here.',
    connected: 'Connected with xAI OAuth',
    connecting: 'OAuth sign-in in progress…',
    disconnected: 'Not connected with xAI OAuth',
    apiKeyRecord: 'A non-OAuth xAI credential is stored',
    routeExplanation: 'This OAuth control belongs to the xAI model provider above. The Edit button remains available only if you intentionally want to switch to API-key authentication.',
    apiKeyWarning: 'An API-key setting currently overrides OAuth.',
    apiKeyConfigured: 'A stored API key currently overrides OAuth.',
    repair: 'Restore OAuth',
    repairConfirm: 'Remove the xAI API-key override and keep the existing OAuth connection?',
    connect: 'Connect with xAI',
    disconnect: 'Disconnect',
    disconnectConfirm: 'Disconnect the xAI OAuth account from this DSH installation?',
    cancel: 'Cancel sign-in',
    refresh: 'Refresh',
    working: 'Working…',
    openAuthorization: 'Open the authorization page',
    copyCode: 'Copy code',
    copied: 'Copied',
    unavailable: 'The xAI OAuth flow is unavailable in this DSH profile.',
    readOnly: 'This credential store is read-only.',
    error: 'Error',
  },
  zh: {
    title: 'xAI OAuth',
    description: '通过 DSH 凭据保险库登录 xAI。OAuth 令牌不会显示在此处。',
    connected: '已通过 xAI OAuth 连接',
    connecting: '正在进行 OAuth 登录…',
    disconnected: '尚未通过 xAI OAuth 连接',
    apiKeyRecord: '已存储非 OAuth 的 xAI 凭据',
    routeExplanation: '此 OAuth 控件属于上方的 xAI 模型提供商。仅当你确实要切换到 API 密钥认证时，才使用 Edit 按钮。',
    apiKeyWarning: 'API 密钥设置当前正在覆盖 OAuth。',
    apiKeyConfigured: '已存储的 API 密钥当前正在覆盖 OAuth。',
    repair: '恢复 OAuth',
    repairConfirm: '移除 xAI API 密钥覆盖并保留现有 OAuth 连接？',
    connect: '连接 xAI',
    disconnect: '断开连接',
    disconnectConfirm: '从此 DSH 安装中断开 xAI OAuth 帐户？',
    cancel: '取消登录',
    refresh: '刷新',
    working: '处理中…',
    openAuthorization: '打开授权页面',
    copyCode: '复制代码',
    copied: '已复制',
    unavailable: '此 DSH 配置中没有可用的 xAI OAuth 流程。',
    readOnly: '此凭据存储为只读。',
    error: '错误',
  },
} as const

const buttonStyle = {
  border: '1px solid var(--dsw-alias-border-l2, #d4d4d4)',
  borderRadius: 8,
  padding: '7px 11px',
  cursor: 'pointer',
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

function safeHttpsUrl(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

async function rpc<T>(connection: Connection, endpoint: string): Promise<T> {
  const result = await connection.rpc.call(RPC_CHANNEL, endpoint, {})
  if (!result.ok) throw new Error(result.error.message || result.error.code)
  return result.value as T
}

function XaiOAuthCard(props: CardProps): unknown {
  const { connection, t } = props
  const [status, setStatus] = useState<Status | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | undefined>(undefined)

  const refresh = useCallback(async () => {
    try {
      setStatus(await rpc<Status>(connection, 'status'))
      setError(undefined)
    } catch (reason) {
      setError(messageOf(reason))
    }
  }, [connection])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const running = status?.flow?.inFlight === true || status?.attempt.state === 'running'

  useEffect(() => {
    let stopped = false
    let timer: number | undefined

    const schedule = (): void => {
      if (stopped) return
      timer = window.setTimeout(() => {
        if (document.visibilityState === 'visible') void refresh()
        schedule()
      }, running ? FAST_POLL_MS : IDLE_POLL_MS)
    }
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') void refresh()
    }

    schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopped = true
      if (timer !== undefined) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh, running])

  useEffect(() => {
    if (copiedCode === undefined) return
    const timer = window.setTimeout(() => setCopiedCode(undefined), 2_000)
    return () => window.clearTimeout(timer)
  }, [copiedCode])

  const reloadWithoutClearingError = async (): Promise<void> => {
    try {
      setStatus(await rpc<Status>(connection, 'status'))
    } catch {
      // Keep the operation's more useful error message.
    }
  }

  const act = async (endpoint: string): Promise<void> => {
    setBusy(true)
    try {
      await rpc(connection, endpoint)
      setStatus(await rpc<Status>(connection, 'status'))
      setError(undefined)
    } catch (reason) {
      setError(messageOf(reason))
      await reloadWithoutClearingError()
    } finally {
      setBusy(false)
    }
  }

  const disconnect = (): void => {
    if (window.confirm(t('disconnectConfirm'))) void act('disconnect')
  }

  const repairOAuth = (): void => {
    if (window.confirm(t('repairConfirm'))) void act('repair-oauth')
  }

  const copyCode = async (code: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
    } catch (reason) {
      setError(messageOf(reason))
    }
  }

  const connected = status?.connected === true
  const hasCredential = status?.credentialKind !== undefined
  const notices = status?.attempt.notices ?? []
  const statusLabel = connected
    ? t('connected')
    : running
      ? t('connecting')
      : status?.credentialKind === 'api-key'
        ? t('apiKeyRecord')
        : t('disconnected')

  return h('div', {
    style: {
      borderTop: '1px solid var(--dsw-alias-border-l2, #ddd)',
      marginTop: 12,
      paddingTop: 12,
      display: 'grid',
      gap: 10,
    },
  },
  h('strong', null, t('title')),
  h('p', {
    style: { margin: 0, color: 'var(--dsw-alias-text-secondary, #666)' },
  }, t('description')),
  h('div', null,
    h('strong', null, statusLabel),
    h('p', {
      style: { margin: '6px 0 0', color: 'var(--dsw-alias-text-secondary, #666)' },
    }, t('routeExplanation')),
  ),
  status?.flow !== undefined && !status.flow.oauthAvailable
    ? h('p', { style: { margin: 0, color: '#b91c1c' } }, t('unavailable'))
    : null,
  status?.apiKeyOverride.active
    ? h('div', {
        style: {
          border: '1px solid #b7791f',
          borderRadius: 8,
          padding: 10,
          background: 'color-mix(in srgb, #b7791f 10%, transparent)',
        },
      },
      h('strong', null, status.apiKeyOverride.configured ? t('apiKeyConfigured') : t('apiKeyWarning')),
      h('button', {
        type: 'button',
        style: { ...buttonStyle, marginLeft: 10 },
        disabled: busy || !status.writable.settings,
        onClick: repairOAuth,
      }, busy ? t('working') : t('repair')),
    )
    : null,
  status !== undefined && !status.writable.credential && hasCredential
    ? h('p', { style: { margin: 0, color: '#b91c1c' } }, t('readOnly'))
    : null,
  h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
    connected || hasCredential
      ? h('button', {
          type: 'button',
          style: buttonStyle,
          disabled: busy || status?.writable.credential === false,
          onClick: disconnect,
        }, busy ? t('working') : t('disconnect'))
      : h('button', {
          type: 'button',
          style: buttonStyle,
          disabled: busy || running || status?.flow?.oauthAvailable === false,
          onClick: () => { void act('begin') },
        }, busy || running ? t('working') : t('connect')),
    running
      ? h('button', {
          type: 'button',
          style: buttonStyle,
          disabled: busy,
          onClick: () => { void act('cancel') },
        }, t('cancel'))
      : null,
    h('button', {
      type: 'button',
      style: buttonStyle,
      disabled: busy,
      onClick: () => { void refresh() },
    }, t('refresh')),
  ),
  ...notices.map((notice, index) => {
    const url = safeHttpsUrl(notice.url)
    return h('div', {
      key: `${index}:${notice.code ?? notice.message}`,
      style: {
        border: '1px solid var(--dsw-alias-border-l2, #ddd)',
        borderRadius: 8,
        padding: 10,
      },
    },
    h('div', null, notice.message),
    url === undefined
      ? null
      : h('a', {
          href: url,
          target: '_blank',
          rel: 'noopener noreferrer',
          style: { display: 'inline-block', marginTop: 8 },
        }, t('openAuthorization')),
    notice.code === undefined
      ? null
      : h('div', {
          style: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 },
        },
        h('code', { style: { fontSize: 18 } }, notice.code),
        h('button', {
          type: 'button',
          style: buttonStyle,
          onClick: () => { void copyCode(notice.code!) },
        }, copiedCode === notice.code ? t('copied') : t('copyCode')),
      ),
    )
  }),
  status?.attempt.error
    ? h('p', { style: { margin: 0, color: '#b91c1c' } }, `${t('error')}: ${status.attempt.error}`)
    : null,
  error
    ? h('p', { style: { margin: 0, color: '#b91c1c' } }, `${t('error')}: ${error}`)
    : null,
  )
}

function ProviderCardExtension(props: CardProps): unknown {
  if (props.provider.provider !== 'xai') return null
  return h(XaiOAuthCard, props)
}

export function apply(ctx: any): void {
  ctx.effect(
    () => ctx.locale.register(LOCALE_NS, 'en', dictionaries.en),
    'dsh-xai-oauth: English dictionary',
  )
  ctx.effect(
    () => ctx.locale.register(LOCALE_NS, 'zh', dictionaries.zh),
    'dsh-xai-oauth: Chinese dictionary',
  )

  ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({
    name: 'settings.models.provider-card',
    key: 'llm-pi-ai',
    locale: LOCALE_NS,
  }, (props: ProviderCardExtrasOwnerProps & { t: Translate }) => h(ProviderCardExtension, {
    ...props,
    connection: ctx.connection,
  })))
}
