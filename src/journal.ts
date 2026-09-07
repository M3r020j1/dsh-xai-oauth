import type { AuthorizationNotice, AuthorizationPrompt } from '@deepseek-ai/dsh-authorization'

export type PublicPrompt = Omit<AuthorizationPrompt, 'signal'> & { id: string }

export interface PublicAttempt {
  state: 'idle' | 'running' | 'authorized' | 'cancelled' | 'failed'
  notices: readonly AuthorizationNotice[]
  prompt?: PublicPrompt
  error?: string
}

type PendingPrompt = {
  id: string
  resolve: (value: string) => void
  reject: (reason: Error) => void
}

/**
 * Keeps only browser-safe authorization progress. In particular, answers are
 * passed straight to the provider flow and are never retained or logged.
 */
export class AuthorizationJournal {
  #state: PublicAttempt['state'] = 'idle'
  #notices: AuthorizationNotice[] = []
  #prompt?: PublicPrompt
  #pending?: PendingPrompt
  #sequence = 0
  #error?: string

  start(): void {
    if (this.#state === 'running') throw new Error('An authorization attempt is already running')
    this.#state = 'running'
    this.#notices = []
    this.#prompt = undefined
    this.#pending = undefined
    this.#error = undefined
  }

  notify(notice: AuthorizationNotice): void {
    if (this.#state !== 'running') return
    this.#notices.push({ ...notice })
  }

  prompt(prompt: AuthorizationPrompt): Promise<string> {
    if (this.#state !== 'running') return Promise.reject(new Error('Authorization is not running'))
    if (this.#pending !== undefined) return Promise.reject(new Error('The previous authorization prompt has not been answered'))

    const id = String(++this.#sequence)
    this.#prompt = { ...prompt, id }
    return new Promise<string>((resolve, reject) => {
      this.#pending = { id, resolve, reject }
      prompt.signal?.addEventListener('abort', () => {
        if (this.#pending?.id !== id) return
        this.#pending = undefined
        this.#prompt = undefined
        reject(new Error('Authorization prompt was withdrawn'))
      }, { once: true })
    })
  }

  answer(id: string, value: string): void {
    const pending = this.#pending
    if (pending === undefined || pending.id !== id) throw new Error('Unknown or expired authorization prompt')
    this.#pending = undefined
    this.#prompt = undefined
    pending.resolve(value)
  }

  cancel(): void {
    this.#pending?.reject(new Error('Authorization was cancelled'))
    this.#pending = undefined
    this.#prompt = undefined
  }

  reset(): void {
    this.#state = 'idle'
    this.#notices = []
    this.#prompt = undefined
    this.#pending = undefined
    this.#error = undefined
  }

  settle(state: Exclude<PublicAttempt['state'], 'idle' | 'running'>, error?: string): void {
    this.#state = state
    this.#error = error
    this.#pending = undefined
    this.#prompt = undefined
  }

  snapshot(): PublicAttempt {
    return {
      state: this.#state,
      notices: this.#notices.map(notice => ({ ...notice })),
      ...(this.#prompt === undefined ? {} : { prompt: { ...this.#prompt } }),
      ...(this.#error === undefined ? {} : { error: this.#error }),
    }
  }
}
