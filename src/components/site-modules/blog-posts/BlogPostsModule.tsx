"use client"

import { useState, useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import { FileText, ArrowLeft, Clock, Calendar, Tag, Share2, Link2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { sanitizeHtml } from "@/lib/security"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface BlogPost {
  id: string
  title: string
  data: {
    title: string; slug: string; excerpt?: string; content?: string
    coverImage?: string; category?: string; tags?: string[]
    author?: { name: string; avatar?: string }
    publishedAt?: string; readingTime?: number
  }
  participantCount: number // used as view count
}

const SAMPLE_POSTS: BlogPost[] = [
  { id: "bp1", title: "Getting Started with Community Events", participantCount: 142, data: { title: "Getting Started with Community Events", slug: "getting-started", excerpt: "Learn how to organize your first community event from scratch. We cover planning, promotion, and execution.", coverImage: "", category: "Guide", tags: ["events", "community"], author: { name: "Priya Sharma" }, publishedAt: "2026-03-20", readingTime: 5 } },
  { id: "bp2", title: "Top 10 Venues in the City", participantCount: 98, data: { title: "Top 10 Venues in the City", slug: "top-venues", excerpt: "Discover the best venues for hosting events in the city, from intimate spaces to large auditoriums.", coverImage: "", category: "List", tags: ["venues", "city"], author: { name: "Rahul Mehta" }, publishedAt: "2026-03-15", readingTime: 8 } },
  { id: "bp3", title: "How We Grew to 1000 Members", participantCount: 256, data: { title: "How We Grew to 1000 Members", slug: "growth-story", excerpt: "Our journey from a small meetup group to a thriving community of over 1000 active members.", coverImage: "", category: "Story", tags: ["growth", "community"], author: { name: "Anita Desai" }, publishedAt: "2026-03-10", readingTime: 6 } },
]

function formatDate(dateStr?: string) {
  if (!dateStr) return ""
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function Initials({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  return <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold">{initials}</div>
}

export function BlogPostsModule({ config, orgSlug, isPreview }: ModuleProps) {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [activePost, setActivePost] = useState<BlogPost | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const perPage = config.postsPerPage || 9

  useEffect(() => {
    if (isPreview) { setPosts(SAMPLE_POSTS); setIsLoading(false); return }
    fetchPosts()
  }, [orgSlug, isPreview, page])

  async function fetchPosts() {
    try {
      const params = new URLSearchParams({ orgSlug, page: String(page), limit: String(perPage) })
      if (activeCategory) params.set("category", activeCategory)
      const res = await fetch(`/api/modules/blog-posts/posts?${params}`)
      const json = await res.json()
      if (json.success) {
        if (page === 1) setPosts(json.data)
        else setPosts(prev => [...prev, ...json.data])
        setHasMore(json.data.length >= perPage)
      }
    } catch {} finally { setIsLoading(false) }
  }

  const categories = useMemo(() => {
    const cats = new Set<string>()
    posts.forEach(p => { if (p.data.category) cats.add(p.data.category) })
    return Array.from(cats)
  }, [posts])

  const filteredPosts = activeCategory
    ? posts.filter(p => p.data.category === activeCategory)
    : posts

  const handleShare = (post: BlogPost) => {
    const url = window.location.href
    navigator.clipboard.writeText(`${post.data.title} — ${url}`)
    toast.success("Link copied!")
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  // Post detail view
  if (activePost) {
    const d = activePost.data
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <button onClick={() => setActivePost(null)} className="text-sm text-muted-foreground hover:underline flex items-center gap-1"><ArrowLeft className="h-3 w-3" />Back to Blog</button>

        {d.coverImage && (
          <div className="aspect-[2/1] rounded-xl overflow-hidden bg-muted">
            <img src={d.coverImage} alt={d.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="space-y-3">
          {d.category && <Badge variant="secondary">{d.category}</Badge>}
          <h1 className="text-2xl sm:text-3xl font-bold">{d.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {config.showAuthor !== false && d.author && (
              <span className="flex items-center gap-1.5"><Initials name={d.author.name} />{d.author.name}</span>
            )}
            {config.showDate !== false && d.publishedAt && (
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(d.publishedAt)}</span>
            )}
            {config.showReadingTime !== false && d.readingTime && (
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{d.readingTime} min read</span>
            )}
          </div>
        </div>

        {d.content ? (
          <article className="prose prose-sm sm:prose max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: sanitizeHtml(d.content) }} />
        ) : (
          <p className="text-muted-foreground">{d.excerpt || "No content available."}</p>
        )}

        {d.tags && d.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            {d.tags.map(tag => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
          </div>
        )}

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => handleShare(activePost)}><Link2 className="h-3.5 w-3.5" />Copy Link</Button>
          <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(d.title)}&url=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1"><Share2 className="h-3.5 w-3.5" />Tweet</Button>
          </a>
        </div>

        {/* Related posts */}
        {config.showRelatedPosts !== false && (
          <div className="pt-6 border-t space-y-3">
            <h3 className="font-semibold">Related Posts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {posts.filter(p => p.id !== activePost.id).slice(0, 2).map(post => (
                <Card key={post.id} className="p-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActivePost(post); window.scrollTo(0, 0) }}>
                  <h4 className="font-medium text-sm">{post.data.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{post.data.excerpt}</p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Blog listing view
  const layout = config.layout || "grid"

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold flex items-center gap-2"><FileText className="h-5 w-5" /> Blog</h3>

      {/* Category filter */}
      {config.showCategories !== false && categories.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setActiveCategory(null)} className={`px-3 py-1 rounded-full text-xs transition-colors ${!activeCategory ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>All</button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-3 py-1 rounded-full text-xs transition-colors ${activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>{cat}</button>
          ))}
        </div>
      )}

      {filteredPosts.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No posts yet</p>
      ) : (
        <div className={
          layout === "list" ? "space-y-4" :
          layout === "featured-grid" ? "grid grid-cols-1 sm:grid-cols-2 gap-4" :
          "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
        }>
          {filteredPosts.map((post, idx) => {
            const isFeatured = layout === "featured-grid" && idx === 0
            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={isFeatured ? "sm:col-span-2" : ""}
              >
                <Card
                  className={`overflow-hidden cursor-pointer group hover:shadow-md transition-shadow ${layout === "list" ? "flex gap-4" : ""}`}
                  onClick={() => setActivePost(post)}
                >
                  <div className={`bg-muted relative ${layout === "list" ? "w-40 shrink-0" : "aspect-[16/9]"} ${isFeatured ? "aspect-[2/1]" : ""}`}>
                    {post.data.coverImage ? (
                      <img src={post.data.coverImage} alt={post.data.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><FileText className="h-8 w-8 text-muted-foreground/20" /></div>
                    )}
                    {post.data.category && (
                      <Badge className="absolute top-2 left-2 text-[10px]" variant="secondary">{post.data.category}</Badge>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <h4 className={`font-semibold line-clamp-2 group-hover:text-primary transition-colors ${isFeatured ? "text-lg" : "text-sm"}`}>{post.data.title}</h4>
                    {post.data.excerpt && <p className={`text-muted-foreground line-clamp-2 ${isFeatured ? "text-sm" : "text-xs"}`}>{post.data.excerpt}</p>}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {config.showAuthor !== false && post.data.author && (
                        <span className="flex items-center gap-1"><Initials name={post.data.author.name} />{post.data.author.name}</span>
                      )}
                      {config.showDate !== false && post.data.publishedAt && <span>{formatDate(post.data.publishedAt)}</span>}
                      {config.showReadingTime !== false && post.data.readingTime && <span>{post.data.readingTime} min</span>}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {hasMore && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setPage(p => p + 1)}>Load More</Button>
        </div>
      )}
    </div>
  )
}

export default BlogPostsModule
