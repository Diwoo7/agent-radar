import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'agent-radar',
  component: 'Pane',
  requestId: 'agent-radar',
  props: {
    title: 'Agent Radar',
    isFocused: false,
    bodyColumns: 56,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

type Raise = Record<string, (e: unknown) => Promise<unknown>>

test('a subagent shows under Claude, in plain words, with its cost, and the task ends in a recap', async ($, on) => {
  const opened: string[] = []
  on('command.register', () => ({ value: { command: 'radar' } }))
  on('ui.open', (_, e) => {
    opened.push((e as { id: string }).id)
    return { value: { isPlaced: true } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('agent.list', () => ({
    value: [{ id: 'a1', type: 'Explore', description: 'Cartographier le module auth', status: 'running' }],
  }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('audio.play', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))

  await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true })
  // Smart open: nothing opens before work starts.
  expect(opened.length).toBe(0)

  const turn = ($ as unknown as { turn: Raise }).turn
  await turn.start!({ text: 'Analyse mon projet', turnId: 't0' })
  expect(opened).toEqual(['agent-radar'])

  await $.tool.call({ tool: 'Read', file_path: '/repo/src/auth.ts' })
  await turn.start!({ text: 'mission', turnId: 't1', agentId: 'a1' })
  await $.tool.call({ tool: 'Grep', pattern: 'login', agentId: 'a1' })

  const session = ($ as unknown as { session: Raise }).session
  await session.measure!({
    context: { tokens: 84_000, window: 200_000, percent: 42 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 23.5 }],
    cost: { usd: 0.31 },
    changed: ['context'],
  })

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Explore/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Cherche « login » dans le code/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Contexte de la conversation/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Quota 5 h/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /↳/ })).toBeDefined()
    await ui.unmount()
  }

  await turn.complete!({
    answer: 'ok', durationMs: 12_000, isAborted: false, turnId: 't1', agentId: 'a1', reason: 'answer',
  })
  await turn.complete!({ answer: 'ok', durationMs: 30_000, isAborted: false, turnId: 't0', reason: 'answer' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /a terminé en 12 s/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Bilan de la dernière tâche/ })).toBeDefined()
  expect(await ui.find({ key: 'recap-export' })).toBeDefined()
  expect(await ui.find({ key: 'view-a1' })).toBeDefined()
  await ui.unmount()

  // The pane was opened once, not at every turn.
  await turn.start!({ text: 'encore', turnId: 't2' })
  expect(opened.length).toBe(1)
})

type TestOn = Parameters<Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>>[1]

function engineStubs(on: TestOn) {
  on('command.register', () => ({ value: { command: 'radar' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
}

test('in auto, the pane follows the language of the request', async ($, on) => {
  engineStubs(on)
  await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true })
  const turn = ($ as unknown as { turn: Raise }).turn
  await turn.start!({ text: 'Can you please review the code in this repo for me?', turnId: 't0' })
  await $.tool.call({ tool: 'Read', file_path: '/repo/src/auth.ts' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Reads auth\.ts/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Progress$/ })).toBeDefined()
  expect(await ui.find({ key: 'reset' })).toBeDefined()
  await ui.unmount()
})

test('the language picked in the settings wins over the request', { options: { language: 'nl' } }, async ($, on) => {
  engineStubs(on)
  await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true })
  const turn = ($ as unknown as { turn: Raise }).turn
  await turn.start!({ text: 'Fais-moi une analyse complète du projet, je veux tout comprendre', turnId: 't0' })
  await $.tool.call({ tool: 'Grep', pattern: 'login' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Zoekt „login” in de code/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Voortgang$/ })).toBeDefined()
  await ui.unmount()
})
