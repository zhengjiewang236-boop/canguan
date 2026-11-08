// 极简 Excel (.xlsx) 读写，跟安卓版 Xlsx.kt 一样的输出（同样的样式编号、列宽、冻结表头）。
import { strToU8, strFromU8, unzipSync, zipSync } from 'fflate'

export const PLAIN = 0
export const HEADER = 1
export const CELL = 2
export const TOTAL = 3
export const TITLE = 4

export type Cell = { t: 's'; v: string; style: number } | { t: 'n'; v: number; style: number }
export const str = (v: string, style = CELL): Cell => ({ t: 's', v, style })
export const num = (v: number, style = CELL): Cell => ({ t: 'n', v, style })

export class Sheet {
  rows: Cell[][] = []
  widths: number[] = []
  freezeRows = 0
  freezeCols = 0
  constructor(public name: string) {}
  row(...cells: Cell[]) {
    this.rows.push(cells)
  }
  rowOf(cells: Cell[]) {
    this.rows.push(cells)
  }
}

export function colName(i: number): string {
  let n = i + 1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function esc(s: string): string {
  let out = ''
  for (const ch of s) {
    if (ch === '&') out += '&amp;'
    else if (ch === '<') out += '&lt;'
    else if (ch === '>') out += '&gt;'
    else if (ch === '"') out += '&quot;'
    else if (ch === '\t' || ch === '\n' || ch === '\r' || ch >= ' ') out += ch
  }
  return out
}

/** 最多 4 位小数（四舍五入），去掉末尾的 0 */
function numText(d: number): string {
  const r = Math.round((d + Math.sign(d) * 1e-10) * 10000) / 10000
  if (r === 0) return '0'
  return r.toFixed(4).replace(/\.?0+$/, '')
}

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const HDR = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3">
<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD7E8DF"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF4EFE4"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFBDBDBD"/></left><right style="thin"><color rgb="FFBDBDBD"/></right><top style="thin"><color rgb="FFBDBDBD"/></top><bottom style="thin"><color rgb="FFBDBDBD"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

export class XlsxWriter {
  private sheets: Sheet[] = []

  sheet(name: string): Sheet {
    const s = new Sheet([...name].slice(0, 31).join(''))
    this.sheets.push(s)
    return s
  }

  toBytes(): Uint8Array {
    const files: Record<string, Uint8Array> = {
      '[Content_Types].xml': strToU8(this.contentTypes()),
      '_rels/.rels': strToU8(this.rootRels()),
      'xl/workbook.xml': strToU8(this.workbook()),
      'xl/_rels/workbook.xml.rels': strToU8(this.workbookRels()),
      'xl/styles.xml': strToU8(STYLES),
    }
    this.sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(this.sheetXml(s, i === 0))))
    return zipSync(files, { level: 6 })
  }

  private contentTypes() {
    let s = HDR + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    s += '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    s += '<Default Extension="xml" ContentType="application/xml"/>'
    s += '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    s += '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    this.sheets.forEach((_, i) => {
      s += `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    })
    return s + '</Types>'
  }

  private rootRels() {
    return (
      HDR +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>'
    )
  }

  private workbook() {
    let s = HDR + `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>`
    this.sheets.forEach((sh, i) => (s += `<sheet name="${esc(sh.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`))
    return s + '</sheets></workbook>'
  }

  private workbookRels() {
    let s = HDR + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    this.sheets.forEach((_, i) => {
      s += `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    })
    s += `<Relationship Id="rId${this.sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
    return s + '</Relationships>'
  }

  private sheetXml(s: Sheet, selected: boolean) {
    const out: string[] = [HDR, `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">`, '<sheetViews><sheetView workbookViewId="0"']
    if (selected) out.push(' tabSelected="1"')
    if (s.freezeRows > 0 || s.freezeCols > 0) {
      const tl = colName(s.freezeCols) + (s.freezeRows + 1)
      const pane = s.freezeRows > 0 && s.freezeCols > 0 ? 'bottomRight' : s.freezeRows > 0 ? 'bottomLeft' : 'topRight'
      out.push('><pane')
      if (s.freezeCols > 0) out.push(` xSplit="${s.freezeCols}"`)
      if (s.freezeRows > 0) out.push(` ySplit="${s.freezeRows}"`)
      out.push(` topLeftCell="${tl}" activePane="${pane}" state="frozen"/>`)
      out.push(`<selection pane="${pane}" activeCell="${tl}" sqref="${tl}"/></sheetView>`)
    } else out.push('/>')
    out.push('</sheetViews>', '<sheetFormatPr defaultRowHeight="18"/>')
    if (s.widths.length) {
      out.push('<cols>')
      s.widths.forEach((w, i) => out.push(`<col min="${i + 1}" max="${i + 1}" width="${w.toFixed(1)}" customWidth="1"/>`))
      out.push('</cols>')
    }
    out.push('<sheetData>')
    s.rows.forEach((row, ri) => {
      const r = ri + 1
      if (!row.length) {
        out.push(`<row r="${r}"/>`)
        return
      }
      out.push(`<row r="${r}">`)
      row.forEach((c, ci) => {
        const ref = colName(ci) + r
        if (c.t === 's') {
          if (!c.v) out.push(`<c r="${ref}" s="${c.style}"/>`)
          else out.push(`<c r="${ref}" s="${c.style}" t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`)
        } else out.push(`<c r="${ref}" s="${c.style}"><v>${numText(c.v)}</v></c>`)
      })
      out.push('</row>')
    })
    out.push('</sheetData>')
    out.push('<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>')
    out.push('</worksheet>')
    return out.join('')
  }
}

// ---------------- 读 ----------------

export interface ReadSheet {
  name: string
  rows: string[][]
}

function parseXml(bytes: Uint8Array): Document {
  const doc = new DOMParser().parseFromString(strFromU8(bytes), 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('表格文件坏了')
  return doc
}

/** 按本地名找元素（不管命名空间前缀） */
function byLocal(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagNameNS('*', name))
}

function attr(e: Element, name: string): string | null {
  for (const a of Array.from(e.attributes)) {
    if ((a.localName || a.name.split(':').pop()) === name) return a.value
  }
  return null
}

function colIndex(ref: string): number {
  let n = 0
  for (const ch of ref.toUpperCase()) {
    if (ch >= 'A' && ch <= 'Z') n = n * 26 + (ch.charCodeAt(0) - 64)
    else break
  }
  return n - 1
}

/** 一个 <si> 或 <is> 里的文字（跳过注音 rPh） */
function richText(e: Element): string {
  let s = ''
  for (const t of byLocal(e, 't')) {
    let p: Element | null = t.parentElement
    let phonetic = false
    while (p && p !== e) {
      if (p.localName === 'rPh') phonetic = true
      p = p.parentElement
    }
    if (!phonetic) s += t.textContent ?? ''
  }
  return s
}

/** 读取 .xlsx（本 App / 安卓版导出的，或用 Excel / WPS 改过再保存的都行）。每格都读成文字。 */
export function readXlsx(data: Uint8Array): ReadSheet[] {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(data)
  } catch {
    throw new Error('不是 Excel 表格')
  }
  const norm: Record<string, Uint8Array> = {}
  for (const [k, v] of Object.entries(files)) norm[k.replace(/^\//, '')] = v
  const wb = norm['xl/workbook.xml']
  if (!wb) throw new Error('不是 Excel 表格')

  const meta = byLocal(parseXml(wb), 'sheet').map((e) => ({ name: attr(e, 'name') ?? '', rid: attr(e, 'id') ?? '' }))
  const targets = new Map<string, string>()
  const rels = norm['xl/_rels/workbook.xml.rels']
  if (rels) {
    for (const e of byLocal(parseXml(rels), 'Relationship')) {
      const id = attr(e, 'Id')
      const t = attr(e, 'Target')
      if (!id || !t) continue
      targets.set(id, t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, ''))
    }
  }
  const sharedBytes = norm['xl/sharedStrings.xml']
  const shared = sharedBytes ? byLocal(parseXml(sharedBytes), 'si').map(richText) : []

  const out: ReadSheet[] = []
  meta.forEach(({ name, rid }, i) => {
    const path = targets.get(rid) ?? `xl/worksheets/sheet${i + 1}.xml`
    const bytes = norm[path]
    if (bytes) out.push({ name, rows: readSheet(bytes, shared) })
  })
  return out
}

function readSheet(bytes: Uint8Array, shared: string[]): string[][] {
  const doc = parseXml(bytes)
  const rows: string[][] = []
  for (const row of byLocal(doc, 'row')) {
    const cur = new Map<number, string>()
    let next = 0
    for (const c of Array.from(row.children).filter((e) => e.localName === 'c')) {
      const ref = attr(c, 'r')
      const col = ref ? colIndex(ref) : next
      next = col + 1
      const type = attr(c, 't') ?? ''
      const vEl = Array.from(c.children).find((e) => e.localName === 'v')
      const isEl = Array.from(c.children).find((e) => e.localName === 'is')
      const v = vEl ? (vEl.textContent ?? '') : null
      let value: string
      if (type === 's') value = shared[parseInt((v ?? '').trim(), 10)] ?? ''
      else if (type === 'inlineStr') value = isEl ? richText(isEl) : ''
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE'
      else value = v ?? (isEl ? richText(isEl) : '')
      if (value) cur.set(col, value)
    }
    const max = cur.size ? Math.max(...cur.keys()) : -1
    rows.push(Array.from({ length: max + 1 }, (_, i) => cur.get(i) ?? ''))
  }
  return rows
}
