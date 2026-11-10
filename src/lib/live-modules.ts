// Server-side helpers shared by the live-quiz and live-poll site module APIs.
import { getModuleDefinition } from "@/lib/site-builder/modules"

type FeatureEntry = { moduleId?: string; enabled?: boolean; config?: Record<string, unknown> | null }

/**
 * Effective config of a site module: the config stored on the site's enabledFeatures entry,
 * layered over the registry defaults. Returns null when the module is not enabled.
 */
export function getEnabledModuleConfig(enabledFeatures: unknown, moduleId: string): Record<string, unknown> | null {
  const features = Array.isArray(enabledFeatures) ? (enabledFeatures as FeatureEntry[]) : []
  const entry = features.find((f) => f?.moduleId === moduleId && f.enabled)
  if (!entry) return null
  return { ...(getModuleDefinition(moduleId)?.defaultConfig ?? {}), ...(entry.config ?? {}) }
}

// ---------------------------------------------------------------------------
// Live quiz
// ---------------------------------------------------------------------------

/**
 * Remove the answer key from a stored quiz definition before it leaves the server for a
 * participant or anonymous visitor. Everything else (title, options, points, time limits)
 * is kept so the participant UI can render the quiz.
 */
export function stripQuizAnswers<T>(data: T): T {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data
  const quiz = data as Record<string, unknown>
  if (!Array.isArray(quiz.questions)) return data
  return {
    ...quiz,
    questions: quiz.questions.map((q) => {
      if (!q || typeof q !== "object") return q
      const rest = { ...(q as Record<string, unknown>) }
      delete rest.correctAnswer
      return rest
    }),
  } as T
}

// ---------------------------------------------------------------------------
// Live poll
// ---------------------------------------------------------------------------

/** httpOnly cookie that identifies an anonymous voter (only used when a poll allows guests). */
export const POLL_VOTER_COOKIE = "ef_poll_voter"
const ANON_VOTER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Stable identity of a voter: the signed-in user, else the anonymous voter cookie. */
export function getPollVoterKey(userId?: string | null, anonVoterId?: string | null): string | null {
  if (userId) return `user:${userId}`
  if (anonVoterId && ANON_VOTER_ID.test(anonVoterId)) return `anon:${anonVoterId}`
  return null
}

/**
 * Value stored in FeatureModuleData.uniqueKey for a vote. The column is unique, so the
 * database rejects a second ballot from the same voter on the same poll (or, when the poll
 * allows voting for several options, on the same option).
 */
export function pollVoteUniqueKey(pollId: string, voterKey: string, optionIndex?: number): string {
  const base = `live-poll:${pollId}:${voterKey}`
  return optionIndex === undefined ? base : `${base}:opt${optionIndex}`
}

/** Whether a new ballot conflicts with the options this voter already picked on the poll. */
export function isDuplicateVote(previousOptions: number[], optionIndex: number, allowMultipleVotes: boolean): boolean {
  return allowMultipleVotes ? previousOptions.includes(optionIndex) : previousOptions.length > 0
}
