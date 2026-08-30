// Contradictions Indicator — Client half (Cordis dynamic Plugin)
//
// Polls the Host's `get-analysis` RPC every 3 seconds and renders:
//   - A colored score badge in `conversation.session.header.utilities`
//     (green >=80%, yellow >=50%, red <50%; "Analyzing..." / "Analysis
//     error" states while no score is available yet).
//   - A click-to-expand overlay panel in `shell.overlay` with the full
//     score and commentary text.
//
// State is shared between the badge and the overlay through a small
// closure-scoped pub/sub store, since the two components live in separate
// Slot subtrees. Styling uses real DSH theme tokens (queried via
// Theme.listTokens) so it follows light/dark mode.

const CSS_TEXT = [
  '.contra-badge {',
  '  display: inline-flex; align-items: center; gap: 4px;',
  '  padding: 2px 8px; border-radius: 999px;',
  '  border: 1px solid var(--dsw-alias-border-l1);',
  '  background: transparent;',
  '  font-size: 12px; font-weight: 600; line-height: 1.4;',
  '  cursor: pointer; font-family: inherit;',
  '}',
  '.contra-badge-analyzing, .contra-badge-error {',
  '  color: var(--dsw-alias-label-secondary);',
  '  cursor: default;',
  '}',
  '.contra-dot {',
  '  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block;',
  '}',
  '.contra-badge-good { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }',
  '.contra-badge-good .contra-dot { background: var(--dsw-alias-state-success-primary); }',
  '.contra-badge-warn { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); }',
  '.contra-badge-warn .contra-dot { background: var(--dsw-alias-state-warn-primary); }',
  '.contra-badge-bad { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }',
  '.contra-badge-bad .contra-dot { background: var(--dsw-alias-state-error-primary); }',
  '.contra-overlay {',
  '  position: fixed; bottom: 16px; right: 16px; width: 360px; max-height: 60vh;',
  '  display: flex; flex-direction: column;',
  '  border-radius: 12px; overflow: hidden;',
  '  box-shadow: 0 8px 32px rgba(0,0,0,0.28);',
  '  z-index: 1000; pointer-events: auto;',
  '  background: var(--dsw-alias-bg-overlay);',
  '  border: 1px solid var(--dsw-alias-border-l1);',
  '  color: var(--dsw-alias-label-primary);',
  '  font-family: inherit;',
  '}',
  '.contra-overlay-header {',
  '  padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;',
  '  border-bottom: 1px solid var(--dsw-alias-border-l1);',
  '  flex-shrink: 0;',
  '}',
  '.contra-overlay-title { font-size: 13px; font-weight: 600; }',
  '.contra-overlay-close {',
  '  background: transparent; border: none; color: var(--dsw-alias-label-secondary);',
  '  cursor: pointer; font-size: 14px; padding: 2px 6px; line-height: 1;',
  '}',
  '.contra-overlay-score {',
  '  font-size: 36px; font-weight: 700; padding: 12px 16px 0 16px; flex-shrink: 0;',
  '}',
  '.contra-score-good { color: var(--dsw-alias-state-success-primary); }',
  '.contra-score-warn { color: var(--dsw-alias-state-warn-primary); }',
  '.contra-score-bad { color: var(--dsw-alias-state-error-primary); }',
  '.contra-score-neutral { color: var(--dsw-alias-label-secondary); }',
  '.contra-overlay-status {',
  '  padding: 4px 16px 12px 16px; font-size: 11px; color: var(--dsw-alias-label-secondary);',
  '  flex-shrink: 0;',
  '}',
  '.contra-overlay-body {',
  '  padding: 0 16px 16px 16px; overflow-y: auto; font-size: 13px; line-height: 1.6;',
  '  white-space: pre-wrap; word-break: break-word; color: var(--dsw-alias-label-primary);',
  '}'
].join('\n')

function scoreClass(score) {
  if (score === null) return 'neutral'
  if (score >= 80) return 'good'
  if (score >= 50) return 'warn'
  return 'bad'
}

return {
  inject: ['timer'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    const store = {
      state: { score: null, commentary: null, status: 'idle', messageCount: 0 },
      listeners: [],
      overlayVisible: false,
      overlayListeners: []
    }

    function notifyState() {
      for (let i = 0; i < store.listeners.length; i++) store.listeners[i](store.state)
    }
    function notifyOverlay() {
      for (let i = 0; i < store.overlayListeners.length; i++) store.overlayListeners[i](store.overlayVisible)
    }
    function subscribeState(fn) {
      store.listeners.push(fn)
      return function () {
        const idx = store.listeners.indexOf(fn)
        if (idx >= 0) store.listeners.splice(idx, 1)
      }
    }
    function subscribeOverlay(fn) {
      store.overlayListeners.push(fn)
      return function () {
        const idx = store.overlayListeners.indexOf(fn)
        if (idx >= 0) store.overlayListeners.splice(idx, 1)
      }
    }
    function toggleOverlay() {
      store.overlayVisible = !store.overlayVisible
      notifyOverlay()
    }
    function closeOverlay() {
      store.overlayVisible = false
      notifyOverlay()
    }

    function poll() {
      host.call('get-analysis').then(function (result) {
        store.state = result
        notifyState()
      }).catch(function (err) {
        console.error('contradictions-indicator: poll failed', err)
      })
    }

    poll()
    ctx.interval(poll, 3000)
    styles.insert(CSS_TEXT)

    function ContradictionsBadge(props) {
      const s = React.useState(store.state)
      const state = s[0]
      const setState = s[1]

      React.useEffect(function () {
        return subscribeState(setState)
      }, [])

      if (state.status === 'idle' && state.score === null) {
        return null
      }
      if (state.status === 'analyzing' && state.score === null) {
        return React.createElement(
          'span',
          { className: 'contra-badge contra-badge-analyzing', title: 'Analyzing contradictions...' },
          'Analyzing\u2026'
        )
      }
      if (state.status === 'error' && state.score === null) {
        return React.createElement(
          'span',
          { className: 'contra-badge contra-badge-error', title: 'Contradiction analysis failed' },
          'Analysis error'
        )
      }
      if (state.score === null) return null

      const cls = scoreClass(state.score)
      return React.createElement(
        'button',
        {
          className: 'contra-badge contra-badge-' + cls,
          onClick: function () { toggleOverlay() },
          title: 'Coherence score: ' + state.score + '% \u2014 click for details'
        },
        React.createElement('span', { className: 'contra-dot' }),
        state.score + '%'
      )
    }

    function ContradictionsOverlay() {
      const v = React.useState(store.overlayVisible)
      const visible = v[0]
      const setVisible = v[1]

      const s = React.useState(store.state)
      const state = s[0]
      const setState = s[1]

      React.useEffect(function () {
        const unsubOverlay = subscribeOverlay(setVisible)
        const unsubState = subscribeState(setState)
        return function () {
          unsubOverlay()
          unsubState()
        }
      }, [])

      if (!visible) return null

      const cls = scoreClass(state.score)
      const statusText = state.status === 'analyzing'
        ? 'Analyzing\u2026'
        : state.status === 'error'
          ? 'Last analysis failed'
          : 'Coherence score (0% = contradictory, 100% = smooth)'

      return React.createElement(
        'div',
        { className: 'contra-overlay' },
        React.createElement(
          'div',
          { className: 'contra-overlay-header' },
          React.createElement('div', { className: 'contra-overlay-title' }, 'Contradiction Analysis'),
          React.createElement(
            'button',
            { className: 'contra-overlay-close', onClick: function () { closeOverlay() } },
            '\u2715'
          )
        ),
        React.createElement(
          'div',
          { className: 'contra-overlay-score contra-score-' + cls },
          state.score === null ? '\u2014' : state.score + '%'
        ),
        React.createElement('div', { className: 'contra-overlay-status' }, statusText),
        React.createElement(
          'div',
          { className: 'contra-overlay-body' },
          state.commentary || 'No analysis yet. Send a few messages to get started.'
        )
      )
    }

    slots.inject('conversation.session.header.utilities', function () {
      return slots.register(
        { name: 'conversation.session.header.utilities', id: 'contradictions-indicator', order: 10 },
        function (props) { return React.createElement(ContradictionsBadge, props) }
      )
    })

    slots.inject('shell.overlay', function () {
      return slots.register(
        { name: 'shell.overlay', id: 'contradictions-overlay', order: 50 },
        function () { return React.createElement(ContradictionsOverlay, null) }
      )
    })
  }
}
