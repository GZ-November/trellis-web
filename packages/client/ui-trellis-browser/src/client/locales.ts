/**
 * Localization strings for the Trellis In-App Web Browser and Clipper.
 * @module @deepseek-ai/dsh-client-ui-trellis-browser/client/locales
 */

/** Namespace name for Trellis browser strings. */
export const NS = 'ui-trellis-browser'

/** Simplified Chinese dictionary for Trellis browser UI. */
export const zh = {
  'view.browser': '浏览器',
  open_browser: '打开网页',
  url_placeholder: '输入网址 (例如 https://en.wikipedia.org 或课程链接)...',
  go: '前往',
  back: '后退',
  forward: '前进',
  reload: '刷新',
  home: '主页',
  open_chrome: '在系统 Chrome 中打开',
  clip_to_trellis: '归档到知识库',
  clipping: '正在归档...',
  clipped: '已归档到 Trellis 知识库',
  clip_failed: '归档失败',
  reader_mode: 'MarkItDown 阅读模式',
  live_mode: '交互网页模式',
  bookmarks: '常用课程与书签',
  add_bookmark: '添加书签',
  bookmark_title: '书签名称',
  delete_bookmark: '删除',
  empty_bookmarks: '暂无保存的课程书签',
  default_course_title: 'CS101: 计算机科学导论',
  security_notice: '基于 Chromium 内核。登录或受限网页支持一键在外部 Chrome 中打开。',
  select_tip: '划选文本可一键让 Agent 解释或存入知识图谱。',
  study_hub_title: '学习与课程探索中心 (Study Hub)',
  study_hub_subtitle: '一键直达经典课程、学术预印本与常用研究资源，支持划选与 1-Click 知识库剪藏',
  launch_cs: '计算机科学导论 (CS101)',
  launch_mit: 'MIT 开放课程平台 (MIT OCW)',
  launch_arxiv: 'arXiv 学术预印本文库',
  launch_coursera: 'Coursera 在线课程',
  search_or_url: '搜索课程、文档或输入网址...',
  reading_time: '阅读时间约 3 分钟',
  reading_outline: 'MarkItDown 结构化提取大纲',
} as const

/** Trellis browser dictionary key union. */
export type TrellisBrowserKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'ui-trellis-browser': TrellisBrowserKey
  }
}

/** English dictionary for Trellis browser UI. */
export const en: Record<TrellisBrowserKey, string> = {
  'view.browser': 'Browser',
  open_browser: 'Open Web',
  url_placeholder: 'Enter URL (e.g. https://en.wikipedia.org or course link)...',
  go: 'Go',
  back: 'Back',
  forward: 'Forward',
  reload: 'Reload',
  home: 'Home',
  open_chrome: 'Open in System Chrome',
  clip_to_trellis: 'Clip to Trellis',
  clipping: 'Archiving...',
  clipped: 'Archived to Trellis Knowledge',
  clip_failed: 'Archive failed',
  reader_mode: 'MarkItDown Reader',
  live_mode: 'Live Web Mode',
  bookmarks: 'Courses & Bookmarks',
  add_bookmark: 'Add Bookmark',
  bookmark_title: 'Bookmark Title',
  delete_bookmark: 'Delete',
  empty_bookmarks: 'No saved bookmarks',
  default_course_title: 'CS101: Intro to Computer Science',
  security_notice: 'Chromium engine. Authenticated or restricted pages can be opened in external Chrome.',
  select_tip: 'Highlight text to ask the Agent or archive into knowledge graph.',
  study_hub_title: 'Study & Course Hub',
  study_hub_subtitle: 'Quick access to standard courses, preprints, and research documentation with 1-click clipping',
  launch_cs: 'Intro to Computer Science (CS101)',
  launch_mit: 'MIT OpenCourseWare (MIT OCW)',
  launch_arxiv: 'arXiv Scholarly Preprints',
  launch_coursera: 'Coursera Learning Portal',
  search_or_url: 'Search courses, docs or enter URL...',
  reading_time: '~3 min read',
  reading_outline: 'MarkItDown Structured Outline',
}
