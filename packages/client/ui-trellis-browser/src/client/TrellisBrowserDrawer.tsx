/**
 * Trellis Companion In-App Browser Drawer and header utility button component.
 * Opens on-demand as a side drawer when inspecting source links or studying.
 *
 * @module @deepseek-ai/dsh-client-ui-trellis-browser/client/TrellisBrowserDrawer
 */

import { useCallback, useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { zh, type TrellisBrowserKey } from './locales.ts'
import { TrellisBrowserView } from './TrellisBrowserView.tsx'
import css from './TrellisBrowserDrawer.module.css'

/** Header utility props passed to the drawer component. */
export type TrellisBrowserDrawerProps = Partial<PropsRuntime<'conversation.session.header.utilities'>> & Partial<PropsLocale<'ui-trellis-browser'>>

/**
 * Renders the top-right "🌐 伴学浏览器" trigger button and slide-out companion drawer.
 */
export function TrellisBrowserDrawer(props: TrellisBrowserDrawerProps): ReactElement {
  const t = props.t ?? ((key: TrellisBrowserKey) => zh[key])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleOpen = () => {
      setOpen(true)
    }
    window.addEventListener('trellis:open-browser', handleOpen)
    return () => {
      window.removeEventListener('trellis:open-browser', handleOpen)
    }
  }, [])

  const handleToggle = useCallback(() => {
    setOpen(prev => !prev)
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
  }, [])

  return (
    <>
      <button
        type="button"
        className={css.triggerButton}
        onClick={handleToggle}
        title={t('view.browser')}
        aria-label={t('view.browser')}
        data-testid="trellis-browser-drawer-trigger"
      >
        <span className={css.triggerLabel}>{t('view.browser')}</span>
      </button>

      {open && (
        <div className={css.drawerBackdrop} onClick={handleClose}>
          <div
            className={css.drawerContainer}
            onClick={(e) => { e.stopPropagation() }}
            data-testid="trellis-browser-drawer"
          >
            <div className={css.drawerHeader}>
              <div className={css.drawerTitle}>
                <span>🌐</span>
                <span>{t('view.browser')}</span>
              </div>
              <button
                type="button"
                className={css.closeButton}
                onClick={handleClose}
                title="关闭抽屉"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
            <div className={css.drawerBody}>
              <TrellisBrowserView
                t={props.t}
                inputActions={props.inputActions}
                onClose={handleClose}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
