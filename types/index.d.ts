export type AgentStatus = 'running' | 'done' | 'error' | 'idle'

export type AgentCard = {
  id: string
  label: string
  type: string
  description: string
  color: string
  status: AgentStatus
  order: number
  /** The agent that spawned it; absent for the main agent. */
  parentId?: string
  startedAt: number
  endedAt?: number
  action: string
  actions: number
  model?: string
  tokensIn: number
  tokensOut: number
  cacheRead: number
  cacheWrite: number
  costUsd: number
}

export type FeedItem = {
  id: string
  at: number
  agentId: string
  text: string
  isDone: boolean
}

export type TaskItem = {
  id: string
  subject: string
  status: 'pending' | 'in_progress' | 'completed'
}

export type RadarSession = {
  startedAt: number
  isLive: boolean
  /** The pane was opened once this session, so it is not forced open again. */
  hasAutoOpened: boolean
  cwd: string
  /** The language the pane speaks. */
  lang: 'fr' | 'en' | 'nl'
  /** Where that language came from: the plugin's setting, Claude's setting or locale, the person's prompt, or the default. */
  langSource: 'config' | 'setting' | 'prompt' | 'default'
}

export type RateWindow = { kind: string; percentUsed: number; resetsAt?: string }

/** The engine's own measurement: context window fill, plan quota, real cost. */
export type Measure = {
  at: number
  contextPercent?: number
  contextTokens?: number
  window: number
  rateLimits: RateWindow[]
  costUsd?: number
}

/** Where the main turn started from, to tell what the turn itself added. */
export type TurnBase = {
  at: number
  prompt: string
  actions: number
  tokens: number
  usd: number
  /** Each agent's action count at the turn's start. */
  perAgent: Record<string, number>
}

export type RecapAgent = { label: string; color: string; actions: number }

/** The last finished task, as a shareable card. */
export type Recap = {
  at: number
  prompt: string
  durationMs: number
  actions: number
  tokens: number
  usd: number
  agents: RecapAgent[]
}

declare module 'claude-code' {
  interface PluginState {
    'agent-radar': {
      agents: Shaped<Record<string, AgentCard>>
      feed: Shaped<FeedItem[]>
      tasks: Shaped<TaskItem[]>
      session: Shaped<RadarSession>
      measure: Shaped<Measure>
      turnBase: Shaped<TurnBase>
      recap: Shaped<Recap | null>
      liveTape: Shaped<Tape | null>
      lastTape: Shaped<Tape | null>
      replay: Shaped<Replay>
    }
  }
}

/** One change recorded during a task, at `t` (epoch ms). */
export type TapeEvent =
  | { t: number; kind: 'agent'; card: AgentCard }
  | { t: number; kind: 'feed'; item: FeedItem }
  | { t: number; kind: 'feedDone'; id: string }
  | { t: number; kind: 'tasks'; tasks: TaskItem[] }

/** A task as it happened: where it started from, and every change after. */
export type Tape = {
  startedAt: number
  endedAt?: number
  agents: Record<string, AgentCard>
  tasks: TaskItem[]
  events: TapeEvent[]
}

/** Playback of the last tape: the virtual time is `offsetMs + (now - wallStart) * speed` while playing. */
export type Replay = {
  isActive: boolean
  isPlaying: boolean
  speed: number
  wallStart: number
  offsetMs: number
  frame: number
}
