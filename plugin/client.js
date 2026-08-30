window.__ModuleLoader__.load({
	id: "dsh-contradictions-indicator",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let react = require("react");
		const h = react.createElement;

		const CSS_TEXT = [
			'.contra-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1); background: transparent; font-size: 12px; font-weight: 600; line-height: 1.4; cursor: pointer; font-family: inherit; }',
			'.contra-badge-idle { color: var(--dsw-alias-label-secondary); }',
			'.contra-badge-analyzing { color: var(--dsw-alias-label-secondary); }',
			'.contra-badge-error { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }',
			'.contra-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block; }',
			'.contra-badge-good { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }',
			'.contra-badge-good .contra-dot { background: var(--dsw-alias-state-success-primary); }',
			'.contra-badge-warn { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); }',
			'.contra-badge-warn .contra-dot { background: var(--dsw-alias-state-warn-primary); }',
			'.contra-badge-bad { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }',
			'.contra-badge-bad .contra-dot { background: var(--dsw-alias-state-error-primary); }',
			'.contra-badge:focus-visible, .contra-overlay-close:focus-visible, .contra-btn-analyze:focus-visible { outline: 2px solid var(--dsw-alias-state-success-primary); outline-offset: 2px; }',
			'.contra-overlay { position: fixed; bottom: 16px; right: 16px; width: 420px; max-width: calc(100vw - 32px); max-height: 78vh; display: flex; flex-direction: column; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.28); z-index: 1000; pointer-events: auto; background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-primary); font-family: inherit; }',
			'.contra-overlay-header { padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--dsw-alias-border-l1); flex-shrink: 0; }',
			'.contra-overlay-title { font-size: 13px; font-weight: 600; }',
			'.contra-overlay-close { background: transparent; border: none; color: var(--dsw-alias-label-secondary); cursor: pointer; font-size: 14px; padding: 2px 6px; line-height: 1; }',
			'.contra-overlay-score { font-size: 40px; font-weight: 700; padding: 14px 16px 2px 16px; flex-shrink: 0; }',
			'.contra-score-good { color: var(--dsw-alias-state-success-primary); }',
			'.contra-score-warn { color: var(--dsw-alias-state-warn-primary); }',
			'.contra-score-bad { color: var(--dsw-alias-state-error-primary); }',
			'.contra-score-neutral { color: var(--dsw-alias-label-secondary); }',
			'.contra-overlay-status { padding: 2px 16px 10px 16px; font-size: 11px; color: var(--dsw-alias-label-secondary); flex-shrink: 0; }',
			'.contra-overlay-controls { padding: 10px 16px 12px 16px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--dsw-alias-border-l1); border-bottom: 1px solid var(--dsw-alias-border-l1); flex-shrink: 0; overflow-y: auto; max-height: 46vh; }',
			'.contra-auto-row { display: flex; align-items: center; gap: 8px; font-size: 12px; flex-wrap: wrap; }',
			'.contra-auto-row label { cursor: pointer; color: var(--dsw-alias-label-primary); user-select: none; }',
			'.contra-auto-row input[type=checkbox] { cursor: pointer; width: 14px; height: 14px; flex-shrink: 0; }',
			'.contra-interval-input { width: 52px; height: 22px; padding: 0 6px; border-radius: 4px; border: 1px solid var(--dsw-alias-border-l1); background: transparent; color: var(--dsw-alias-label-primary); font-size: 12px; font-family: inherit; }',
			'.contra-progress { font-size: 11px; color: var(--dsw-alias-label-secondary); padding-left: 22px; }',
			'.contra-progress-bar-track { height: 4px; border-radius: 2px; background: var(--dsw-alias-border-l1); margin-top: 4px; overflow: hidden; }',
			'.contra-progress-bar-fill { height: 100%; border-radius: 2px; background: var(--dsw-alias-state-success-primary); transition: width 0.3s ease; }',
			'.contra-btn-analyze { width: 100%; padding: 7px 12px; border-radius: 6px; background: transparent; border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-primary); cursor: pointer; font-size: 12px; font-weight: 500; font-family: inherit; text-align: center; }',
			'.contra-btn-analyze:hover { background: var(--dsw-alias-interactive-bg-hover); }',
			'.contra-btn-analyze:disabled { opacity: 0.5; cursor: default; }',
			'.contra-field-label { font-size: 11px; font-weight: 600; color: var(--dsw-alias-label-secondary); }',
			'.contra-textarea { width: 100%; min-height: 88px; resize: vertical; box-sizing: border-box; padding: 8px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l1); background: transparent; color: var(--dsw-alias-label-primary); font-size: 12px; line-height: 1.45; font-family: inherit; }',
			'.contra-hint { font-size: 11px; color: var(--dsw-alias-label-secondary); }',
			'.contra-overlay-body { padding: 12px 16px 16px 16px; overflow-y: auto; font-size: 13px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: break-word; color: var(--dsw-alias-label-primary); }',
			'.contra-settings { padding: 16px 18px 24px; display: flex; flex-direction: column; gap: 14px; max-width: 720px; }',
			'.contra-settings h2 { margin: 0; font-size: 16px; font-weight: 600; }',
			'.contra-settings p { margin: 0; font-size: 13px; color: var(--dsw-alias-label-secondary); line-height: 1.5; }',
			'.contra-error-text { font-size: 11px; color: var(--dsw-alias-state-error-primary); }'
		].join('\n');

		const TAG_ID = "dsh-contradictions-indicator/styles";

		function scoreClass(score) {
			if (score === null || score === undefined) return 'neutral';
			if (score >= 80) return 'good';
			if (score >= 50) return 'warn';
			return 'bad';
		}

		let uidCounter = 0;
		function useUid(prefix) {
			const ref = react.useRef(null);
			if (ref.current === null) {
				uidCounter += 1;
				ref.current = prefix + '-' + uidCounter;
			}
			return ref.current;
		}

		const EMPTY = {
			score: null, commentary: null, status: 'idle', messageCount: 0,
			turnsSinceLastAnalysis: 0, turnsUntilNext: null,
			autoEnabled: false, steerEnabled: true, analysisInterval: 25,
			prompt1: '', prompt2: ''
		};

		const store = {
			state: EMPTY,
			listeners: [],
			overlayVisible: false,
			overlayListeners: [],
			sessionId: null,
			// Bumped on every session switch; in-flight fetch responses that
			// don't match the current generation when they resolve are
			// discarded instead of overwriting fresher state.
			generation: 0
		};

		function notifyState() {
			for (const fn of store.listeners.slice()) fn(store.state);
		}
		function notifyOverlay() {
			for (const fn of store.overlayListeners.slice()) fn(store.overlayVisible);
		}
		function subscribeState(fn) {
			store.listeners.push(fn);
			return () => { const i = store.listeners.indexOf(fn); if (i >= 0) store.listeners.splice(i, 1); };
		}
		function subscribeOverlay(fn) {
			store.overlayListeners.push(fn);
			return () => { const i = store.overlayListeners.indexOf(fn); if (i >= 0) store.overlayListeners.splice(i, 1); };
		}
		function toggleOverlay() { store.overlayVisible = !store.overlayVisible; notifyOverlay(); }
		function closeOverlay() { store.overlayVisible = false; notifyOverlay(); }
		function adoptSession(id) {
			if (!id || id === store.sessionId) return;
			store.generation += 1;
			store.sessionId = id;
			store.state = { ...EMPTY };
			notifyState();
			poll();
		}
		function query() {
			return store.sessionId ? '?sessionId=' + encodeURIComponent(store.sessionId) : '';
		}
		function poll() {
			const gen = store.generation;
			fetch('/contradictions/state' + query())
				.then((r) => r.ok ? r.json() : null)
				.then((body) => {
					if (!body) return;
					if (gen !== store.generation) return; // stale response, session changed since
					store.state = body;
					notifyState();
				})
				.catch(() => {});
		}
		function patchSettings(partial) {
			const gen = store.generation;
			return fetch('/contradictions/auto' + query(), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(partial)
			})
				.then((r) => r.ok ? r.json() : null)
				.then((body) => {
					if (!body) return null;
					if (gen !== store.generation) return body; // stale, don't clobber newer session
					store.state = body;
					notifyState();
					return body;
				})
				.catch(() => null);
		}
		function saveDefaults(partial) {
			return fetch('/contradictions/defaults', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(partial)
			}).then((r) => r.ok ? r.json() : null).catch(() => null);
		}
		function triggerAnalysis(onDone) {
			const gen = store.generation;
			fetch('/contradictions/trigger' + query(), { method: 'POST' })
				.then((r) => r.ok ? r.json() : null)
				.then((body) => {
					if (body && body.triggered && gen === store.generation) poll();
					if (onDone) onDone(body || { triggered: false, reason: 'Request failed.' });
				})
				.catch((error) => {
					if (onDone) onDone({ triggered: false, reason: String((error && error.message) || error) });
				});
		}

		function ContradictionsBadge(props) {
			const [state, setState] = react.useState(store.state);
			react.useEffect(() => subscribeState(setState), []);
			react.useEffect(() => { if (props && props.sessionId) adoptSession(props.sessionId); }, [props && props.sessionId]);

			if (state.status === 'analyzing' && state.score === null) {
				return h('button', { className: 'contra-badge contra-badge-analyzing', onClick: toggleOverlay, title: 'Analyzing contradictions\u2026 click for details' }, 'Analyzing\u2026');
			}
			if (state.status === 'error' && state.score === null) {
				return h('button', { className: 'contra-badge contra-badge-error', onClick: toggleOverlay, title: 'Analysis failed \u2014 click for details' }, 'Analysis error');
			}
			if (state.score !== null) {
				return h('button', {
					className: 'contra-badge contra-badge-' + scoreClass(state.score),
					onClick: toggleOverlay,
					title: 'Coherence score: ' + state.score + '% \u2014 click for details'
				}, h('span', { className: 'contra-dot' }), state.score + '%');
			}
			return h('button', { className: 'contra-badge contra-badge-idle', onClick: toggleOverlay, title: 'Contradiction Indicator \u2014 click to open' }, '\u26A1 Analyze');
		}

		function PromptFields(state, drafts, setDrafts, persist, keyPrefix) {
			return [
				h('div', { key: keyPrefix + '-label1', className: 'contra-field-label' }, 'Message 1 \u2014 analysis prompt'),
				h('textarea', {
					key: keyPrefix + '-prompt1',
					className: 'contra-textarea',
					value: drafts.prompt1,
					onChange: (e) => setDrafts((prev) => ({ ...prev, prompt1: e.target.value })),
					onBlur: () => {
						if (drafts.prompt1 !== state.prompt1) patchSettings({ prompt1: drafts.prompt1, persist: persist });
					}
				}),
				h('div', { key: keyPrefix + '-label2', className: 'contra-field-label' }, 'Message 2 \u2014 system-reminder steer'),
				h('div', { key: keyPrefix + '-hint2', className: 'contra-hint' }, 'Use {{score}} and {{commentary}} as placeholders.'),
				h('textarea', {
					key: keyPrefix + '-prompt2',
					className: 'contra-textarea',
					value: drafts.prompt2,
					onChange: (e) => setDrafts((prev) => ({ ...prev, prompt2: e.target.value })),
					onBlur: () => {
						if (drafts.prompt2 !== state.prompt2) patchSettings({ prompt2: drafts.prompt2, persist: persist });
					}
				})
			];
		}

		function ContradictionsOverlay() {
			const [visible, setVisible] = react.useState(store.overlayVisible);
			const [state, setState] = react.useState(store.state);
			const [triggering, setTriggering] = react.useState(false);
			const [triggerMsg, setTriggerMsg] = react.useState(null);
			const [intervalDraft, setIntervalDraft] = react.useState(String(state.analysisInterval || 25));
			const [drafts, setDrafts] = react.useState({ prompt1: state.prompt1 || '', prompt2: state.prompt2 || '' });
			const mountedRef = react.useRef(true);
			const autoId = useUid('contra-auto');
			const steerId = useUid('contra-steer');

			react.useEffect(() => {
				mountedRef.current = true;
				return () => { mountedRef.current = false; };
			}, []);

			react.useEffect(() => {
				const a = subscribeOverlay(setVisible);
				const b = subscribeState(setState);
				return () => { a(); b(); };
			}, []);
			react.useEffect(() => { setIntervalDraft(String(state.analysisInterval || 25)); }, [state.analysisInterval]);
			react.useEffect(() => { setDrafts({ prompt1: state.prompt1 || '', prompt2: state.prompt2 || '' }); }, [state.prompt1, state.prompt2]);
			react.useEffect(() => {
				if (!visible) setTriggerMsg(null);
			}, [visible]);

			react.useEffect(() => {
				if (!visible) return;
				function onKeyDown(e) {
					if (e.key === 'Escape') closeOverlay();
				}
				document.addEventListener('keydown', onKeyDown);
				return () => document.removeEventListener('keydown', onKeyDown);
			}, [visible]);

			if (!visible) return null;
			const isAnalyzing = state.status === 'analyzing';
			const interval = state.analysisInterval || 25;

			let statusText;
			if (isAnalyzing) statusText = 'Analyzing\u2026';
			else if (state.status === 'error') statusText = 'Last analysis failed';
			else if (state.score !== null) statusText = 'Coherence score \u2014 0% = contradictory, 100% = smooth';
			else statusText = 'No analysis yet';

			let progressEl;
			if (state.autoEnabled) {
				const until = state.turnsUntilNext == null ? Math.max(0, interval - (state.turnsSinceLastAnalysis || 0)) : state.turnsUntilNext;
				const done = state.turnsSinceLastAnalysis || 0;
				const pct = interval > 0 ? Math.min(100, Math.round((done / interval) * 100)) : 0;
				progressEl = h('div', { className: 'contra-progress' },
					until === 0 ? 'Next analysis: this turn' :
						'Next auto-analysis in ' + until + ' turn' + (until === 1 ? '' : 's') + ' (' + done + '\u00a0/\u00a0' + interval + ')',
					h('div', { className: 'contra-progress-bar-track' },
						h('div', { className: 'contra-progress-bar-fill', style: { width: pct + '%' } }))
				);
			} else {
				progressEl = h('div', { className: 'contra-progress' }, 'Auto-analysis is off for this session');
			}

			function commitInterval() {
				const n = Math.round(Number(intervalDraft));
				if (!Number.isFinite(n) || n < 1) { setIntervalDraft(String(interval)); return; }
				const clamped = Math.min(500, Math.max(1, n));
				setIntervalDraft(String(clamped));
				if (clamped !== interval) patchSettings({ interval: clamped, persist: true });
			}

			return h('div', { className: 'contra-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Contradiction Analysis' },
				h('div', { className: 'contra-overlay-header' },
					h('div', { className: 'contra-overlay-title' }, 'Contradiction Analysis'),
					h('button', { className: 'contra-overlay-close', onClick: closeOverlay, 'aria-label': 'Close', type: 'button' }, '\u2715')
				),
				h('div', { className: 'contra-overlay-score contra-score-' + scoreClass(state.score) },
					state.score === null ? '\u2014' : state.score + '%'),
				h('div', { className: 'contra-overlay-status', 'aria-live': 'polite' }, statusText),
				h('div', { className: 'contra-overlay-controls' },
					h('div', { className: 'contra-auto-row' },
						h('input', { type: 'checkbox', id: autoId, checked: state.autoEnabled === true,
							onChange: (e) => patchSettings({ enabled: e.target.checked }) }),
						h('label', { htmlFor: autoId }, 'Auto-analyze every'),
						h('input', { className: 'contra-interval-input', type: 'number', min: 1, max: 500, value: intervalDraft,
							'aria-label': 'Auto-analyze interval in turns',
							onChange: (e) => setIntervalDraft(e.target.value), onBlur: commitInterval,
							onKeyDown: (e) => { if (e.key === 'Enter') commitInterval(); } }),
						h('label', { htmlFor: autoId }, 'turns')
					),
					h('div', { className: 'contra-auto-row' },
						h('input', { type: 'checkbox', id: steerId, checked: state.steerEnabled !== false,
							onChange: (e) => patchSettings({ steer: e.target.checked, persist: true }) }),
						h('label', { htmlFor: steerId }, 'Steer next turn with a system reminder')
					),
					progressEl,
					...PromptFields(state, drafts, setDrafts, true, 'overlay'),
					h('button', { className: 'contra-btn-analyze', type: 'button', onClick: () => {
						if (isAnalyzing || triggering) return;
						setTriggering(true); setTriggerMsg(null);
						triggerAnalysis((result) => {
							if (!mountedRef.current) return;
							setTriggering(false);
							if (result && !result.triggered) setTriggerMsg(result.reason || 'Could not trigger analysis.');
						});
					}, disabled: isAnalyzing || triggering, 'aria-busy': isAnalyzing || triggering },
					(isAnalyzing || triggering) ? 'Analyzing\u2026' : '\u26A1\u00a0Analyze Now'),
					triggerMsg ? h('div', { className: 'contra-error-text' }, triggerMsg) : null
				),
				h('div', { className: 'contra-overlay-body' },
					state.commentary || 'No analysis yet. Click \u201cAnalyze Now\u201d or enable auto-analysis.')
			);
		}

		function SettingsTab() {
			const [g, setG] = react.useState(null);
			const [loadError, setLoadError] = react.useState(false);
			const [intervalDraft, setIntervalDraft] = react.useState('25');
			const [drafts, setDrafts] = react.useState({ prompt1: '', prompt2: '' });
			const [saved, setSaved] = react.useState('');
			const mountedRef = react.useRef(true);
			const savedTimerRef = react.useRef(null);
			const steerId = useUid('contra-settings-steer');

			function load() {
				setLoadError(false);
				fetch('/contradictions/defaults').then((r) => r.ok ? r.json() : null).then((body) => {
					if (!mountedRef.current) return;
					if (!body) { setLoadError(true); return; }
					setG(body);
					setIntervalDraft(String(body.interval || 25));
					setDrafts({ prompt1: body.prompt1 || '', prompt2: body.prompt2 || '' });
				}).catch(() => { if (mountedRef.current) setLoadError(true); });
			}

			react.useEffect(() => {
				mountedRef.current = true;
				load();
				return () => {
					mountedRef.current = false;
					if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
				};
			}, []);

			function save(partial) {
				saveDefaults(partial).then((body) => {
					if (!mountedRef.current) return;
					if (!body) { setLoadError(true); return; }
					setG(body);
					setIntervalDraft(String(body.interval || 25));
					setDrafts({ prompt1: body.prompt1 || '', prompt2: body.prompt2 || '' });
					setSaved('Saved');
					if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
					savedTimerRef.current = setTimeout(() => {
						if (mountedRef.current) setSaved('');
					}, 1500);
					poll();
				});
			}

			if (loadError) {
				return h('div', { className: 'contra-settings' },
					h('p', { className: 'contra-error-text' }, 'Could not load contradiction settings.'),
					h('button', { className: 'contra-btn-analyze', type: 'button', onClick: load }, 'Retry')
				);
			}
			if (!g) return h('div', { className: 'contra-settings' }, 'Loading contradiction settings\u2026');

			return h('div', { className: 'contra-settings' },
				h('h2', null, 'Contradiction Indicator'),
				h('p', null, 'These are global defaults for new sessions. Auto-analysis stays off until you enable it in a conversation. Interval, steer, and both prompts are saved to disk.'),
				h('div', { className: 'contra-auto-row' },
					h('label', null, 'Auto-analyze every'),
					h('input', { className: 'contra-interval-input', type: 'number', min: 1, max: 500, value: intervalDraft,
						'aria-label': 'Default auto-analyze interval in turns',
						onChange: (e) => setIntervalDraft(e.target.value),
						onBlur: () => {
							const n = Math.min(500, Math.max(1, Math.round(Number(intervalDraft)) || 25));
							setIntervalDraft(String(n));
							if (n !== g.interval) save({ interval: n });
						} }),
					h('span', null, 'turns (default off per session)')
				),
				h('div', { className: 'contra-auto-row' },
					h('input', { type: 'checkbox', id: steerId, checked: g.steerEnabled !== false,
						onChange: (e) => save({ steerEnabled: e.target.checked }) }),
					h('label', { htmlFor: steerId }, 'Steer next turn with a system reminder (default on)')
				),
				...PromptFields(g, drafts, setDrafts, false, 'settings'),
				saved ? h('div', { className: 'contra-hint' }, saved) : null
			);
		}

		const name = "dsh-contradictions-indicator-client";
		const inject = ["slots"];

		function apply(ctx) {
			ctx.effect(() => {
				let tag = null;
				if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(TAG_ID) + "]") === null) {
					tag = document.createElement("style");
					tag.dataset.plugin = "dsh-contradictions-indicator";
					tag.dataset.pluginCss = TAG_ID;
					tag.textContent = CSS_TEXT;
					document.head.appendChild(tag);
				}
				return () => { if (tag) tag.remove(); };
			}, 'contradictions: styles');

			poll();
			const timer = setInterval(poll, 6000);
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

			ctx.effect(() => ctx.slots.inject('settings.plugins.tab', () =>
				ctx.slots.register({
					name: 'settings.plugins.tab',
					id: 'contradictions-indicator',
					order: 25,
					label: () => 'Contradictions',
					inject: () => ({})
				}, SettingsTab)
			), 'contradictions: settings tab');
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
