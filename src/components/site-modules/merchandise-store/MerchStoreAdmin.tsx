"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Loader2, ShoppingBag, Pencil, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface Product {
  id: string
  data: {
    name: string; description?: string; price: number; images: string[]
    sizes?: string[]; externalUrl?: string; inStock: boolean
  }
  sortOrder: number
}

function formatPrice(price: number, currency: string) {
  const symbols: Record<string, string> = { INR: "\u20B9", USD: "$", EUR: "\u20AC", GBP: "\u00A3" }
  return `${symbols[currency] || currency + " "}${price.toLocaleString()}`
}

export function MerchStoreAdmin({ config, orgSlug, isPreview }: ModuleProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form fields
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [sizesStr, setSizesStr] = useState("")
  const [externalUrl, setExternalUrl] = useState("")
  const [inStock, setInStock] = useState(true)

  useEffect(() => {
    if (isPreview) { setIsLoading(false); return }
    fetchProducts()
  }, [orgSlug, isPreview])

  async function fetchProducts() {
    try {
      const res = await fetch(`/api/modules/merchandise-store/products?orgSlug=${orgSlug}`)
      const json = await res.json()
      if (json.success) setProducts(json.data)
    } catch {} finally { setIsLoading(false) }
  }

  const openForm = (product?: Product) => {
    if (product) {
      setEditingProduct(product)
      setName(product.data.name); setDescription(product.data.description || "")
      setPrice(String(product.data.price)); setImageUrl(product.data.images[0] || "")
      setSizesStr(product.data.sizes?.join(", ") || "")
      setExternalUrl(product.data.externalUrl || ""); setInStock(product.data.inStock)
    } else {
      setEditingProduct(null)
      setName(""); setDescription(""); setPrice(""); setImageUrl("")
      setSizesStr(""); setExternalUrl(""); setInStock(true)
    }
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!name.trim() || !price) { toast.error("Name and price required"); return }
    if (isPreview) { toast.info("Disabled in preview"); return }
    setIsSaving(true)
    const sizes = sizesStr.split(",").map(s => s.trim()).filter(Boolean)
    const images = imageUrl ? [imageUrl] : []

    try {
      const url = editingProduct
        ? `/api/modules/merchandise-store/products?orgSlug=${orgSlug}&productId=${editingProduct.id}`
        : `/api/modules/merchandise-store/products?orgSlug=${orgSlug}`
      const method = editingProduct ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, price: Number(price), images, sizes, externalUrl, inStock }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(editingProduct ? "Product updated" : "Product added")
        setShowForm(false); fetchProducts()
      } else toast.error(json.message)
    } catch { toast.error("Failed to save") } finally { setIsSaving(false) }
  }

  const handleDelete = async (productId: string) => {
    if (isPreview) return
    try {
      const res = await fetch(`/api/modules/merchandise-store/products?orgSlug=${orgSlug}&productId=${productId}`, { method: "DELETE" })
      const json = await res.json()
      if (json.success) { toast.success("Product removed"); fetchProducts() }
    } catch { toast.error("Failed to delete") }
  }

  const toggleStock = async (product: Product) => {
    if (isPreview) return
    try {
      const res = await fetch(`/api/modules/merchandise-store/products?orgSlug=${orgSlug}&productId=${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...product.data, inStock: !product.data.inStock }),
      })
      const json = await res.json()
      if (json.success) { fetchProducts() }
    } catch {}
  }

  const currency = config.currency || "INR"

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2"><ShoppingBag className="h-5 w-5" /> Products</h3>
        <Button size="sm" onClick={() => openForm()} className="gap-1"><Plus className="h-3.5 w-3.5" />Add Product</Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <Label className="text-sm font-medium">{editingProduct ? "Edit Product" : "New Product"}</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label className="text-xs">Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Product name" /></div>
            <div className="space-y-1"><Label className="text-xs">Price ({currency}) *</Label><Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="599" /></div>
            <div className="space-y-1"><Label className="text-xs">Image URL</Label><Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." /></div>
            <div className="space-y-1"><Label className="text-xs">Sizes (comma-separated)</Label><Input value={sizesStr} onChange={e => setSizesStr(e.target.value)} placeholder="S, M, L, XL" /></div>
            <div className="space-y-1"><Label className="text-xs">External/Buy URL</Label><Input value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="https://..." /></div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" checked={inStock} onChange={e => setInStock(e.target.checked)} id="in-stock" />
              <label htmlFor="in-stock" className="text-sm">In Stock</label>
            </div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Product description..." rows={2} /></div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isSaving}>{isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}{editingProduct ? "Update" : "Add"}</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {products.length > 0 ? (
        <div className="space-y-2">
          {products.map(product => (
            <Card key={product.id} className="p-3 flex items-center gap-3">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {product.data.images[0] ? <img src={product.data.images[0]} alt="" className="w-full h-full object-cover" /> : <ShoppingBag className="h-5 w-5 text-muted-foreground/20" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{product.data.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-bold">{formatPrice(product.data.price, currency)}</span>
                  <Badge variant={product.data.inStock ? "secondary" : "destructive"} className="text-[10px] cursor-pointer" onClick={() => toggleStock(product)}>
                    {product.data.inStock ? "In Stock" : "Sold Out"}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon-sm" onClick={() => openForm(product)}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(product.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-8">No products yet. Add your first product!</p>
      )}
    </div>
  )
}

export default MerchStoreAdmin
