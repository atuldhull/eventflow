/**
 * Advance widths (1/1000 em) of the standard PDF fonts used by the hand-written PDFs, from
 * Adobe's Core 14 AFM files, for the printable ASCII range 0x20-0x7E. Other WinAnsi bytes
 * use their unaccented base letter's width (é -> e) or a conservative fallback.
 */
export type StandardFont =
  | "Helvetica" | "Helvetica-Bold" | "Helvetica-Oblique"
  | "Times-Roman" | "Times-Bold" | "Times-Italic"
  | "Courier" | "Courier-Bold"

// prettier-ignore
const ASCII: Record<"Helvetica" | "Helvetica-Bold" | "Times-Roman" | "Times-Bold" | "Times-Italic", number[]> = {
  //            sp   !    "    #    $    %    &    '    (    )    *    +    ,    -    .    /
  "Helvetica": [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    // 0-9, : ; < = > ? @
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015,
    // A-Z
    667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
    // [ \ ] ^ _ `
    278, 278, 278, 469, 556, 333,
    // a-z
    556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
    // { | } ~
    334, 260, 334, 584],
  "Helvetica-Bold": [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975,
    722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
    333, 278, 333, 584, 556, 333,
    556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500,
    389, 280, 389, 584],
  "Times-Roman": [250, 333, 408, 500, 500, 833, 778, 180, 333, 333, 500, 564, 250, 333, 250, 278,
    500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 278, 278, 564, 564, 564, 444, 921,
    722, 667, 667, 722, 611, 556, 722, 722, 333, 389, 722, 611, 889, 722, 722, 556, 722, 667, 556, 611, 722, 722, 944, 722, 722, 611,
    333, 278, 333, 469, 500, 333,
    444, 500, 444, 500, 444, 333, 500, 500, 278, 278, 500, 278, 778, 500, 500, 500, 500, 333, 389, 278, 500, 500, 722, 500, 500, 444,
    480, 200, 480, 541],
  "Times-Bold": [250, 333, 555, 500, 500, 1000, 833, 278, 333, 333, 500, 570, 250, 333, 250, 278,
    500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 570, 570, 570, 500, 930,
    722, 667, 722, 722, 667, 611, 778, 778, 389, 500, 778, 667, 944, 722, 778, 611, 778, 722, 556, 667, 722, 722, 1000, 722, 722, 667,
    333, 278, 333, 581, 500, 333,
    500, 556, 444, 556, 444, 333, 500, 556, 278, 333, 556, 278, 833, 556, 500, 556, 556, 444, 389, 333, 556, 500, 722, 500, 500, 444,
    394, 220, 394, 520],
  "Times-Italic": [250, 333, 420, 500, 500, 833, 778, 214, 333, 333, 500, 675, 250, 333, 250, 278,
    500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 675, 675, 675, 500, 920,
    611, 611, 667, 722, 611, 611, 722, 722, 333, 444, 667, 556, 833, 667, 722, 611, 722, 611, 500, 556, 722, 611, 833, 611, 556, 556,
    389, 278, 389, 422, 500, 333,
    500, 500, 444, 500, 444, 278, 500, 500, 278, 278, 444, 278, 722, 500, 500, 500, 500, 389, 389, 278, 500, 444, 667, 444, 444, 389,
    400, 275, 400, 541],
}

// WinAnsi bytes 0x80-0x9F and a few Latin-1 symbols without a base letter (Helvetica-ish,
// rounded up so wrapping errs on the safe side).
const SPECIAL: Record<number, number> = {
  0x80: 556, 0x82: 333, 0x83: 556, 0x84: 500, 0x85: 1000, 0x86: 556, 0x87: 556, 0x88: 333, 0x89: 1000,
  0x8b: 333, 0x91: 333, 0x92: 333, 0x93: 500, 0x94: 500, 0x95: 350, 0x96: 556, 0x97: 1000, 0x98: 333,
  0x99: 1000, 0x9b: 333, 0xa0: 278, 0xa9: 760, 0xae: 760, 0xb0: 400, 0xb7: 278, 0xc6: 1000, 0xd7: 584,
  0xdf: 611, 0xe6: 889, 0xf7: 584, 0x8c: 1000, 0x9c: 944,
}

/** Advance width of one WinAnsi byte, in 1/1000 em. */
export function glyphWidth(font: StandardFont, byte: number): number {
  if (font === "Courier" || font === "Courier-Bold") return 600
  const table = ASCII[font === "Helvetica-Oblique" ? "Helvetica" : font]
  if (byte >= 0x20 && byte <= 0x7e) return table[byte - 0x20]
  if (SPECIAL[byte] !== undefined) return SPECIAL[byte]
  // accented letters (and Š, Ž, Ÿ ...): the width of their base letter
  const ch = new TextDecoder("windows-1252").decode(new Uint8Array([byte]))
  const base = ch.normalize("NFD").charCodeAt(0)
  if (base >= 0x20 && base <= 0x7e) return table[base - 0x20]
  return 667
}

/** Width in points of WinAnsi bytes at `size`, with optional character spacing (Tc). */
export function bytesWidth(font: StandardFont, bytes: number[], size: number, charSpacing = 0): number {
  let em = 0
  for (const b of bytes) em += glyphWidth(font, b)
  return (em / 1000) * size + charSpacing * bytes.length
}
