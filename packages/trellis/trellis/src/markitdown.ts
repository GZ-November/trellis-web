/**
 * MarkItDown: structured document and HTML to clean Markdown converter.
 * Inspired by Microsoft MarkItDown principles: preserves headings, tables,
 * lists, code blocks, and links while stripping navigation and script noise.
 *
 * @module @trellis/trellis/markitdown
 */

/** Extracted structured document output. */
export interface MarkItDownResult {
  /** Inferred or declared document title. */
  readonly title: string
  /** Normalized, clean Markdown body. */
  readonly markdown: string
  /** Links extracted from the document. */
  readonly links: ReadonlyArray<{ readonly url: string; readonly text: string }>
  /** Short leading excerpt suitable for search snippets and cards. */
  readonly excerpt: string
}

/**
 * Clean and normalize text: decode basic HTML entities and collapse whitespace.
 * @param text - raw HTML text segment.
 * @returns cleaned plain text string.
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

/**
 * Remove noisy HTML tags that do not carry core document content.
 * @param html - raw input HTML.
 * @returns sanitized HTML string.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
}

/**
 * Convert HTML table elements into standard Markdown tables.
 * @param tableHtml - segment containing table tags.
 * @returns markdown table string.
 */
function formatTable(tableHtml: string): string {
  const rows: string[][] = []
  const rowMatches = tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)
  for (const rowMatch of rowMatches) {
    const rowContent = rowMatch[1] ?? ''
    const cells: string[] = []
    const cellMatches = rowContent.matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)
    for (const cellMatch of cellMatches) {
      const cellText = (cellMatch[1] ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      cells.push(decodeHtmlEntities(cellText))
    }
    if (cells.length > 0) {
      rows.push(cells)
    }
  }
  if (rows.length === 0) return ''
  const columnCount = Math.max(...rows.map(row => row.length))
  if (columnCount === 0) return ''

  const headerRow = rows[0] ?? []
  while (headerRow.length < columnCount) headerRow.push('')
  const headerLine = `| ${headerRow.join(' | ')} |`
  const separatorLine = `| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`
  const bodyLines = rows.slice(1).map((row) => {
    const cloned = [...row]
    while (cloned.length < columnCount) cloned.push('')
    return `| ${cloned.join(' | ')} |`
  })

  return `\n\n${[headerLine, separatorLine, ...bodyLines].join('\n')}\n\n`
}

/**
 * Convert raw HTML or plain text into clean, structured Markdown.
 * @param input - raw HTML or plain text.
 * @param fallbackTitle - optional fallback title if none found in content.
 * @returns structured MarkItDown result.
 */
export function convertToMarkdown(input: string, fallbackTitle?: string): MarkItDownResult {
  const isHtml = /<[a-z][\s\S]*>/i.test(input)
  if (!isHtml) {
    const trimmed = input.trim()
    const firstLine = trimmed.split('\n')[0]?.replace(/^#+\s*/, '').trim() || fallbackTitle || 'Document'
    const excerpt = trimmed.slice(0, 300).replace(/\s+/g, ' ')
    return {
      title: firstLine.slice(0, 120),
      markdown: trimmed,
      links: [],
      excerpt,
    }
  }

  const titleMatch = input.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const rawTitle = titleMatch?.[1]
    ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim())
    : undefined

  const cleaned = sanitizeHtml(input)
  const links: Array<{ url: string; text: string }> = []
  const codeBlocks: string[] = []

  let body = cleaned

  // Extract links
  const linkMatches = body.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
  for (const match of linkMatches) {
    const url = match[1]?.trim() ?? ''
    const text = decodeHtmlEntities((match[2] ?? '').replace(/<[^>]+>/g, '').trim())
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
      links.push({ url, text: text || url })
    }
  }

  // Preformatted code blocks
  const codeBlockRegex = /<pre[^>]*><code(?: class=["'](?:language-)?([a-z0-9_-]+)["'])?[^>]*>([\s\S]*?)<\/code><\/pre>/gi
  body = body.replace(codeBlockRegex, (_, lang, code) => {
    const langTag = lang ? (lang as string).trim() : ''
    const idx = codeBlocks.length
    codeBlocks.push(`\n\n\`\`\`${langTag}\n${decodeHtmlEntities(code as string).trim()}\n\`\`\`\n\n`)
    return ` __MARKITDOWN_CODE_BLOCK_${idx}__ `
  })
  body = body.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, code) => {
    const idx = codeBlocks.length
    codeBlocks.push(`\n\n\`\`\`\n${decodeHtmlEntities(code as string).trim()}\n\`\`\`\n\n`)
    return ` __MARKITDOWN_CODE_BLOCK_${idx}__ `
  })
  body = body.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, code) => {
    return ` \`${decodeHtmlEntities(code as string).trim()}\` `
  })

  // Tables
  body = body.replace(/<table[^>]*>[\s\S]*?<\/table>/gi, match => formatTable(match))

  // Headings
  body = body.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, (_, text) => `\n\n# ${decodeHtmlEntities(text as string).replace(/<[^>]+>/g, '').trim()}\n\n`)
  body = body.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, (_, text) => `\n\n## ${decodeHtmlEntities(text as string).replace(/<[^>]+>/g, '').trim()}\n\n`)
  body = body.replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, (_, text) => `\n\n### ${decodeHtmlEntities(text as string).replace(/<[^>]+>/g, '').trim()}\n\n`)
  body = body.replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, (_, text) => `\n\n#### ${decodeHtmlEntities(text as string).replace(/<[^>]+>/g, '').trim()}\n\n`)
  body = body.replace(/<h5\b[^>]*>([\s\S]*?)<\/h5>/gi, (_, text) => `\n\n##### ${decodeHtmlEntities(text as string).replace(/<[^>]+>/g, '').trim()}\n\n`)
  body = body.replace(/<h6\b[^>]*>([\s\S]*?)<\/h6>/gi, (_, text) => `\n\n###### ${decodeHtmlEntities(text as string).replace(/<[^>]+>/g, '').trim()}\n\n`)

  // Lists
  body = body.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, text) => `\n- ${decodeHtmlEntities(text as string).replace(/<[^>]+>/g, '').trim()}`)
  body = body.replace(/<\/?(?:ul|ol)\b[^>]*>/gi, '\n')

  // Blockquotes
  body = body.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, text) => {
    const lines = decodeHtmlEntities(text as string).replace(/<[^>]+>/g, '').trim().split('\n')
    return `\n\n${lines.map(line => `> ${line.trim()}`).join('\n')}\n\n`
  })

  // Strong & Emphasis
  body = body.replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, (_, text) => `**${decodeHtmlEntities(text as string).replace(/<[^>]+>/g, '').trim()}**`)
  body = body.replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, (_, text) => `*${decodeHtmlEntities(text as string).replace(/<[^>]+>/g, '').trim()}*`)

  // Links
  body = body.replace(/<a\b\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
    const label = decodeHtmlEntities((text as string).replace(/<[^>]+>/g, '').trim()) || (href as string)
    return ` [${label}](${href as string}) `
  })

  // Paragraphs & Line breaks
  body = body.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_, text) => `\n\n${decodeHtmlEntities(text as string).replace(/<[^>]+>/g, '').trim()}\n\n`)
  body = body.replace(/<br\b\s*\/?>/gi, '\n')
  body = body.replace(/<hr\b\s*\/?>/gi, '\n\n---\n\n')

  // Strip remaining HTML tags
  body = body.replace(/<[^>]+>/g, ' ')

  // Normalize whitespace and multiple newlines
  body = decodeHtmlEntities(body)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()

  // Restore protected code blocks
  body = body.replace(/__MARKITDOWN_CODE_BLOCK_(\d+)__/g, (_, idx) => codeBlocks[Number(idx)] ?? '')
    .trim()

  const h1Match = body.match(/^#\s+(.+)$/m)
  const inferredTitle = rawTitle || (h1Match ? h1Match[1]?.trim() : undefined) || fallbackTitle || 'Webpage'
  const excerpt = body
    .replace(/#+\s+/g, '')
    .replace(/\n+/g, ' ')
    .slice(0, 300)
    .trim()

  return {
    title: inferredTitle.slice(0, 120),
    markdown: body,
    links,
    excerpt,
  }
}
