(() => {
    'use strict';

    const KEY = '__FocusVisibilityShield__';

    if (window[KEY]?.disable) {
        window[KEY].disable();
    }

    const BLOCKED_EVENTS = new Set([
        // Focus
        'focus',
        'blur',
        'focusin',
        'focusout',

        // Visibility
        'visibilitychange',
        'webkitvisibilitychange',

        // Fullscreen
        'fullscreenchange',
        'webkitfullscreenchange',
        'fullscreenerror',
        'webkitfullscreenerror',

        // Page lifecycle
        'pagehide',
        'pageshow',
        'freeze',
        'resume',

        // Navigation / unload
        'beforeunload',
        'unload',

        // Pointer leaving/entering the browser area
        'mouseenter',
        'mouseleave',
        'mouseover',
        'mouseout',
        'pointerenter',
        'pointerleave',
        'pointermove',
        'mousemove'
    ]);

    const EVENT_PROPERTIES = [
        'onfocus',
        'onblur',
        'onfocusin',
        'onfocusout',

        'onvisibilitychange',
        'onwebkitvisibilitychange',

        'onfullscreenchange',
        'onwebkitfullscreenchange',
        'onfullscreenerror',
        'onwebkitfullscreenerror',

        'onpagehide',
        'onpageshow',
        'onfreeze',
        'onresume',

        'onbeforeunload',
        'onunload',

        'onmouseenter',
        'onmouseleave',
        'onmouseover',
        'onmouseout',
        'onpointerenter',
        'onpointerleave',
        'onpointermove',
        'onmousemove'
    ];

    const originals = {
        descriptors: [],
        methods: {
            addEventListener: EventTarget.prototype.addEventListener,
            removeEventListener: EventTarget.prototype.removeEventListener
        }
    };

    const blocked = type =>
        typeof type === 'string' &&
        BLOCKED_EVENTS.has(type.toLowerCase());

    function stopEvent(event) {
        event.stopImmediatePropagation();
        event.stopPropagation();
    }

    function saveDescriptor(target, property) {
        const descriptor = Object.getOwnPropertyDescriptor(target, property);

        if (descriptor) {
            originals.descriptors.push({
                target,
                property,
                descriptor
            });
        } else {
            originals.descriptors.push({
                target,
                property,
                descriptor: undefined
            });
        }

        return descriptor;
    }

    function patchDescriptor(target, property, replacement) {
        const original = saveDescriptor(target, property);

        if (!original || !original.configurable) {
            return false;
        }

        try {
            Object.defineProperty(target, property, {
                ...original,
                ...replacement,
                configurable: true
            });

            return true;
        } catch {
            return false;
        }
    }

    function shadowProperty(target, property, getter, setter) {
        const original = saveDescriptor(target, property);

        try {
            Object.defineProperty(target, property, {
                configurable: true,
                enumerable: original?.enumerable ?? false,
                get: getter,
                set: setter
            });

            return true;
        } catch {
            return false;
        }
    }

    /*
     * 1. Stop future event listeners from being registered.
     *
     * This is important because only blocking the event itself is not
     * enough when the page later registers another listener.
     */
    try {
        Object.defineProperty(EventTarget.prototype, 'addEventListener', {
            configurable: true,
            writable: true,
            value: function(type, listener, options) {
                if (blocked(type)) {
                    return;
                }

                return originals.methods.addEventListener.call(
                    this,
                    type,
                    listener,
                    options
                );
            }
        });

        Object.defineProperty(EventTarget.prototype, 'removeEventListener', {
            configurable: true,
            writable: true,
            value: function(type, listener, options) {
                if (blocked(type)) {
                    return;
                }

                return originals.methods.removeEventListener.call(
                    this,
                    type,
                    listener,
                    options
                );
            }
        });
    } catch (error) {
        console.warn('[Shield] Could not patch EventTarget:', error);
    }

    /*
     * 2. Block events that were already registered.
     *
     * Register BEFORE doing more patches so this listener itself does
     * not get filtered by our addEventListener replacement.
     */
    for (const type of BLOCKED_EVENTS) {
        try {
            originals.methods.addEventListener.call(
                window,
                type,
                stopEvent,
                true
            );
        } catch {}

        try {
            originals.methods.addEventListener.call(
                document,
                type,
                stopEvent,
                true
            );
        } catch {}
    }

    /*
     * 3. Fake Page Visibility API.
     *
     * Pages normally inspect:
     *   document.hidden
     *   document.visibilityState
     */
    patchDescriptor(
        Document.prototype,
        'hidden',
        {
            get: () => false,
            set: undefined
        }
    );

    patchDescriptor(
        Document.prototype,
        'visibilityState',
        {
            get: () => 'visible',
            set: undefined
        }
    );

    /*
     * Instance-level overrides as an additional layer.
     */
    shadowProperty(
        document,
        'hidden',
        () => false,
        () => {}
    );

    shadowProperty(
        document,
        'visibilityState',
        () => 'visible',
        () => {}
    );

    /*
     * 4. Fake focus state.
     */
    patchDescriptor(
        Document.prototype,
        'hasFocus',
        {
            value: function() {
                return true;
            }
        }
    );

    try {
        Object.defineProperty(document, 'hasFocus', {
            configurable: true,
            writable: true,
            value: function() {
                return true;
            }
        });
    } catch {}

    /*
     * 5. Hide fullscreen state.
     */
    patchDescriptor(
        Document.prototype,
        'fullscreenElement',
        {
            get: () => null,
            set: undefined
        }
    );

    patchDescriptor(
        Document.prototype,
        'webkitFullscreenElement',
        {
            get: () => null,
            set: undefined
        }
    );

    shadowProperty(
        document,
        'fullscreenElement',
        () => null,
        () => {}
    );

    shadowProperty(
        document,
        'webkitFullscreenElement',
        () => null,
        () => {}
    );

    /*
     * 6. Kill onevent-style handlers.
     *
     * Example:
     *   window.onblur = ...
     *   document.onvisibilitychange = ...
     */
    const targets = [
        window,
        document
    ];

    for (const target of targets) {
        for (const property of EVENT_PROPERTIES) {
            shadowProperty(
                target,
                property,
                () => null,
                () => {}
            );
        }
    }

    /*
     * 7. Some pages inspect the lifecycle-related prototype handlers.
     */
    const prototypeTargets = [
        Window.prototype,
        Document.prototype
    ];

    for (const target of prototypeTargets) {
        for (const property of EVENT_PROPERTIES) {
            patchDescriptor(
                target,
                property,
                {
                    get: () => null,
                    set: () => {}
                }
            );
        }
    }

    /*
     * 8. Optional compatibility properties used by some Chromium code.
     */
    patchDescriptor(
        Document.prototype,
        'wasDiscarded',
        {
            get: () => false,
            set: undefined
        }
    );

    /*
     * 9. Provide a status object.
     */
    const state = {
        enabled: true,
        blockedEvents: [...BLOCKED_EVENTS],

        status() {
            return {
                enabled: this.enabled,
                hidden: document.hidden,
                visibilityState: document.visibilityState,
                hasFocus: document.hasFocus(),
                fullscreenElement: document.fullscreenElement,
                wasDiscarded: 'wasDiscarded' in document
                    ? document.wasDiscarded
                    : undefined
            };
        },

        disable() {
            if (!this.enabled) {
                return;
            }

            /*
             * Remove our event blockers using the ORIGINAL API.
             */
            for (const type of BLOCKED_EVENTS) {
                try {
                    originals.methods.removeEventListener.call(
                        window,
                        type,
                        stopEvent,
                        true
                    );
                } catch {}

                try {
                    originals.methods.removeEventListener.call(
                        document,
                        type,
                        stopEvent,
                        true
                    );
                } catch {}
            }

            /*
             * Restore every descriptor in reverse order.
             */
            for (let i = originals.descriptors.length - 1; i >= 0; i--) {
                const item = originals.descriptors[i];

                try {
                    if (item.descriptor) {
                        Object.defineProperty(
                            item.target,
                            item.property,
                            item.descriptor
                        );
                    } else {
                        delete item.target[item.property];
                    }
                } catch {}
            }

            /*
             * Restore EventTarget methods.
             */
            try {
                Object.defineProperty(
                    EventTarget.prototype,
                    'addEventListener',
                    {
                        configurable: true,
                        writable: true,
                        value: originals.methods.addEventListener
                    }
                );
            } catch {}

            try {
                Object.defineProperty(
                    EventTarget.prototype,
                    'removeEventListener',
                    {
                        configurable: true,
                        writable: true,
                        value: originals.methods.removeEventListener
                    }
                );
            } catch {}

            this.enabled = false;

            try {
                delete window[KEY];
            } catch {}

            console.log('[Shield] Original browser behavior restored.');
        }
    };

    window[KEY] = state;

    /*
     * Convenience functions.
     */
    window.disableFocusShield = () => state.disable();
    window.focusShieldStatus = () => state.status();

    console.log(
        '[Shield] Enabled.',
        `Blocked ${BLOCKED_EVENTS.size} event types.`
    );

    console.log(
        '[Shield] Run focusShieldStatus() to inspect the current spoofed state.'
    );

    console.log(
        '[Shield] Run disableFocusShield() to restore original behavior.'
    );
})();
