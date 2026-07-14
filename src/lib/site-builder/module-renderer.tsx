"use client"

import dynamic from "next/dynamic"
import { Component, type ErrorInfo, type ReactNode } from "react"

export interface ModuleProps {
  config: Record<string, any>
  orgSlug: string
  eventId?: string
  placement: string
  isPreview?: boolean
}

const MODULE_MAP: Record<string, React.ComponentType<ModuleProps>> = {
  "live-quiz": dynamic(() => import("@/components/site-modules/live-quiz/LiveQuizModule")),
  "live-poll": dynamic(() => import("@/components/site-modules/live-poll/LivePollModule")),
  "countdown-timer": dynamic(() => import("@/components/site-modules/countdown-timer/CountdownTimerModule")),
  "leaderboard": dynamic(() => import("@/components/site-modules/leaderboard/LeaderboardModule")),
  "photo-gallery": dynamic(() => import("@/components/site-modules/photo-gallery/PhotoGalleryModule")),
  "blog-posts": dynamic(() => import("@/components/site-modules/blog-posts/BlogPostsModule")),
  "sponsor-showcase": dynamic(() => import("@/components/site-modules/sponsor-showcase/SponsorShowcaseModule")),
  "team-profiles": dynamic(() => import("@/components/site-modules/team-profiles/TeamProfilesModule")),
  "event-calendar-widget": dynamic(() => import("@/components/site-modules/event-calendar/EventCalendarModule")),
  "volunteer-signup": dynamic(() => import("@/components/site-modules/volunteer-signup/VolunteerSignupModule")),
  "merchandise-store": dynamic(() => import("@/components/site-modules/merchandise-store/MerchStoreModule")),
  "weather-widget": dynamic(() => import("@/components/site-modules/weather-widget/WeatherWidgetModule")),
}

const ADMIN_MAP: Record<string, React.ComponentType<ModuleProps>> = {
  "live-quiz": dynamic(() => import("@/components/site-modules/live-quiz/LiveQuizAdmin")),
  "live-poll": dynamic(() => import("@/components/site-modules/live-poll/LivePollAdmin")),
  "leaderboard": dynamic(() => import("@/components/site-modules/leaderboard/LeaderboardAdmin")),
  "photo-gallery": dynamic(() => import("@/components/site-modules/photo-gallery/PhotoGalleryAdmin")),
  "blog-posts": dynamic(() => import("@/components/site-modules/blog-posts/BlogPostsAdmin")),
  "sponsor-showcase": dynamic(() => import("@/components/site-modules/sponsor-showcase/SponsorShowcaseAdmin")),
  "team-profiles": dynamic(() => import("@/components/site-modules/team-profiles/TeamProfilesAdmin")),
  "volunteer-signup": dynamic(() => import("@/components/site-modules/volunteer-signup/VolunteerSignupAdmin")),
  "merchandise-store": dynamic(() => import("@/components/site-modules/merchandise-store/MerchStoreAdmin")),
}

class ModuleErrorBoundary extends Component<{ children: ReactNode; moduleId: string }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(`Module ${this.props.moduleId} error:`, error, info) }
  render() {
    if (this.state.hasError) return <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm text-center">Module failed to load</div>
    return this.props.children
  }
}

interface ModuleRendererProps { moduleId: string; config: Record<string, any>; orgSlug: string; eventId?: string; placement: string; isPreview?: boolean }

export function ModuleRenderer({ moduleId, config, orgSlug, eventId, placement, isPreview }: ModuleRendererProps) {
  const Comp = MODULE_MAP[moduleId]
  if (!Comp) return isPreview ? <div className="p-4 text-center text-sm text-muted-foreground">Module &quot;{moduleId}&quot; not found</div> : null
  return <ModuleErrorBoundary moduleId={moduleId}><Comp config={config} orgSlug={orgSlug} eventId={eventId} placement={placement} isPreview={isPreview} /></ModuleErrorBoundary>
}

export function ModuleAdminRenderer({ moduleId, config, orgSlug, eventId, placement, isPreview }: ModuleRendererProps) {
  const Comp = ADMIN_MAP[moduleId]
  if (!Comp) return <div className="p-4 text-center text-sm text-muted-foreground">No admin panel for &quot;{moduleId}&quot;</div>
  return <ModuleErrorBoundary moduleId={moduleId}><Comp config={config} orgSlug={orgSlug} eventId={eventId} placement={placement} isPreview={isPreview} /></ModuleErrorBoundary>
}
