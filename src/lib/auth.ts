import NextAuth, { CredentialsSignin } from "next-auth"
import type { NextAuthConfig } from "next-auth"
import type { Provider } from "next-auth/providers"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import type { Role } from "@/lib/constants"
import { verifyOTP } from "@/lib/auth-helpers"
import { tooManyAttemptsCode, type SignInErrorCodeValue } from "@/lib/auth-errors"
import { rateLimiter, RATE_LIMITS } from "@/lib/rate-limiter"
import { getClientInfo } from "@/lib/audit"
import { signedInBeforePasswordChange } from "@/lib/password-change"
import {
  DEFAULT_PLATFORM_SETTINGS,
  MAX_SESSION_SECONDS,
  sessionTimedOut,
  signInNeedsVerifiedEmail,
  type PlatformSettings,
} from "@/lib/platform-settings"

/**
 * The platform settings that shape signing in (lockout, session timeout, email
 * verification, OAuth switches). A failed read falls back to the defaults rather than
 * blocking every sign-in.
 */
async function platformSettings(): Promise<PlatformSettings> {
  try {
    const { getActivePlatformSettings } = await import("@/lib/platform-settings-store")
    return await getActivePlatformSettings()
  } catch (error) {
    console.error("Reading platform settings for sign-in failed; using the defaults", error)
    return DEFAULT_PLATFORM_SETTINGS
  }
}

/**
 * Thrown from `authorize` so the reason reaches the client: Auth.js passes a
 * CredentialsSignin's `code` through as `result.code` (any other throw turns into an
 * opaque "Configuration" error). Only thrown after the password or one-time code has
 * been checked, or for a rate limit that applies the same to every email, so it never
 * tells someone who can't sign in anything about the account.
 */
class SignInCodeError extends CredentialsSignin {
  constructor(code: SignInErrorCodeValue) {
    super()
    this.code = code
  }
}

/**
 * Failed password sign-ins are counted per email and per client IP (in memory, per server
 * instance). Unknown emails count the same as real ones, so the limit says nothing about
 * which accounts exist; a successful sign-in clears its email's count.
 *
 * Per email, Settings → Security applies: "Max login attempts" failures within "Lockout
 * duration" lock the email, and the lockout lasts that long from the failure that hit the
 * limit. The per-IP ceiling stays fixed (RATE_LIMITS.authPerIp).
 */
const failedLoginKeys = (email: string, ip: string) => ({
  email: `login-failed:email:${email}`,
  ip: `login-failed:ip:${ip}`,
})

interface LoginLimits { attempts: number; lockoutMs: number }

function loginLimits(settings: PlatformSettings): LoginLimits {
  return { attempts: settings.security.maxLoginAttempts, lockoutMs: settings.security.lockoutMinutes * 60 * 1000 }
}

async function loginLockout(email: string, ip: string, limits: LoginLimits): Promise<SignInErrorCodeValue | null> {
  const keys = failedLoginKeys(email, ip)
  const byEmail = await rateLimiter.peek(keys.email, limits.attempts)
  const byIp = await rateLimiter.peek(keys.ip, RATE_LIMITS.authPerIp.limit)
  const retryAfter = Math.max(byEmail.allowed ? 0 : byEmail.retryAfter ?? 0, byIp.allowed ? 0 : byIp.retryAfter ?? 0)
  return byEmail.allowed && byIp.allowed ? null : tooManyAttemptsCode(retryAfter)
}

async function recordFailedLogin(email: string, ip: string, limits: LoginLimits) {
  const keys = failedLoginKeys(email, ip)
  const byEmail = await rateLimiter.check(keys.email, limits.attempts, limits.lockoutMs)
  // this failure reached the limit: the lockout runs its full length from now
  if (byEmail.allowed && byEmail.remaining === 0) await rateLimiter.hold(keys.email, limits.lockoutMs)
  await rateLimiter.check(keys.ip, RATE_LIMITS.authPerIp.limit, RATE_LIMITS.authPerIp.windowMs)
}

/**
 * A bcrypt hash of a random value. Compared against when the email has no password, so
 * the response takes as long as a real check and doesn't reveal which emails exist.
 */
const NO_ACCOUNT_HASH = "$2b$12$GIY5VwLFY2nMHZ57tfSz2eCGDwjpYBXZ21jThGNIltwM.kio3yHFi"

/**
 * OAuth providers are registered only when their credentials are set. The login and
 * signup pages read /api/auth/providers and offer just the ones that exist.
 */
function socialProviders(): Provider[] {
  const providers: Provider[] = []
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: false,
      }),
    )
  }
  if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    providers.push(
      MicrosoftEntraID({
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: false,
      }),
    )
  }
  return providers
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma) as NextAuthConfig["adapter"],
  // The cookie may live as long as the longest timeout the settings allow; the jwt callback
  // (and the middleware) end a session after Settings → Security → Session timeout.
  session: { strategy: "jwt", maxAge: MAX_SESSION_SECONDS },
  pages: {
    signIn: "/login",
    // Auth.js appends ?error=<type>; the login page shows a message for it
    error: "/login",
  },
  providers: [
    ...socialProviders(),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = (credentials.email as string).toLowerCase().trim()
        const password = credentials.password as string
        const { ipAddress } = getClientInfo(request)
        const settings = await platformSettings()
        const limits = loginLimits(settings)

        // While locked out, every attempt (even the right password) is refused the same way
        const lockout = await loginLockout(email, ipAddress, limits)
        if (lockout) throw new SignInCodeError(lockout)

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
            isActive: true,
            isBanned: true,
            avatar: true,
            emailVerified: true,
            deletedAt: true,
          },
        })

        // Check the password before anything about the account, so a wrong password reads
        // the same whether the email is unknown, suspended or unverified
        const isValidPassword = await bcrypt.compare(password, user?.passwordHash ?? NO_ACCOUNT_HASH)
        if (!user || !user.passwordHash || user.deletedAt || !isValidPassword) {
          await recordFailedLogin(email, ipAddress, limits)
          return null
        }

        if (!user.isActive) {
          throw new SignInCodeError("ACCOUNT_INACTIVE")
        }

        if (user.isBanned) {
          throw new SignInCodeError("ACCOUNT_BANNED")
        }

        // Settings → Email verification required (on by default; never for a super admin)
        if (!user.emailVerified && signInNeedsVerifiedEmail(user.role, settings)) {
          throw new SignInCodeError("EMAIL_NOT_VERIFIED")
        }

        await rateLimiter.reset(failedLoginKeys(email, ipAddress).email)

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
          avatar: user.avatar,
          isActive: user.isActive,
          isBanned: user.isBanned,
        }
      },
    }),
    Credentials({
      id: "otp",
      name: "otp",
      credentials: {
        email: { label: "Email", type: "email" },
        otp: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.otp) {
          return null
        }

        const email = (credentials.email as string).toLowerCase().trim()
        const otp = credentials.otp as string

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true, email: true, name: true, role: true,
            isActive: true, isBanned: true, avatar: true, emailVerified: true, deletedAt: true,
          },
        })

        if (!user || user.deletedAt) return null

        // The code is the credential: check it before saying anything about the account
        const result = await verifyOTP({ email, code: otp, purpose: "LOGIN" })
        if (!result.valid) {
          if (result.reason === "expired") throw new SignInCodeError("OTP_EXPIRED")
          if (result.reason === "too_many_attempts") throw new SignInCodeError("OTP_ATTEMPTS")
          return null
        }

        if (!user.isActive) throw new SignInCodeError("ACCOUNT_INACTIVE")
        if (user.isBanned) throw new SignInCodeError("ACCOUNT_BANNED")
        if (!user.emailVerified && signInNeedsVerifiedEmail(user.role, await platformSettings())) {
          throw new SignInCodeError("EMAIL_NOT_VERIFIED")
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
          avatar: user.avatar,
          isActive: user.isActive,
          isBanned: user.isBanned,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "credentials" || account?.provider === "otp") {
        return true
      }

      // OAuth sign-in. Platform settings → Features: each provider can be switched off, and
      // with "User registration" off only existing accounts may sign in this way.
      const { features } = await platformSettings()
      if (account?.provider === "google" && !features.googleOAuth) return false
      if (account?.provider === "microsoft-entra-id" && !features.microsoftOAuth) return false

      if (account && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        })
        if (!existingUser && !features.userRegistration) return false

        if (existingUser) {
          if (!existingUser.isActive) return false
          if (existingUser.isBanned) return false

          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              lastLoginAt: new Date(),
              emailVerified: existingUser.emailVerified || new Date(),
              avatar: existingUser.avatar || user.image,
            },
          })
        }
      }

      return true
    },
    async jwt({ token, user, trigger }) {
      const now = Date.now()
      if (user) {
        token.id = user.id!
        token.role = (user as { role: Role }).role || "USER"
        token.avatar = (user as { avatar?: string | null }).avatar
        token.lastRefreshed = now
        // When this session signed in. Not `iat`: Auth.js re-issues the token (new iat) on
        // every session read, so only our own claim survives to compare with a password change.
        token.authTime = now
        token.lastActive = now
        return token
      }
      if (trigger === "signIn" || !token.id) return token

      // Settings → Security → Session timeout: idle longer than that and the session ends
      // (null clears the session cookie)
      const lastActive = (token.lastActive ?? token.authTime) as number | undefined
      if (sessionTimedOut(lastActive, await platformSettings(), now)) return null

      // The account's status is read on every session check, so a ban, deactivation or
      // deletion ends the session on the next request rather than at the next refresh.
      // The rest of the profile (role, name, avatar, password-change check) refreshes every
      // 5 minutes, and at once when the client calls session.update() (the profile page
      // after saving). Only the database is trusted: the update() payload is ignored.
      const lastRefreshed = token.lastRefreshed as number | undefined
      const refresh = trigger === "update" || (!!lastRefreshed && now - lastRefreshed > 5 * 60 * 1000)
      const freshUser = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { role: true, name: true, email: true, avatar: true, isActive: true, isBanned: true, deletedAt: true, metadata: true },
      })
      if (!freshUser || !freshUser.isActive || freshUser.isBanned || freshUser.deletedAt) {
        return null
      }

      if (refresh) {
        // A session that signed in before the password was last reset or changed ends too
        if (signedInBeforePasswordChange(token.authTime as number | undefined, freshUser.metadata)) {
          return null
        }
        token.role = freshUser.role as Role
        token.name = freshUser.name
        token.email = freshUser.email
        token.avatar = freshUser.avatar
        token.lastRefreshed = now
      }

      token.lastActive = now
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
        session.user.avatar = token.avatar as string | null | undefined
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`
      if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  events: {
    // Organization and enterprise invitations sent before the account existed become
    // memberships at sign-in once the address is verified (see acceptPendingInvites and
    // acceptEnterprisePendingInvites). Never blocks sign-in.
    async signIn({ user }) {
      if (!user.id) return
      try {
        const account = await prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true, email: true, name: true, emailVerified: true, isActive: true, isBanned: true, deletedAt: true },
        })
        if (account?.emailVerified && account.isActive && !account.isBanned && !account.deletedAt) {
          const { acceptPendingInvites } = await import("@/lib/org-invites")
          const { acceptEnterprisePendingInvites } = await import("@/lib/enterprise-invites")
          await acceptPendingInvites(account)
          await acceptEnterprisePendingInvites(account)
        }
      } catch (error) {
        console.error("Accepting pending invitations at sign-in failed:", error)
      }
    },
    async createUser({ user }) {
      if (user.email) {
        await prisma.user.update({
          where: { email: user.email },
          data: { emailVerified: new Date() },
        })
      }
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
