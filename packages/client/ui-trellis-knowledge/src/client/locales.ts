/**
 * Localization strings for the Transparent Trellis Knowledge Hub.
 * @module @deepseek-ai/dsh-client-ui-trellis-knowledge/client/locales
 */

/** Namespace name for Trellis knowledge hub strings. */
export const NS = 'ui-trellis-knowledge'

/** Simplified Chinese dictionary for Trellis knowledge hub UI. */
export const zh = {
  'view.knowledge': '知识库',
  title: 'Trellis 知识库与概念网络',
  subtitle: '归档文档、来源出处、概念关联与证据链，全部实时可见、可追溯。',
  tab_documents: '知识文档',
  tab_relations: '概念关系',
  tab_graph: '知识图谱',
  stat_docs: '总文档',
  stat_relations: '关系',
  stat_tags: '标签',
  search_placeholder: '搜索文档标题、摘要或标签…',
  filter_all: '全部类型',
  kind_document: '学术文档',
  kind_note: '学习笔记',
  kind_webpage: '网页剪藏',
  kind_other: '其他概念',
  source: '来源',
  evidence: '依据原文',
  confidence: '置信度',
  word_count: '字符量',
  ingested_at: '归档时间',
  preview_document: '查看原文',
  empty_documents: '知识库暂无文档。在下方对话框粘贴链接或拖入文件，Agent 会自动收集整理。',
  empty_relations: '暂未提取关系对。',
  refresh: '刷新',
  close_preview: '关闭预览',
  ask_agent: '让 Agent 分析',
  source_link: '打开来源',
  zoom_in: '放大',
  zoom_out: '缩小',
  zoom_fit: '自适应居中',
  'dock.title': '知识库已就绪',
  'dock.documents': '篇文档',
  'dock.relations': '条关联',
  'dock.tags': '个概念',
  'dock.open': '知识库',
  'dock.browser': '伴学浏览器',
  'dock.hint': '在下方对话框粘贴链接、拖入 PDF/文档，或直接提问；Agent 支持联网搜索，并自动收集、整理、建立关联。',
} as const

/** Trellis knowledge hub dictionary key union. */
export type TrellisKnowledgeKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'ui-trellis-knowledge': TrellisKnowledgeKey
  }
}

/** English dictionary for Trellis knowledge hub UI. */
export const en: Record<TrellisKnowledgeKey, string> = {
  'view.knowledge': 'Knowledge',
  title: 'Trellis Knowledge Hub',
  subtitle: 'Archived documents, provenance, concept relations, and evidence — all visible and traceable in real time.',
  tab_documents: 'Documents',
  tab_relations: 'Relations',
  tab_graph: 'Graph',
  stat_docs: 'Total Documents',
  stat_relations: 'Relations',
  stat_tags: 'Tags',
  search_placeholder: 'Search document title, summary or tags…',
  filter_all: 'All Types',
  kind_document: 'Document',
  kind_note: 'Note',
  kind_webpage: 'Web Clip',
  kind_other: 'Other',
  source: 'Source',
  evidence: 'Evidence',
  confidence: 'Confidence',
  word_count: 'Chars',
  ingested_at: 'Ingested',
  preview_document: 'View Content',
  empty_documents: 'No documents yet. Paste a link or drop a file into the chat below and the agent will collect it automatically.',
  empty_relations: 'No relations extracted yet.',
  refresh: 'Refresh',
  close_preview: 'Close',
  ask_agent: 'Ask Agent',
  source_link: 'Open Source',
  zoom_in: 'Zoom in',
  zoom_out: 'Zoom out',
  zoom_fit: 'Reset view',
  'dock.title': 'Knowledge base ready',
  'dock.documents': 'documents',
  'dock.relations': 'relations',
  'dock.tags': 'concepts',
  'dock.open': 'Knowledge',
  'dock.browser': 'Browser',
  'dock.hint': 'Paste a link, drop a PDF/document, or ask directly in the chat below; the agent searches the web and collects, organizes, and links sources automatically.',
}
