import { describe, expect, it } from 'vitest'
import { AuthorizationJournal } from '../src/journal.js'

describe('AuthorizationJournal', () => {
  it('publishes notices and resolves an answer without retaining it', async () => {
    const journal = new AuthorizationJournal()
    journal.start()
    journal.notify({ message: 'Open the authorization page', url: 'https://accounts.x.ai', code: 'ABC' })
    const answer = journal.prompt({ kind: 'secret', message: 'Paste the device code' })

    const prompt = journal.snapshot().prompt
    expect(prompt?.kind).toBe('secret')
    expect(journal.snapshot().notices).toHaveLength(1)
    journal.answer(prompt!.id, 'never persisted')

    await expect(answer).resolves.toBe('never persisted')
    expect(journal.snapshot().prompt).toBeUndefined()
    expect(JSON.stringify(journal.snapshot())).not.toContain('never persisted')
  })

  it('rejects stale prompt answers', () => {
    const journal = new AuthorizationJournal()
    journal.start()
    expect(() => journal.answer('1', 'value')).toThrow('Unknown or expired')
  })

  it('cancels and forgets a pending prompt', async () => {
    const journal = new AuthorizationJournal()
    journal.start()
    const answer = journal.prompt({ kind: 'text', message: 'Value?' })

    journal.cancel()

    await expect(answer).rejects.toThrow('cancelled')
    expect(journal.snapshot().prompt).toBeUndefined()
    expect(JSON.stringify(journal.snapshot())).not.toContain('Value?')
  })

  it('refuses concurrent authorization attempts', () => {
    const journal = new AuthorizationJournal()
    journal.start()

    expect(() => journal.start()).toThrow('already running')
  })
})
