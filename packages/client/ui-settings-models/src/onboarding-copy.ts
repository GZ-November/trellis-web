/** Durable settings namespace for product-wide GUI onboarding facts. */
export const WELCOME_NOTICE_SETTINGS_NAMESPACE = 'ui-onboarding'

/** Field storing the last welcome notice version the user acknowledged. */
export const WELCOME_NOTICE_ACK_FIELD = 'welcomeNoticeVersion'

/**
 * Bump only when the notice changes materially and every user should see it
 * again. The acknowledgement is compared for exact equality.
 */
export const WELCOME_NOTICE_VERSION = '2026-08-13.1'

/** The complete editable internal-testing notice in both supported GUI locales. */
export const WELCOME_NOTICE_COPY = {
  zh: {
    title: '内测声明',
    body: 'Trellis 目前的版本仍处在面向个人用户进行测试和迭代的阶段，还有许多地方需要持续改进和打磨，希望听取你的反馈建议。预计 Trellis 的核心插件以及基础 API 都会在接下来的一段时间内快速迭代、持续演化。\n\nTrellis 是一款基于 DeepSeek Harness 构建的独立学术与职业工作台，所有数据默认保存在本地。',
    continueLabel: '继续',
  },
  en: {
    title: 'Internal Testing Notice',
    body: "Trellis is currently in personal testing and iteration. Many areas need further improvement, and we welcome your feedback. Trellis's core plugins and foundational APIs will continue to evolve rapidly over the coming months.\n\nTrellis is an independent academic and career workbench built on DeepSeek Harness. All data stays local by default.",
    continueLabel: 'Continue',
  },
} as const
