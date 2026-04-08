"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Loader2, FileText, Pencil, Eye, Copy, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
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
  isPublished: boolean
  participantCount: number
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function estimateReadingTime(content: string): number {
  const words = content.replace(/<[^>]*>/g, "").split(/\s+/).length
  return Math.max(1, Math.ceil(words / 200))
}

export function BlogPostsAdmin({ config, orgSlug, isPreview }: ModuleProps) {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  // Editor fields
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [content, setContent] = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [category, setCategory] = useState("")
  const [tagsStr, setTagsStr] = useState("")
  const [coverImage, setCoverImage] = useState("")

  useEffect(() => {
    if (isPreview) { setIsLoading(false); return }
    fetchPosts()
  }, [orgSlug, isPreview])

  async function fetchPosts() {
    try {
      const res = await fetch(`/api/modules/blog-posts/posts?orgSlug=${orgSlug}&status=all`)
      const json = await res.json()
      if (json.success) setPosts(json.data)
    } catch {} finally { setIsLoading(false) }
  }

  const openEditor = (post?: BlogPost) => {
    if (post) {
      setEditingPost(post)
      setTitle(post.data.title); setSlug(post.data.slug)
      setContent(post.data.content || ""); setExcerpt(post.data.excerpt || "")
      setCategory(post.data.category || ""); setTagsStr(post.data.tags?.join(", ") || "")
      setCoverImage(post.data.coverImage || "")
    } else {
      setEditingPost(null)
      setTitle(""); setSlug(""); setContent(""); setExcerpt("")
      setCategory(""); setTagsStr(""); setCoverImage("")
    }
    setShowEditor(true)
  }

  const handleSave = async (publish: boolean) => {
    if (!title.trim()) { toast.error("Title required"); return }
    if (isPreview) { toast.info("Disabled in preview"); return }
    setIsSaving(true)
    const postSlug = slug || slugify(title)
    const tags = tagsStr.split(",").map(t => t.trim()).filter(Boolean)
    const autoExcerpt = excerpt || content.replace(/<[^>]*>/g, "").slice(0, 200)
    const readingTime = estimateReadingTime(content)

    try {
      const url = editingPost
        ? `/api/modules/blog-posts/posts/${editingPost.id}?orgSlug=${orgSlug}`
        : `/api/modules/blog-posts/posts?orgSlug=${orgSlug}`
      const method = editingPost ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, slug: postSlug, content, excerpt: autoExcerpt,
          category, tags, coverImage, readingTime,
          isPublished: publish,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(editingPost ? "Post updated" : publish ? "Post published" : "Draft saved")
        setShowEditor(false)
        fetchPosts()
      } else toast.error(json.message)
    } catch { toast.error("Failed to save") } finally { setIsSaving(false) }
  }

  const handleDelete = async (postId: string) => {
    if (isPreview) return
    try {
      const res = await fetch(`/api/modules/blog-posts/posts/${postId}?orgSlug=${orgSlug}`, { method: "DELETE" })
      const json = await res.json()
      if (json.success) { toast.success("Post deleted"); fetchPosts() }
      else toast.error(json.message)
    } catch { toast.error("Failed to delete") }
  }

  const filteredPosts = posts.filter(p => {
    if (searchQuery && !p.data.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (filterStatus === "published" && !p.isPublished) return false
    if (filterStatus === "draft" && p.isPublished) return false
    return true
  })

  const categories = [...new Set(posts.map(p => p.data.category).filter(Boolean))]

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>

  if (showEditor) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setShowEditor(false)} className="text-sm text-muted-foreground hover:underline">&larr; Back to Posts</button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={isSaving}>Save Draft</Button>
            <Button size="sm" onClick={() => handleSave(true)} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}Publish
            </Button>
          </div>
        </div>

        <Input value={title} onChange={e => { setTitle(e.target.value); if (!editingPost) setSlug(slugify(e.target.value)) }} placeholder="Post title..." className="text-lg font-semibold h-12 border-0 shadow-none px-0 focus-visible:ring-0" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1"><Label className="text-xs">Slug</Label><Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="post-slug" className="text-sm" /></div>
          <div className="space-y-1"><Label className="text-xs">Category</Label><Input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g., Guide, News" className="text-sm" list="categories" />
            <datalist id="categories">{categories.map(c => <option key={c} value={c!} />)}</datalist>
          </div>
        </div>

        <div className="space-y-1"><Label className="text-xs">Cover Image URL</Label><Input value={coverImage} onChange={e => setCoverImage(e.target.value)} placeholder="https://..." className="text-sm" /></div>
        <div className="space-y-1"><Label className="text-xs">Tags (comma-separated)</Label><Input value={tagsStr} onChange={e => setTagsStr(e.target.value)} placeholder="events, community, tips" className="text-sm" /></div>
        <div className="space-y-1"><Label className="text-xs">Content (HTML)</Label><Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write your post content..." rows={12} className="font-mono text-sm" /></div>
        <div className="space-y-1"><Label className="text-xs">Excerpt (auto-generated if empty)</Label><Textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="Brief summary..." rows={2} className="text-sm" /></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-5 w-5" /> Blog Posts</h3>
        <Button size="sm" onClick={() => openEditor()} className="gap-1"><Plus className="h-3.5 w-3.5" />New Post</Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search posts..." className="pl-8 h-9 text-sm" /></div>
        <div className="flex gap-1">
          {["all", "published", "draft"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1 rounded-full text-xs transition-colors ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{s === "all" ? "All" : s === "published" ? "Published" : "Drafts"}</button>
          ))}
        </div>
      </div>

      {filteredPosts.length > 0 ? (
        <div className="space-y-2">
          {filteredPosts.map(post => (
            <Card key={post.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{post.data.title}</p>
                  <Badge variant={post.isPublished ? "default" : "secondary"} className="text-[10px] shrink-0">{post.isPublished ? "Published" : "Draft"}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  {post.data.category && <span>{post.data.category}</span>}
                  {post.data.author && <span>{post.data.author.name}</span>}
                  {post.data.publishedAt && <span>{new Date(post.data.publishedAt).toLocaleDateString()}</span>}
                  <span>{post.participantCount || 0} views</span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon-sm" onClick={() => openEditor(post)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(post.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-8">No posts yet. Write your first blog post!</p>
      )}

      <div className="text-xs text-muted-foreground">Total: {posts.length} posts ({posts.filter(p => p.isPublished).length} published)</div>
    </div>
  )
}

export default BlogPostsAdmin
