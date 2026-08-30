// Contradictions Indicator — Client half (Cordis dynamic Plugin)
//
// Polls the Host's `get-analysis` RPC every 3 seconds and renders:
//   - A colored score badge in `conversation.session.header.utilities`.
//     When no score exists yet, shows a subtle "⚡ Analyze" button instead.
//   - A click-to-expand overlay panel in `shell.overlay` with:
//       • Score (large, colored)
//       • Auto-analysis toggle checkbox (off by default)
//       • Progress to next auto-analysis (e.g. "18 / 25 turns")
//       • Manual "Analyze Now" button (always available)
//       • Commentary text

const CSS_TEXT = [
  '.contra-badge {',
  '  display: inline-flex; align-items: center; gap: 4px;',
  '  padding: 2px 8px; border-radius: 999px;',
  '  border: 1px solid var(--dsw-alias-border-l1);',
  '  background: transparent;',
  '  font-size: 12px; font-weight: 600; line-height: 1.4;',
  '  cursor: pointer; font-family: inherit;',
  '}',
  '.contra-badge-idle {',
  '  color: var(--dsw-alias-label-secondary);',
  '  border-color: var(--dsw-alias-border-l1);',
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
  '  position: fixed; bottom: 16px; right: 16px; width: 380px; max-height: 70vh;',
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
  '  font-size: 40px; font-weight: 700; padding: 14px 16px 2px 16px; flex-shrink: 0;',
  '}',
  '.contra-score-good { color: var(--dsw-alias-state-success-primary); }',
  '.contra-score-warn { color: var(--dsw-alias-state-warn-primary); }',
  '.contra-score-bad { color: var(--dsw-alias-state-error-primary); }',
  '.contra-score-neutral { color: var(--dsw-alias-label-secondary); }',
  '.contra-overlay-status {',
  '  padding: 2px 16px 10px 16px; font-size: 11px; color: var(--dsw-alias-label-secondary);',
  '  flex-shrink: 0;',
  '}',
  '.contra-overlay-controls {',
  '  padding: 8px 16px 12px 16px; display: flex; flex-direction: column; gap: 10px;',
  '  border-top: 1px solid var(--dsw-alias-border-l1);',
  '  border-bottom: 1px solid var(--dsw-alias-border-l1);',
  '  flex-shrink: 0;',
  '}',
  '.contra-auto-row {',
  '  display: flex; align-items: center; gap: 8px; font-size: 12px;',
  '}',
  '.contra-auto-row label { cursor: pointer; color: var(--dsw-alias-label-primary); user-select: none; }',
  '.contra-auto-row input[type=checkbox] { cursor: pointer; width: 14px; height: 14px; flex-shrink: 0; }',
  '.contra-progress {',
  '  font-size: 11px; color: var(--dsw-alias-label-secondary); padding-left: 22px;',
  '}',
  '.contra-progress-bar-track {',
  '  height: 4px; border-radius: 2px; background: var(--dsw-alias-border-l1);',
  '  margin-top: 4px; overflow: hidden;',
  '}',
  '.contra-progress-bar-fill {',
  '  height: 100%; border-radius: 2px; background: var(--dsw-alias-state-business-primary, #4a90e2);',
  '  transition: width 0.3s ease;',
  '}',
  '.contra-btn-analyze {',
  '  width: 100%; padding: 7px 12px; border-radius: 6px;',
  '  background: transparent; border: 1px solid var(--dsw-alias-border-l1);',
  '  color: var(--dsw-alias-label-primary); cursor: pointer; font-size: 12px; font-weight: 500;',
  '  font-family: inherit; text-align: center;',
  '}',
  '.contra-btn-analyze:hover { background: var(--dsw-alias-interactive-bg-hover); }',
  '.contra-btn-analyze:disabled { opacity: 0.5; cursor: default; }',
  '.contra-overlay-body {',
  '  padding: 12px 16px 16px 16px; overflow-y: auto; font-size: 13px; line-height: 1.6;',
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
      state: {
        score: null, commentary: null, status: 'idle', messageCount: 0,
        turnsSinceLastAnalysis: 0, turnsUntilNext: null,
        autoEnabled: false, analysisInterval: 25
      },
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

    function setAuto(enabled) {
      host.call('set-auto', { enabled: enabled }).then(function (result) {
        store.state = result
        notifyState()
      }).catch(function (err) {
        console.error('contradictions-indicator: set-auto failed', err)
      })
    }

    function triggerAnalysis(onDone) {
      host.call('trigger-analysis').then(function (result) {
        if (result && result.triggered) {
          // poll immediately to pick up 'analyzing' status
          poll()
        }
        if (onDone) onDone(result)
      }).catch(function (err) {
        console.error('contradictions-indicator: trigger failed', err)
        if (onDone) onDone({ triggered: false, reason: err.message })
      })
    }

    poll()
    ctx.interval(poll, 3000)
    styles.insert(CSS_TEXT)

    // Badge — shown in session header
    function ContradictionsBadge(props) {
      const s = React.useState(store.state)
      const state = s[0]
      const setState = s[1]

      React.useEffect(function () {
        return subscribeState(setState)
      }, [])

      // Always show something — idle shows a subtle "⚡" trigger button
      if (state.status === 'analyzing' && state.score === null) {
        return React.createElement(
          'span',
          { className: 'contra-badge contra-badge-analyzing', title: 'Analyzing contradictions...' },
          'Analyzing\u2026'
        )
      }
      if (state.status === 'error' && state.score === null) {
        return React.createElement(
          'button',
          {
            className: 'contra-badge contra-badge-error',
            onClick: function () { toggleOverlay() },
            title: 'Contradiction analysis failed — click for details'
          },
          'Analysis error'
        )
      }
      if (state.score !== null) {
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
      // idle / no score yet — show subtle trigger
      return React.createElement(
        'button',
        {
          className: 'contra-badge contra-badge-idle',
          onClick: function () { toggleOverlay() },
          title: 'Contradiction Indicator \u2014 click to open'
        },
        '\u26A1 Analyze'
      )
    }

    // Overlay panel
    function ContradictionsOverlay() {
      const v = React.useState(store.overlayVisible)
      const visible = v[0]
      const setVisible = v[1]

      const s = React.useState(store.state)
      const state = s[0]
      const setState = s[1]

      const t = React.useState(false) // triggering spinner
      const triggering = t[0]
      const setTriggering = t[1]

      const m = React.useState(null) // trigger message
      const triggerMsg = m[0]
      const setTriggerMsg = m[1]

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
      const isAnalyzing = state.status === 'analyzing'

      // Status line under score
      var statusText
      if (isAnalyzing) {
        statusText = 'Analyzing\u2026'
      } else if (state.status === 'error') {
        statusText = 'Last analysis failed'
      } else if (state.score !== null) {
        statusText = 'Coherence score \u2014 0% = contradictory, 100% = smooth'
      } else {
        statusText = 'No analysis yet'
      }

      // Progress info for auto mode
      var progressEl = null
      if (state.autoEnabled && state.turnsUntilNext !== null) {
        var pct = state.analysisInterval > 0
          ? Math.min(100, Math.round((state.turnsSinceLastAnalysis / state.analysisInterval) * 100))
          : 0
        progressEl = React.createElement(
          'div',
          { className: 'contra-progress' },
          state.turnsUntilNext === 0
            ? 'Next analysis: this turn'
            : 'Next auto-analysis in ' + state.turnsUntilNext + ' turn' + (state.turnsUntilNext === 1 ? '' : 's') +
              ' (' + state.turnsSinceLastAnalysis + '\u00a0/\u00a0' + state.analysisInterval + ')',
          React.createElement(
            'div',
            { className: 'contra-progress-bar-track' },
            React.createElement('div', { className: 'contra-progress-bar-fill', style: { width: pct + '%' } })
          )
        )
      } else if (!state.autoEnabled) {
        progressEl = React.createElement(
          'div',
          { className: 'contra-progress' },
          'Auto-analysis is off for this session'
        )
      }

      function handleTrigger() {
        if (isAnalyzing || triggering) return
        setTriggering(true)
        setTriggerMsg(null)
        triggerAnalysis(function (result) {
          setTriggering(false)
          if (result && !result.triggered) {
            setTriggerMsg(result.reason || 'Could not trigger analysis.')
          }
        })
      }

      function handleAutoChange(e) {
        setAuto(e.target.checked)
      }

      return React.createElement(
        'div',
        { className: 'contra-overlay' },

        // Header
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

        // Score
        React.createElement(
          'div',
          { className: 'contra-overlay-score contra-score-' + cls },
          state.score === null ? '\u2014' : state.score + '%'
        ),
        React.createElement('div', { className: 'contra-overlay-status' }, statusText),

        // Controls (auto toggle + progress + manual trigger)
        React.createElement(
          'div',
          { className: 'contra-overlay-controls' },

          // Auto-analysis checkbox row
          React.createElement(
            'div',
            { className: 'contra-auto-row' },
            React.createElement('input', {
              type: 'checkbox',
              id: 'contra-auto-checkbox',
              checked: state.autoEnabled,
              onChange: handleAutoChange
            }),
            React.createElement(
              'label',
              { htmlFor: 'contra-auto-checkbox' },
              'Auto-analyze every ' + state.analysisInterval + ' turns'
            )
          ),

          // Progress bar (only when auto is on)
          progressEl,

          // Manual trigger button
          React.createElement(
            'button',
            {
              className: 'contra-btn-analyze',
              onClick: handleTrigger,
              disabled: isAnalyzing || triggering
            },
            isAnalyzing || triggering ? 'Analyzing\u2026' : '\u26A1\u00a0Analyze Now'
          ),

          // Trigger error message
          triggerMsg
            ? React.createElement('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-state-error-primary)' } }, triggerMsg)
            : null
        ),

        // Commentary
        React.createElement(
          'div',
          { className: 'contra-overlay-body' },
          state.commentary || 'No analysis yet. Click \u201cAnalyze Now\u201d or enable auto-analysis.'
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
