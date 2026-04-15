(() => {
  const BLOCKED_EVENTS = [
    'mousemove','mouseenter','mouseleave','mouseover','mouseout',
    'pointermove','pointerenter','pointerleave',
    'focus','blur','focusin','focusout','visibilitychange',
    'fullscreenchange','resize','webkitvisibilitychange'
  ];

  const originalProps = {
    hidden: Object.getOwnPropertyDescriptor(Document.prototype, 'hidden'),
    visibilityState: Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState'),
    hasFocus: Document.prototype.hasFocus,
    onblur: window.onblur,
    onfocus: window.onfocus,
    fullscreenElement: Object.getOwnPropertyDescriptor(Document.prototype, 'fullscreenElement')
  };

  function stopEvent(e) {
    e.stopImmediatePropagation();
    e.stopPropagation();
  }

  // Add blockers for all listed events
  for (const type of BLOCKED_EVENTS) {
    window.addEventListener(type, stopEvent, true);
    document.addEventListener(type, stopEvent, true);
  }

  // Fake document visibility and focus
  Object.defineProperty(document, 'hidden', { get: () => false });
  Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
  document.hasFocus = () => true;

  // Disable blur/focus handlers
  window.onblur = null;
  window.onfocus = null;
  Object.defineProperty(window, 'onblur', { get: () => null, set: () => {}, configurable: true });
  Object.defineProperty(window, 'onfocus', { get: () => null, set: () => {}, configurable: true });

  // Disable fullscreen detection
  Object.defineProperty(document, 'fullscreenElement', { get: () => null });

  console.log('Run disable() to restore original behavior.');

  // Full restore function
  window.disable = () => {
    // Remove all event blockers
    for (const type of BLOCKED_EVENTS) {
      window.removeEventListener(type, stopEvent, true);
      document.removeEventListener(type, stopEvent, true);
    }

    // Restore original document properties
    if (originalProps.hidden) Object.defineProperty(document, 'hidden', originalProps.hidden);
    if (originalProps.visibilityState) Object.defineProperty(document, 'visibilityState', originalProps.visibilityState);
    document.hasFocus = originalProps.hasFocus;

    // Restore blur/focus handlers
    window.onblur = originalProps.onblur;
    window.onfocus = originalProps.onfocus;
    Object.defineProperty(window, 'onblur', { value: originalProps.onblur, configurable: true, writable: true });
    Object.defineProperty(window, 'onfocus', { value: originalProps.onfocus, configurable: true, writable: true });

    // Restore fullscreen detection
    if (originalProps.fullscreenElement) Object.defineProperty(document, 'fullscreenElement', originalProps.fullscreenElement);

    console.log('Restored original behavior.');
  };
})();
