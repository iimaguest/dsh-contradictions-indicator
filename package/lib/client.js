window.__ModuleLoader__.load({
	id: "dsh-contradictions-indicator",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let react = require("react");
		const h = react.createElement;

		//#region styles
		const CSS_TEXT = [
			'.contra-badge {',
			'  display: inline-flex; align-items: center; gap: 4px;',
			'  padding: 2px 8px; border-radius: 999px;',
			'  border: 1px solid var(--dsw-alias-border-l1);',
			'  background: transparent;',
			'  font-size: 12px; font-weight: 600; line-height: 1.4;',
			'  cursor: pointer; font-family: inherit;',
			'}',
			'.contra-badge-idle { color: var(--dsw-alias-label-secondary); }',
			'.contra-badge-analyzing { color: var(--dsw-alias-label-secondary); cursor: default; }',
			'.contra-badge-error { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }',
			'.contra-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block; }',
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
			'  border-bottom: 1px solid var(--dsw-alias-border-l1); flex-shrink: 0;',
			'}',
			'.contra-overlay-title { font-size: 13px; font-weight: 600; }',
			'.contra-overlay-close {',
			'  background: transparent; border: none; color: var(--dsw-alias-label-secondary);',
			'  cursor: pointer; font-size: 14px; padding: 2px 6px; line-height: 1;',
			'}',
			'.contra-overlay-score { font-size: 40px; font-weight: 700; padding: 14px 16px 2px 16px; flex-shrink: 0; }',
			'.contra-score-good { color: var(--dsw-alias-state-success-primary); }',
			'.contra-score-warn { color: var(--dsw-alias-state-warn-primary); }',
			'.contra-score-bad { color: var(--dsw-alias-state-error-primary); }',
			'.contra-score-neutral { color: var(--dsw-alias-label-secondary); }',
			'.contra-overlay-status { padding: 2px 16px 10px 16px; font-size: 11px; color: var(--dsw-alias-label-secondary); flex-shrink: 0; }',
			'.contra-overlay-controls {',
			'  padding: 10px 16px 12px 16px; display: flex; flex-direction: column; gap: 10px;',
			'  border-top: 1px solid var(--dsw-alias-border-l1);',
			'  border-bottom: 1px solid var(--dsw-alias-border-l1); flex-shrink: 0;',
			'}',
			'.contra-auto-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }',
			'.contra-auto-row label { cursor: pointer; color: var(--dsw-alias-label-primary); user-select: none; }',
			'.contra-auto-row input[type=checkbox] { cursor: pointer; width: 14px; height: 14px; flex-shrink: 0; }',
			'.contra-progress { font-size: 11px; color: var(--dsw-alias-label-secondary); padding-left: 22px; }',
			'.contra-progress-bar-track { height: 4px; border-radius: 2px; background: var(--dsw-alias-border-l1); margin-top: 4px; overflow: hidden; }',
			'.contra-progress-bar-fill { height: 100%; border-radius: 2px; background: var(--dsw-alias-state-success-primary); transition: width 0.3s ease; }',
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
		].join('\n');

		const TAG_ID = "dsh-contradictions-indicator/styles";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(TAG_ID) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-contradictions-indicator";
			tag.dataset.pluginCss = TAG_ID;
			tag.textContent = CSS_TEXT;
			document.head.appendChild(tag);
		}
		//#endregion

		//#region store
		function scoreClass(score) {
			if (score === null || score === undefined) return 'neutral';
			if (score >= 80) return 'good';
			if (score >= 50) return 'warn';
			return 'bad';
		}

		const EMPTY = {
			score: null, commentary: null, status: 'idle', messageCount: 0,
			turnsSinceLastAnalysis: 0, turnsUntilNext: null,
			autoEnabled: false, analysisInterval: 25
		};

		/** Shared store: the badge and the overlay live in separate slot subtrees. */
		const store = {
			state: EMPTY,
			listeners: [],
			overlayVisible: false,
			overlayListeners: [],
			sessionId: null
		};

		function notifyState() {
			for (const fn of store.listeners.slice()) fn(store.state);
		}
		function notifyOverlay() {
			for (const fn of store.overlayListeners.slice()) fn(store.overlayVisible);
		}
		function subscribeState(fn) {
			store.listeners.push(fn);
			return () => {
				const i = store.listeners.indexOf(fn);
				if (i >= 0) store.listeners.splice(i, 1);
			};
		}
		function subscribeOverlay(fn) {
			store.overlayListeners.push(fn);
			return () => {
				const i = store.overlayListeners.indexOf(fn);
				if (i >= 0) store.overlayListeners.splice(i, 1);
			};
		}
		function toggleOverlay() {
			store.overlayVisible = !store.overlayVisible;
			notifyOverlay();
		}
		function closeOverlay() {
			store.overlayVisible = false;
			notifyOverlay();
		}

		function query() {
			return store.sessionId ? '?sessionId=' + encodeURIComponent(store.sessionId) : '';
		}

		function poll() {
			fetch('/contradictions/state' + query())
				.then((r) => r.ok ? r.json() : null)
				.then((body) => {
					if (!body) return;
					store.state = body;
					notifyState();
				})
				.catch(() => {});
		}

		function setAuto(enabled) {
			fetch('/contradictions/auto' + query(), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ enabled: enabled })
			})
				.then((r) => r.ok ? r.json() : null)
				.then((body) => {
					if (!body) return;
					store.state = body;
					notifyState();
				})
				.catch(() => {});
		}

		function triggerAnalysis(onDone) {
			fetch('/contradictions/trigger' + query(), { method: 'POST' })
				.then((r) => r.ok ? r.json() : null)
				.then((body) => {
					if (body && body.triggered) poll();
					if (onDone) onDone(body || { triggered: false, reason: 'Request failed.' });
				})
				.catch((error) => {
					if (onDone) onDone({ triggered: false, reason: String(error && error.message || error) });
				});
		}
		//#endregion

		//#region components
		function ContradictionsBadge() {
			const [state, setState] = react.useState(store.state);
			react.useEffect(() => subscribeState(setState), []);

			if (state.status === 'analyzing' && state.score === null) {
				return h('span', {
					className: 'contra-badge contra-badge-analyzing',
					title: 'Analyzing contradictions\u2026'
				}, 'Analyzing\u2026');
			}
			if (state.status === 'error' && state.score === null) {
				return h('button', {
					className: 'contra-badge contra-badge-error',
					onClick: toggleOverlay,
					title: 'Analysis failed \u2014 click for details'
				}, 'Analysis error');
			}
			if (state.score !== null) {
				return h('button', {
					className: 'contra-badge contra-badge-' + scoreClass(state.score),
					onClick: toggleOverlay,
					title: 'Coherence score: ' + state.score + '% \u2014 click for details'
				}, h('span', { className: 'contra-dot' }), state.score + '%');
			}
			return h('button', {
				className: 'contra-badge contra-badge-idle',
				onClick: toggleOverlay,
				title: 'Contradiction Indicator \u2014 click to open'
			}, '\u26A1 Analyze');
		}

		function ContradictionsOverlay() {
			const [visible, setVisible] = react.useState(store.overlayVisible);
			const [state, setState] = react.useState(store.state);
			const [triggering, setTriggering] = react.useState(false);
			const [triggerMsg, setTriggerMsg] = react.useState(null);

			react.useEffect(() => {
				const a = subscribeOverlay(setVisible);
				const b = subscribeState(setState);
				return () => { a(); b(); };
			}, []);

			if (!visible) return null;

			const isAnalyzing = state.status === 'analyzing';

			let statusText;
			if (isAnalyzing) statusText = 'Analyzing\u2026';
			else if (state.status === 'error') statusText = 'Last analysis failed';
			else if (state.score !== null) statusText = 'Coherence score \u2014 0% = contradictory, 100% = smooth';
			else statusText = 'No analysis yet';

			let progressEl = null;
			if (state.autoEnabled && state.turnsUntilNext !== null && state.turnsUntilNext !== undefined) {
				const pct = state.analysisInterval > 0
					? Math.min(100, Math.round((state.turnsSinceLastAnalysis / state.analysisInterval) * 100))
					: 0;
				progressEl = h('div', { className: 'contra-progress' },
					state.turnsUntilNext === 0
						? 'Next analysis: this turn'
						: 'Next auto-analysis in ' + state.turnsUntilNext + ' turn' +
						  (state.turnsUntilNext === 1 ? '' : 's') +
						  ' (' + state.turnsSinceLastAnalysis + '\u00a0/\u00a0' + state.analysisInterval + ')',
					h('div', { className: 'contra-progress-bar-track' },
						h('div', { className: 'contra-progress-bar-fill', style: { width: pct + '%' } })
					)
				);
			} else {
				progressEl = h('div', { className: 'contra-progress' },
					'Auto-analysis is off for this session');
			}

			function handleTrigger() {
				if (isAnalyzing || triggering) return;
				setTriggering(true);
				setTriggerMsg(null);
				triggerAnalysis((result) => {
					setTriggering(false);
					if (result && !result.triggered) {
						setTriggerMsg(result.reason || 'Could not trigger analysis.');
					}
				});
			}

			return h('div', { className: 'contra-overlay' },
				h('div', { className: 'contra-overlay-header' },
					h('div', { className: 'contra-overlay-title' }, 'Contradiction Analysis'),
					h('button', { className: 'contra-overlay-close', onClick: closeOverlay }, '\u2715')
				),
				h('div', {
					className: 'contra-overlay-score contra-score-' + scoreClass(state.score)
				}, state.score === null ? '\u2014' : state.score + '%'),
				h('div', { className: 'contra-overlay-status' }, statusText),
				h('div', { className: 'contra-overlay-controls' },
					h('div', { className: 'contra-auto-row' },
						h('input', {
							type: 'checkbox',
							id: 'contra-auto-checkbox',
							checked: state.autoEnabled === true,
							onChange: (e) => setAuto(e.target.checked)
						}),
						h('label', { htmlFor: 'contra-auto-checkbox' },
							'Auto-analyze every ' + state.analysisInterval + ' turns')
					),
					progressEl,
					h('button', {
						className: 'contra-btn-analyze',
						onClick: handleTrigger,
						disabled: isAnalyzing || triggering
					}, (isAnalyzing || triggering) ? 'Analyzing\u2026' : '\u26A1\u00a0Analyze Now'),
					triggerMsg
						? h('div', {
							style: { fontSize: '11px', color: 'var(--dsw-alias-state-error-primary)' }
						}, triggerMsg)
						: null
				),
				h('div', { className: 'contra-overlay-body' },
					state.commentary || 'No analysis yet. Click \u201cAnalyze Now\u201d or enable auto-analysis.')
			);
		}
		//#endregion

		//#region plugin
		const name = "dsh-contradictions-indicator-client";
		const inject = ["slots"];

		function apply(ctx) {
			// Track the active session so state is scoped per conversation.
			try {
				const conversation = ctx.get && ctx.get('conversation');
				if (conversation && typeof conversation.subscribe === 'function') {
					ctx.effect(() => conversation.subscribe((s) => {
						const id = s && (s.sessionId || s.id);
						if (id && id !== store.sessionId) {
							store.sessionId = id;
							store.state = EMPTY;
							notifyState();
							poll();
						}
					}), 'contradictions: session tracking');
				}
			} catch {}

			poll();
			const timer = setInterval(poll, 3000);
			ctx.effect(() => () => clearInterval(timer), 'contradictions: poll timer');

			ctx.effect(() => ctx.slots.inject('conversation.session.header.utilities', () =>
				ctx.slots.register({
					name: 'conversation.session.header.utilities',
					id: 'contradictions-indicator',
					order: 10,
					inject: () => ({})
				}, ContradictionsBadge)
			), 'contradictions: badge slot');

			ctx.effect(() => ctx.slots.inject('shell.overlay', () =>
				ctx.slots.register({
					name: 'shell.overlay',
					id: 'contradictions-overlay',
					order: 50,
					inject: () => ({})
				}, ContradictionsOverlay)
			), 'contradictions: overlay slot');
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
