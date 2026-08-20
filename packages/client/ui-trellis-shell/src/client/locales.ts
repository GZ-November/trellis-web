/**
 * Locale dictionary for the Trellis full-screen knowledge workbench.
 * @module @deepseek-ai/dsh-client-ui-trellis-shell/client/locales
 */

/** Locale namespace for the Trellis shell. */
export const NS = 'ui-trellis-shell'

/** Dictionary keys for the Trellis shell. */
export type TrellisShellKey =
  | 'title'
  | 'subtitle'
  | 'capture.placeholder'
  | 'capture.action'
  | 'capture.running'
  | 'capture.done'
  | 'search.placeholder'
  | 'empty.documents'
  | 'empty.detail'
  | 'detail.source'
  | 'detail.created'
  | 'detail.analysis.placeholder'
  | 'detail.analysis.action'
  | 'detail.close'
  | 'analysis.empty'
  | 'documents'
  | 'relations'
  | 'tags'
  | 'status.syncing'
  | 'view.list'
  | 'view.canvas'
  | 'deepread.title'
  | 'deepread.quick'
  | 'deepread.deep'
  | 'deepread.map'
  | 'deepread.feynman'
  | 'deepread.book'
  | 'browser.title'
  | 'browser.open'
  | 'browser.close'
  | 'browser.back'
  | 'browser.forward'
  | 'browser.reload'
  | 'browser.go'
  | 'browser.urlPlaceholder'
  | 'browser.openExternal'
  | 'browser.clip'
  | 'browser.clipped'
  | 'source.open'

/** Simplified Chinese copy. */
export const zh: Record<TrellisShellKey, string> = {
  'title': '知识库',
  'subtitle': '收集、整理、分析',
  'capture.placeholder': '粘贴链接或文字，或拖入 PDF/文档后自动整理',
  'capture.action': '收集',
  'capture.running': '整理中…',
  'capture.done': '已整理',
  'search.placeholder': '搜索标题、摘要或标签',
  'empty.documents': '还没有内容。粘贴链接或拖入文件开始收集。',
  'empty.detail': '选择一条内容查看详情，或在上方收集新信息。',
  'detail.source': '来源',
  'detail.created': '创建',
  'detail.analysis.placeholder': '输入想深入分析的问题',
  'detail.analysis.action': '分析',
  'detail.close': '关闭',
  'analysis.empty': '分析结果会显示在这里。',
  'documents': '文档',
  'relations': '关联',
  'tags': '标签',
  'status.syncing': '同步中',
  'view.list': '列表',
  'view.canvas': '图谱',
  'deepread.title': '深度阅读',
  'deepread.quick': '快速',
  'deepread.deep': '深度',
  'deepread.map': '知识地图',
  'deepread.feynman': '费曼',
  'deepread.book': '全书',
  'browser.title': '伴学浏览器',
  'browser.open': '浏览器',
  'browser.close': '关闭浏览器',
  'browser.back': '后退',
  'browser.forward': '前进',
  'browser.reload': '刷新',
  'browser.go': '前往',
  'browser.urlPlaceholder': '输入网址…',
  'browser.openExternal': '外部打开',
  'browser.clip': '剪藏到知识库',
  'browser.clipped': '已放入收集栏',
  'source.open': '打开来源',
}

/** English copy. */
export const en: Record<TrellisShellKey, string> = {
  'title': 'Knowledge Base',
  'subtitle': 'Capture, organize, analyze',
  'capture.placeholder': 'Paste a link or text, or drop a PDF/document to organize',
  'capture.action': 'Capture',
  'capture.running': 'Organizing…',
  'capture.done': 'Organized',
  'search.placeholder': 'Search title, summary, or tags',
  'empty.documents': 'Nothing here yet. Paste a link or drop a file to start.',
  'empty.detail': 'Select an item to view details, or capture new information above.',
  'detail.source': 'Source',
  'detail.created': 'Created',
  'detail.analysis.placeholder': 'Ask a question for deeper analysis',
  'detail.analysis.action': 'Analyze',
  'detail.close': 'Close',
  'analysis.empty': 'Analysis results will appear here.',
  'documents': 'Documents',
  'relations': 'Relations',
  'tags': 'Tags',
  'status.syncing': 'Syncing',
  'view.list': 'List',
  'view.canvas': 'Map',
  'deepread.title': 'Deep Read',
  'deepread.quick': 'Quick',
  'deepread.deep': 'Deep',
  'deepread.map': 'Knowledge Map',
  'deepread.feynman': 'Feynman',
  'deepread.book': 'Book',
  'browser.title': 'Browser',
  'browser.open': 'Browser',
  'browser.close': 'Close Browser',
  'browser.back': 'Back',
  'browser.forward': 'Forward',
  'browser.reload': 'Reload',
  'browser.go': 'Go',
  'browser.urlPlaceholder': 'Enter a URL…',
  'browser.openExternal': 'Open Externally',
  'browser.clip': 'Clip to Knowledge',
  'browser.clipped': 'Added to capture',
  'source.open': 'Open Source',
}
