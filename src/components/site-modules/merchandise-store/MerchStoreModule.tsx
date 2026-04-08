"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ShoppingBag, X, ChevronLeft, ChevronRight, ExternalLink, MessageCircle, Mail, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface Product {
  id: string
  data: {
    name: string; description?: string; price: number; images: string[]
    sizes?: string[]; variants?: string[]; externalUrl?: string
    inStock: boolean; sortOrder?: number
  }
}

const SAMPLE_PRODUCTS: Product[] = [
  { id: "p1", data: { name: "Event T-Shirt", description: "Premium cotton t-shirt with the official event logo.", price: 599, images: [], sizes: ["S", "M", "L", "XL"], inStock: true } },
  { id: "p2", data: { name: "Logo Cap", description: "Adjustable baseball cap with embroidered logo.", price: 399, images: [], inStock: true } },
  { id: "p3", data: { name: "Sticker Pack", description: "Set of 5 vinyl stickers featuring event artwork.", price: 149, images: [], inStock: true } },
  { id: "p4", data: { name: "Limited Edition Hoodie", description: "Warm fleece hoodie, limited run of 50.", price: 1499, images: [], sizes: ["M", "L", "XL"], inStock: false } },
]

function formatPrice(price: number, currency: string) {
  const symbols: Record<string, string> = { INR: "\u20B9", USD: "$", EUR: "\u20AC", GBP: "\u00A3" }
  const symbol = symbols[currency] || currency + " "
  return `${symbol}${price.toLocaleString()}`
}

export function MerchStoreModule({ config, orgSlug, isPreview }: ModuleProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isPreview) { setProducts(SAMPLE_PRODUCTS); setIsLoading(false); return }
    async function fetch_() {
      try {
        const res = await fetch(`/api/modules/merchandise-store/products?orgSlug=${orgSlug}`)
        const json = await res.json()
        if (json.success) setProducts(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetch_()
  }, [orgSlug, isPreview])

  const handleBuy = (product: Product) => {
    const method = config.purchaseMethod || "contact"
    if (method === "external-link" && product.data.externalUrl) {
      window.open(product.data.externalUrl, "_blank")
    } else if (method === "razorpay" && product.data.externalUrl) {
      window.open(product.data.externalUrl, "_blank")
    } else {
      // Contact method
      const sizeText = selectedSize ? ` (Size: ${selectedSize})` : ""
      const message = `Hi! I'd like to order: ${product.data.name}${sizeText} - ${formatPrice(product.data.price, config.currency || "INR")}`
      if (config.contactMethod === "email" && config.contactEmail) {
        window.open(`mailto:${config.contactEmail}?subject=Order: ${product.data.name}&body=${encodeURIComponent(message)}`)
      } else if (config.contactNumber) {
        const num = config.contactNumber.replace(/\D/g, "")
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`, "_blank")
      }
    }
  }

  const currency = config.currency || "INR"
  const columns = config.columns || "3"
  const colClass = columns === "2" ? "grid-cols-1 sm:grid-cols-2" : columns === "4" ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold flex items-center gap-2"><ShoppingBag className="h-5 w-5" /> Merchandise</h3>

      {products.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No products available</p>
      ) : (
        <div className={`grid ${colClass} gap-4`}>
          {products.map((product, idx) => {
            const d = product.data
            return (
              <motion.div key={product.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                <Card className="overflow-hidden group hover:shadow-md transition-shadow">
                  <div className="aspect-square bg-muted relative flex items-center justify-center cursor-pointer" onClick={() => setSelectedProduct(product)}>
                    {d.images[0] ? (
                      <img src={d.images[0]} alt={d.name} className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag className="h-10 w-10 text-muted-foreground/20" />
                    )}
                    {!d.inStock && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Badge variant="destructive" className="text-sm">Sold Out</Badge>
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <h4 className="font-semibold text-sm">{d.name}</h4>
                    {config.showPrices !== false && <p className="font-bold text-primary">{formatPrice(d.price, currency)}</p>}
                    {d.sizes && d.sizes.length > 0 && (
                      <div className="flex gap-1">{d.sizes.map(s => <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s}</span>)}</div>
                    )}
                    <Button
                      size="sm"
                      className="w-full gap-1"
                      disabled={!d.inStock}
                      onClick={() => handleBuy(product)}
                    >
                      {config.purchaseMethod === "contact" ? (
                        config.contactMethod === "email" ? <><Mail className="h-3.5 w-3.5" />Order</> : <><MessageCircle className="h-3.5 w-3.5" />Order via WhatsApp</>
                      ) : (
                        <><ExternalLink className="h-3.5 w-3.5" />Buy Now</>
                      )}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Product detail modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setSelectedProduct(null); setSelectedSize(null) }}>
            <motion.div className="bg-background rounded-xl max-w-lg w-full shadow-xl overflow-hidden" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
              <div className="aspect-[4/3] bg-muted relative flex items-center justify-center">
                {selectedProduct.data.images[0] ? (
                  <img src={selectedProduct.data.images[0]} alt={selectedProduct.data.name} className="w-full h-full object-cover" />
                ) : (
                  <ShoppingBag className="h-16 w-16 text-muted-foreground/20" />
                )}
                <button className="absolute top-3 right-3 bg-black/40 rounded-full p-1.5 text-white hover:bg-black/60" onClick={() => { setSelectedProduct(null); setSelectedSize(null) }}>
                  <X className="h-4 w-4" />
                </button>
                {!selectedProduct.data.inStock && (
                  <Badge variant="destructive" className="absolute top-3 left-3">Sold Out</Badge>
                )}
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-bold">{selectedProduct.data.name}</h3>
                  {config.showPrices !== false && <p className="text-xl font-bold text-primary mt-1">{formatPrice(selectedProduct.data.price, currency)}</p>}
                </div>
                {selectedProduct.data.description && <p className="text-sm text-muted-foreground">{selectedProduct.data.description}</p>}
                {selectedProduct.data.sizes && selectedProduct.data.sizes.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Size</Label>
                    <div className="flex gap-2">{selectedProduct.data.sizes.map(s => (
                      <button key={s} onClick={() => setSelectedSize(s)} className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${selectedSize === s ? "border-primary bg-primary/5 font-medium" : "hover:border-primary/30"}`}>{s}</button>
                    ))}</div>
                  </div>
                )}
                <Button className="w-full" disabled={!selectedProduct.data.inStock} onClick={() => handleBuy(selectedProduct)}>
                  {selectedProduct.data.inStock ? (config.purchaseMethod === "contact" ? "Order Now" : "Buy Now") : "Sold Out"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={className}>{children}</p>
}

export default MerchStoreModule
