export type AgentStatus = 'running' | 'done' | 'error' | 'idle'

export type AgentCard = {
  id: string
  label: string
  type: string
  description: string
  color: string
  status: AgentStatus
  order: number
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

export type RadarSession = { startedAt: number; isLive: boolean }

declare module 'claude-code' {
  interface PluginState {
    'agent-radar': {
      agents: Shaped<Record<string, AgentCard>>
      feed: Shaped<FeedItem[]>
      tasks: Shaped<TaskItem[]>
      session: Shaped<RadarSession>
    }
  }
}
