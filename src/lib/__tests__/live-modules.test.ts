import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"

const prismaMock = vi.hoisted(() => ({
  featureModuleData: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  siteConfig: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}))
const authMock = vi.hoisted(() => vi.fn())
const authorizeMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/authorization", () => ({ authorize: authorizeMock }))

import {
  POLL_VOTER_COOKIE,
  getEnabledModuleConfig,
  getPollVoterKey,
  isDuplicateVote,
  pollVoteUniqueKey,
  stripQuizAnswers,
} from "@/lib/live-modules"
import * as quizListRoute from "@/app/api/modules/live-quiz/quizzes/route"
import * as quizRoute from "@/app/api/modules/live-quiz/quizzes/[quizId]/route"
import * as quizCheckRoute from "@/app/api/modules/live-quiz/quizzes/[quizId]/check/route"
import * as voteRoute from "@/app/api/modules/live-poll/polls/[pollId]/vote/route"

const ORG = "org_a"
const ADMIN = "user_admin"
const PARTICIPANT = "user_participant"

const QUIZ = {
  id: "quiz_1",
  title: "Trivia",
  data: {
    title: "Trivia",
    questions: [
      { id: "q1", question: "2+2?", options: ["3", "4"], correctAnswer: 1, points: 10 },
      { id: "q2", question: "Red planet?", options: ["Mars", "Venus"], correctAnswer: 0, points: 5 },
    ],
  },
  isPublished: true,
  isActive: true,
  participantCount: 0,
  organizationId: ORG,
  createdAt: new Date(),
}

const POLL = {
  id: "poll_1",
  data: { question: "Best day?", options: [{ text: "Fri", votes: 0 }, { text: "Sat", votes: 0 }] },
  organizationId: ORG,
  isActive: true,
  isPublished: true,
}

function req(url: string, method = "GET", body?: unknown, cookie?: string) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
  })
}
const ctx = <T,>(params: T) => ({ params: Promise.resolve(params) })
function signIn(userId: string | null) {
  authMock.mockResolvedValue(userId ? { user: { id: userId, name: "Voter" } } : null)
}
function enableModule(moduleId: string, config?: Record<string, unknown>) {
  prismaMock.siteConfig.findUnique.mockResolvedValue({ enabledFeatures: [{ moduleId, enabled: true, ...(config ? { config } : {}) }] })
}
function questionsOf(body: { data: { data: { questions: Record<string, unknown>[] } } }) {
  return body.data.data.questions
}

beforeEach(() => {
  vi.resetAllMocks()
  authorizeMock.mockImplementation(async (userId: string, _p: unknown, c?: { organizationId?: string }) =>
    userId === ADMIN && c?.organizationId === ORG ? { authorized: true } : { authorized: false, message: "denied" }
  )
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock))
})

describe("live module helpers", () => {
  it("strips correctAnswer from every question and keeps the rest", () => {
    const stripped = stripQuizAnswers(QUIZ.data)
    expect(stripped.questions).toEqual([
      { id: "q1", question: "2+2?", options: ["3", "4"], points: 10 },
      { id: "q2", question: "Red planet?", options: ["Mars", "Venus"], points: 5 },
    ])
    expect(QUIZ.data.questions[0].correctAnswer).toBe(1) // input not mutated
    expect(stripQuizAnswers(null)).toBeNull()
    expect(stripQuizAnswers({ title: "no questions" })).toEqual({ title: "no questions" })
  })

  it("merges stored module config over registry defaults, null when disabled", () => {
    expect(getEnabledModuleConfig([{ moduleId: "live-poll", enabled: true }], "live-poll")).toMatchObject({ requireLogin: true, allowMultipleVotes: false })
    expect(getEnabledModuleConfig([{ moduleId: "live-poll", enabled: true, config: { requireLogin: false } }], "live-poll")).toMatchObject({ requireLogin: false })
    expect(getEnabledModuleConfig([{ moduleId: "live-poll", enabled: false }], "live-poll")).toBeNull()
    expect(getEnabledModuleConfig(null, "live-poll")).toBeNull()
  })

  it("identifies voters by user, else by a well-formed anonymous cookie", () => {
    expect(getPollVoterKey("u1", "ignored")).toBe("user:u1")
    expect(getPollVoterKey(null, "0b7c1a52-3f7e-4b8e-9d55-6a1c2e3f4a5b")).toBe("anon:0b7c1a52-3f7e-4b8e-9d55-6a1c2e3f4a5b")
    expect(getPollVoterKey(null, "x:forged")).toBeNull()
    expect(getPollVoterKey(null, undefined)).toBeNull()
    expect(pollVoteUniqueKey("p", "user:u1")).toBe("live-poll:p:user:u1")
    expect(pollVoteUniqueKey("p", "user:u1", 2)).toBe("live-poll:p:user:u1:opt2")
  })

  it("allows one ballot per poll, or one per option when multiple votes are allowed", () => {
    expect(isDuplicateVote([], 0, false)).toBe(false)
    expect(isDuplicateVote([1], 0, false)).toBe(true)
    expect(isDuplicateVote([1], 0, true)).toBe(false)
    expect(isDuplicateVote([0, 1], 1, true)).toBe(true)
  })
})

describe("quiz answer key is only sent to org admins (bug 7)", () => {
  beforeEach(() => {
    enableModule("live-quiz")
    prismaMock.featureModuleData.findFirst.mockResolvedValue(QUIZ)
    prismaMock.organization.findUnique.mockResolvedValue({ id: ORG })
    prismaMock.featureModuleData.findMany.mockResolvedValue([QUIZ])
  })

  it.each([
    ["anonymous", null],
    ["a signed-in participant", PARTICIPANT],
  ])("single GET strips correctAnswer for %s", async (_label, userId) => {
    signIn(userId)
    const res = await quizRoute.GET(req("/x"), ctx({ quizId: "quiz_1" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(questionsOf(body)).toHaveLength(2)
    for (const q of questionsOf(body)) expect(q).not.toHaveProperty("correctAnswer")
  })

  it("single GET keeps correctAnswer for an org admin", async () => {
    signIn(ADMIN)
    const body = await (await quizRoute.GET(req("/x"), ctx({ quizId: "quiz_1" }))).json()
    expect(questionsOf(body)[0].correctAnswer).toBe(1)
  })

  it("single GET only serves quiz definitions", async () => {
    signIn(null)
    await quizRoute.GET(req("/x"), ctx({ quizId: "quiz_1" }))
    expect(prismaMock.featureModuleData.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "quiz_1", moduleId: "live-quiz", dataType: "quiz_definition" } })
    )
  })

  it("list GET strips answers for participants and keeps them for admins", async () => {
    signIn(PARTICIPANT)
    const pub = await (await quizListRoute.GET(req("/api/modules/live-quiz/quizzes?orgSlug=a"))).json()
    signIn(ADMIN)
    const admin = await (await quizListRoute.GET(req("/api/modules/live-quiz/quizzes?orgSlug=a&status=all"))).json()

    expect(pub.data[0].data.questions[0]).not.toHaveProperty("correctAnswer")
    expect(admin.data[0].data.questions[0].correctAnswer).toBe(1)
  })

  it("list GET with status=all (drafts + answers) is admin-only", async () => {
    signIn(null)
    const anon = await quizListRoute.GET(req("/api/modules/live-quiz/quizzes?orgSlug=a&status=all"))
    signIn(PARTICIPANT)
    const participant = await quizListRoute.GET(req("/api/modules/live-quiz/quizzes?orgSlug=a&status=all"))

    expect(anon.status).toBe(401)
    expect(participant.status).toBe(403)
    expect(prismaMock.featureModuleData.findMany).not.toHaveBeenCalled()
  })

  it("check endpoint scores one answer and reveals the right option only after it is answered", async () => {
    const right = await (await quizCheckRoute.POST(req("/x", "POST", { questionId: "q1", selectedOption: 1 }), ctx({ quizId: "quiz_1" }))).json()
    const wrong = await (await quizCheckRoute.POST(req("/x", "POST", { questionId: "q2", selectedOption: 1 }), ctx({ quizId: "quiz_1" }))).json()

    expect(right.data).toEqual({ correct: true, points: 10, correctAnswer: 1 })
    expect(wrong.data).toEqual({ correct: false, points: 0, correctAnswer: 0 })
  })

  it("check endpoint hides the right option when the quiz doesn't show correct answers", async () => {
    enableModule("live-quiz", { showCorrectAnswer: false })
    const body = await (await quizCheckRoute.POST(req("/x", "POST", { questionId: "q2", selectedOption: 1 }), ctx({ quizId: "quiz_1" }))).json()
    expect(body.data).toEqual({ correct: false, points: 0, correctAnswer: null })
  })
})

describe("poll voting is one ballot per voter per poll (bug 8)", () => {
  beforeEach(() => {
    enableModule("live-poll")
    prismaMock.featureModuleData.findFirst.mockResolvedValue(POLL)
    prismaMock.featureModuleData.findUnique.mockResolvedValue({ data: POLL.data })
    prismaMock.featureModuleData.findMany.mockResolvedValue([])
  })

  const vote = (optionIndex: unknown, cookie?: string) =>
    voteRoute.POST(req("/x", "POST", { optionIndex }, cookie), ctx({ pollId: "poll_1" }))

  it("records a signed-in user's first vote with a per-poll unique key", async () => {
    signIn(PARTICIPANT)
    const res = await vote(1)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.totalVotes).toBe(1)
    expect(prismaMock.featureModuleData.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ uniqueKey: `live-poll:poll_1:user:${PARTICIPANT}`, createdById: PARTICIPANT }),
    })
    expect(prismaMock.$queryRaw).toHaveBeenCalled() // poll row locked before the tally is rewritten
  })

  it("rejects a second vote from the same user with a friendly 409", async () => {
    signIn(PARTICIPANT)
    prismaMock.featureModuleData.findMany.mockResolvedValue([{ data: { pollId: "poll_1", optionIndex: 0 } }])

    const res = await vote(1)
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body).toMatchObject({ success: false, message: "You have already voted in this poll", data: { alreadyVoted: true } })
    expect(prismaMock.featureModuleData.create).not.toHaveBeenCalled()
  })

  it("maps a lost race on the unique key (P2002) to the same 409", async () => {
    signIn(PARTICIPANT)
    prismaMock.featureModuleData.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "6", meta: { target: ["unique_key"] } })
    )

    const res = await vote(0)

    expect(res.status).toBe(409)
    expect(prismaMock.featureModuleData.update).not.toHaveBeenCalled()
  })

  it("requires sign-in unless the site allows guest voting", async () => {
    signIn(null)
    const res = await vote(0)
    expect(res.status).toBe(401)
    expect(prismaMock.featureModuleData.create).not.toHaveBeenCalled()
  })

  it("identifies guests by an httpOnly cookie when guest voting is allowed", async () => {
    signIn(null)
    enableModule("live-poll", { requireLogin: false })

    const first = await vote(0)
    const setCookie = first.headers.get("set-cookie") ?? ""
    const voterId = setCookie.match(new RegExp(`${POLL_VOTER_COOKIE}=([^;]+)`))?.[1]

    expect(first.status).toBe(200)
    expect(setCookie).toMatch(/HttpOnly/i)
    expect(voterId).toBeTruthy()
    expect(prismaMock.featureModuleData.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ uniqueKey: `live-poll:poll_1:anon:${voterId}` }),
    })

    // Same browser again: the cookie maps to the same key, which already has a ballot.
    prismaMock.featureModuleData.findMany.mockResolvedValue([{ data: { pollId: "poll_1", optionIndex: 0 } }])
    const second = await vote(1, `${POLL_VOTER_COOKIE}=${voterId}`)
    expect(second.status).toBe(409)
  })

  it("uses a per-option key when the poll allows multiple votes", async () => {
    signIn(PARTICIPANT)
    enableModule("live-poll", { allowMultipleVotes: true })
    prismaMock.featureModuleData.findMany.mockResolvedValue([{ data: { pollId: "poll_1", optionIndex: 0 } }])

    const other = await vote(1)
    const same = await vote(0)

    expect(other.status).toBe(200)
    expect(prismaMock.featureModuleData.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ uniqueKey: `live-poll:poll_1:user:${PARTICIPANT}:opt1` }),
    })
    expect(same.status).toBe(409)
  })

  it.each([["1"], [1.5], [-1], [2], [undefined]])("rejects invalid option %s", async (optionIndex) => {
    signIn(PARTICIPANT)
    const res = await vote(optionIndex)
    expect(res.status).toBe(400)
  })
})
