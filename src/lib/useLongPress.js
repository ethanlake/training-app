import { useRef } from 'react'

// Long-press on touch, right-click on a desktop. Returns props to spread onto
// the element.
//
// The awkward part is the click that a touch always fires afterwards: without
// suppressing it, long-pressing a tag to delete it would also toggle it on. A
// capture-phase handler swallows exactly the one click that follows a press
// that fired.
export function useLongPress(onLongPress, { delay = 500, moveTolerance = 10 } = {}) {
  const timer = useRef(null)
  const origin = useRef(null)
  const fired = useRef(false)

  const cancel = () => {
    clearTimeout(timer.current)
    timer.current = null
    origin.current = null
  }

  // Android fires its own contextmenu at roughly the same moment our timer
  // elapses, so both routes funnel through here and only the first one in a
  // press cycle counts. Otherwise a single hold opens two dialogs.
  const trigger = () => {
    if (fired.current) return
    fired.current = true
    cancel()
    onLongPress()
  }

  return {
    onPointerDown: (e) => {
      // Reset before the button check: a right-click never reaches the timer,
      // but it still begins a new cycle.
      fired.current = false
      if (e.pointerType === 'mouse' && e.button !== 0) return
      origin.current = { x: e.clientX, y: e.clientY }
      timer.current = setTimeout(trigger, delay)
    },
    // A finger never holds perfectly still; only a real drag should cancel.
    onPointerMove: (e) => {
      if (!origin.current) return
      const { x, y } = origin.current
      if (Math.hypot(e.clientX - x, e.clientY - y) > moveTolerance) cancel()
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e) => {
      e.preventDefault()
      trigger()
    },
    // Swallow the click a touch fires after the press. Deliberately does not
    // clear the flag — the next pointerdown does that, so ordering between
    // click and contextmenu cannot matter.
    onClickCapture: (e) => {
      if (!fired.current) return
      e.preventDefault()
      e.stopPropagation()
    },
  }
}
