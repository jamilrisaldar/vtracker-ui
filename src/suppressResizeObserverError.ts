/**
 * Chromium sometimes throws this when ResizeObserver callbacks run layout-affecting work
 * in the same frame. It is benign; the browser still delivers notifications on the next frame.
 * Without this, Vite’s dev overlay reports it as an unhandled error.
 * @see https://bugs.chromium.org/p/chromium/issues/detail?id=809574
 */
const RESIZE_OBSERVER_LOOP_MSG =
  'ResizeObserver loop completed with undelivered notifications.'

let installed = false

export function suppressResizeObserverLoopError(): void {
  if (installed) return
  installed = true
  window.addEventListener(
    'error',
    (event) => {
      if (event.message === RESIZE_OBSERVER_LOOP_MSG) {
        event.stopImmediatePropagation()
      }
    },
    true,
  )
}
