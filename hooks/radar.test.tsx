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
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('a subagent shows with its color, its action in plain words and its cost', async ($, on) => {
  on('command.register', () => ({ value: { command: 'radar' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('agent.list', () => ({
    value: [{ id: 'a1', type: 'Explore', description: 'Cartographier le module auth', status: 'running' }],
  }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const anyTurn = ($ as unknown as { turn: Record<string, (e: unknown) => Promise<unknown>> }).turn
  await anyTurn.start!({ text: 'Analyse mon projet', turnId: 't0' })
  await $.tool.call({ tool: 'Read', file_path: '/repo/src/auth.ts' })
  await anyTurn.start!({ text: 'mission', turnId: 't1', agentId: 'a1' })
  await $.tool.call({ tool: 'Grep', pattern: 'login', agentId: 'a1' })

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Explore/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Cherche « login » dans le code/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Cartographier le module auth/ })).toBeDefined()
    await ui.unmount()
  }

  await anyTurn.complete!({
    answer: 'ok',
    durationMs: 12_000,
    isAborted: false,
    turnId: 't1',
    agentId: 'a1',
    reason: 'answer',
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /terminé/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /a terminé en 12 s/ })).toBeDefined()
  await ui.unmount()
})
