import NextAuth from "next-auth"
import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import type { Role } from "@/lib/constants"

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma) as NextAuthConfig["adapter"],
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  pages: {
    signIn: "/login",
    error: "/login?error=true",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: false,
    }),
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: false,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = (credentials.email as string).toLowerCase().trim()
        const password = credentials.password as string

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
          },
        })

        if (!user || !user.passwordHash) {
          return null
        }

        if (!user.isActive) {
          throw new Error("ACCOUNT_INACTIVE")
        }

        if (user.isBanned) {
          throw new Error("ACCOUNT_BANNED")
        }

        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED")
        }

        const isValidPassword = await bcrypt.compare(password, user.passwordHash)
        if (!isValidPassword) {
          return null
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
      if (account?.provider === "credentials") {
        return true
      }

      // OAuth sign-in
      if (account && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        })

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
      if (user) {
        token.id = user.id!
        token.role = (user as { role: Role }).role || "USER"
        token.avatar = (user as { avatar?: string | null }).avatar
        token.lastRefreshed = Date.now()
      }

      // Refresh user data every 5 minutes
      const lastRefreshed = token.lastRefreshed as number | undefined
      if (trigger !== "signIn" && lastRefreshed) {
        const fiveMinutes = 5 * 60 * 1000
        if (Date.now() - lastRefreshed > fiveMinutes) {
          const freshUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, name: true, email: true, avatar: true, isActive: true },
          })

          if (freshUser && freshUser.isActive) {
            token.role = freshUser.role as Role
            token.name = freshUser.name
            token.email = freshUser.email
            token.avatar = freshUser.avatar
            token.lastRefreshed = Date.now()
          }
        }
      }

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
