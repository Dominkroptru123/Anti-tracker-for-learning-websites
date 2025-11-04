(() => {
  const BLOCKED_EVENTS = [
    'mousemove', 'mouseenter', 'mouseleave','mouseover', 'mouseout','pointermove', 'pointerenter', 'pointerleave','focus', 'blur', 'focusin', 'focusout', 'visibilitychange'
  ];

  function stopEvent(e) {
    e.stopImmediatePropagation();
    e.stopPropagation();
  }

  for (const type of BLOCKED_EVENTS) {
    window.addEventListener(type, stopEvent, true);
    document.addEventListener(type, stopEvent, true);
  }
  Object.defineProperty(document, 'hidden', { get: () => false });
  Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
  document.hasFocus = () => true;
  window.onblur = null;
  window.onfocus = null;
  Object.defineProperty(window, 'onblur', {
    get: () => null,
    set: () => {},
    configurable: true
  });
  Object.defineProperty(window, 'onfocus', {
    get: () => null,
    set: () => {},
    configurable: true
  });
  console.log('Run disable() to restore.');
  window.disable = () => {
    for (const type of BLOCKED_EVENTS) {
      window.removeEventListener(type, stopEvent, true);
      document.removeEventListener(type, stopEvent, true);
    }
  };
})();
