interface TaxParams {
  amount: number
  sellerState?: string
  buyerState?: string
  gstEnabled?: boolean
  gstRate?: number
}

interface TaxResult {
  subtotal: number
  cgst: number
  sgst: number
  igst: number
  totalTax: number
  total: number
  taxType: "INTRA_STATE" | "INTER_STATE" | "NONE"
}

export function calculateTax(params: TaxParams): TaxResult {
  const { amount, sellerState, buyerState, gstEnabled = false, gstRate = 18 } = params

  if (!gstEnabled || amount <= 0) {
    return { subtotal: amount, cgst: 0, sgst: 0, igst: 0, totalTax: 0, total: amount, taxType: "NONE" }
  }

  const halfRate = gstRate / 2

  if (sellerState && buyerState && sellerState.toLowerCase() === buyerState.toLowerCase()) {
    const cgst = Math.round((amount * halfRate) / 100 * 100) / 100
    const sgst = cgst
    return {
      subtotal: amount,
      cgst,
      sgst,
      igst: 0,
      totalTax: cgst + sgst,
      total: Math.round((amount + cgst + sgst) * 100) / 100,
      taxType: "INTRA_STATE",
    }
  }

  const igst = Math.round((amount * gstRate) / 100 * 100) / 100
  return {
    subtotal: amount,
    cgst: 0,
    sgst: 0,
    igst,
    totalTax: igst,
    total: Math.round((amount + igst) * 100) / 100,
    taxType: "INTER_STATE",
  }
}

export function formatTaxBreakdown(result: TaxResult): string {
  if (result.taxType === "NONE") return "No tax applicable"
  if (result.taxType === "INTRA_STATE") {
    return `CGST @${9}%: ₹${result.cgst.toLocaleString("en-IN")} + SGST @${9}%: ₹${result.sgst.toLocaleString("en-IN")}`
  }
  return `IGST @18%: ₹${result.igst.toLocaleString("en-IN")}`
}

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
