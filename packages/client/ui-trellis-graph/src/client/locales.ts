/** `trellisGraph` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'trellisGraph'

/** Simplified Chinese dictionary and key-set source. */
export const zh = {
  'title': 'Trellis 知识图谱',
  'building': '正在生成图谱',
  'empty': '知识库里还没有可显示的文档',
  'malformed': '无法读取这次图谱结果',
  'nodes': '{count} 个文档',
  'edges': '{count} 条关系',
  'truncated': '这是大型知识库的局部视图',
  'find': '查找图中条目',
  'source': '来源',
  'relations': '相关连接',
  'evidence': '关系依据',
  'confidence': '置信度 {value}',
  'inspect': '检查原始结果',
  'zoom_in': '放大',
  'zoom_out': '缩小',
  'zoom_fit': '自适应居中',
  'pause_sim': '暂停模拟',
  'resume_sim': '恢复模拟',
  'close': '关闭',
} satisfies Record<string, string>

/** Trellis graph dictionary key union. */
export type TrellisGraphKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en: Record<TrellisGraphKey, string> = {
  'title': 'Trellis knowledge graph',
  'building': 'Building graph',
  'empty': 'No knowledge documents to show yet',
  'malformed': 'This graph result could not be read',
  'nodes': '{count} documents',
  'edges': '{count} relations',
  'truncated': 'Showing a local view of the larger knowledge base',
  'find': 'Find a node in this graph',
  'source': 'Source',
  'relations': 'Connected relations',
  'evidence': 'Relationship evidence',
  'confidence': 'Confidence {value}',
  'inspect': 'Inspect raw result',
  'zoom_in': 'Zoom in',
  'zoom_out': 'Zoom out',
  'zoom_fit': 'Reset view',
  'pause_sim': 'Pause layout',
  'resume_sim': 'Resume layout',
  'close': 'Close',
}
