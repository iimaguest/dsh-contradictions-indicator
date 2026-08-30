window.__ModuleLoader__.load({
	id: "dsh-contradictions-indicator",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let react = require("react");
		const h = react.createElement;

		// ---------------------------------------------------------------
		// Design tokens
		//
		// Every colour, radius, font and shadow below is a real
		// `--dsw-*` alias that the web shell publishes per theme, so the
		// popup tracks the Settings -> Appearance theme exactly like
		// host-owned surfaces. The previous revision drew its palette
		// from ad-hoc values instead of the shell's surface recipe,
		// which is why the popup looked unrelated to the rest of the
		// app.
		//
		// The panel mirrors the shell's own Modal dialog recipe
		// (bg-layer-2 + border-inverted + shadow-lv3) and the badge
		// mirrors the Session-log header capsule exactly, so both
		// inherit whatever the active theme resolves those tokens to.
		// ---------------------------------------------------------------
		const CSS_TEXT = [
			// --- header capsule: metrics copied from the Session log button ---
			'.contra-badge { display: inline-flex; align-items: center; justify-content: center; gap: 4px; box-sizing: border-box; min-width: 111px; height: 32px; padding: 6px 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 18px; background: transparent; color: var(--dsw-alias-label-primary); font-family: var(--dsw-font-family); font-size: 13px; font-weight: 400; line-height: 20px; cursor: pointer; white-space: nowrap; }',
			'.contra-badge:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }',
			'.contra-badge[aria-expanded="true"] { background: var(--dsw-alias-interactive-bg-active); }',
			'.contra-badge span, .contra-badge svg { flex: none; }',
			'.contra-badge-label { white-space: nowrap; }',
			'.contra-caret { transition: transform 0.15s ease; }',
			'.contra-badge[aria-expanded="true"] .contra-caret { transform: rotate(180deg); }',
			'.contra-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block; background: var(--dsw-alias-label-dimmed); }',
			'.contra-badge-good .contra-dot { background: var(--dsw-alias-state-success-primary); }',
			'.contra-badge-warn .contra-dot { background: var(--dsw-alias-state-warn-primary); }',
			'.contra-badge-bad .contra-dot { background: var(--dsw-alias-state-error-primary); }',
			'.contra-badge-error .contra-dot { background: var(--dsw-alias-state-error-primary); }',
			'.contra-badge-score { font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary); }',
			'.contra-badge:focus-visible, .contra-overlay-close:focus-visible, .contra-btn:focus-visible, .contra-textarea:focus-visible, .contra-interval-input:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }',

			// --- popup panel: the shell Modal dialog recipe, anchored ---
			'.contra-overlay { position: fixed; bottom: 16px; right: 16px; width: 420px; max-width: calc(100vw - 32px); max-height: 78vh; display: flex; flex-direction: column; overflow: hidden; z-index: 1000; pointer-events: auto; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-inverted); border-radius: 16px; background: var(--dsw-alias-bg-layer-2); box-shadow: var(--dsw-shadow-lv3); color: var(--dsw-alias-label-primary); font-family: var(--dsw-font-family); }',
			'.contra-overlay-header { padding: 16px 14px 12px 20px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-shrink: 0; }',
			'.contra-overlay-title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; color: var(--dsw-alias-label-primary); }',
			'.contra-overlay-close { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; border-radius: 8px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }',
			'.contra-overlay-close:hover { background: var(--dsw-alias-interactive-bg-hover); }',
			'.contra-overlay-score { font-size: 40px; line-height: 1.1; font-weight: 600; padding: 0 20px; flex-shrink: 0; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-dimmed); }',
			'.contra-score-good { color: var(--dsw-alias-state-success-primary); }',
			'.contra-score-warn { color: var(--dsw-alias-state-warn-primary); }',
			'.contra-score-bad { color: var(--dsw-alias-state-error-primary); }',
			'.contra-overlay-status { padding: 6px 20px 12px 20px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); flex-shrink: 0; }',
			'.contra-overlay-controls { padding: 12px 20px 14px 20px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--dsw-alias-border-l1); border-bottom: 1px solid var(--dsw-alias-border-l1); flex-shrink: 0; overflow-y: auto; max-height: 46vh; }',
			'.contra-scope-note { font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary); }',
			'.contra-row { display: flex; align-items: center; gap: 8px; font-size: 13px; line-height: 20px; flex-wrap: wrap; }',
			'.contra-row label { cursor: pointer; color: var(--dsw-alias-label-primary); user-select: none; }',
			'.contra-row input[type=checkbox] { cursor: pointer; width: 16px; height: 16px; flex-shrink: 0; accent-color: var(--dsw-alias-button-primary-fill); }',
			'.contra-interval-input { width: 56px; height: 28px; padding: 0 8px; box-sizing: border-box; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-primary); font-size: 13px; font-family: var(--dsw-font-family); }',
			'.contra-progress { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }',
			'.contra-progress-bar-track { height: 4px; border-radius: 2px; background: var(--dsw-alias-border-l1); margin-top: 6px; overflow: hidden; }',
			'.contra-progress-bar-fill { height: 100%; border-radius: 2px; background: var(--dsw-alias-state-success-primary); transition: width 0.3s ease; }',
			'.contra-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%; height: 32px; padding: 6px 12px; box-sizing: border-box; border-radius: 18px; border: 1px solid transparent; background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); cursor: pointer; font-size: 13px; line-height: 20px; font-weight: 500; font-family: var(--dsw-font-family); }',
			'.contra-btn:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }',
			'.contra-btn:disabled { opacity: 0.5; cursor: default; }',
			'.contra-btn-ghost { background: transparent; border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); width: auto; }',
			'.contra-btn-ghost:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }',
			'.contra-field-label { font-size: 12px; line-height: 18px; font-weight: 500; color: var(--dsw-alias-label-secondary); }',
			'.contra-textarea { width: 100%; min-height: 88px; resize: vertical; box-sizing: border-box; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px; font-family: var(--dsw-font-family); }',
			'.contra-hint { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }',
			'.contra-overlay-body { padding: 14px 20px 20px 20px; overflow-y: auto; font-size: 13px; line-height: 20px; white-space: pre-wrap; overflow-wrap: break-word; color: var(--dsw-alias-label-primary); }',

			// --- settings tab ---
			'.contra-settings { padding: 16px 18px 24px; display: flex; flex-direction: column; gap: 14px; max-width: 720px; font-family: var(--dsw-font-family); color: var(--dsw-alias-label-primary); }',
			'.contra-settings h2 { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; }',
			'.contra-settings p { margin: 0; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }',
			'.contra-error-text { font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary); }'
		].join('\n');

		const TAG_ID = "dsh-contradictions-indicator/styles";
		const LOCALE_NS = "contradictions-indicator";

		// ---------------------------------------------------------------
		// Localisation
		//
		// The plugin previously hard-coded English, so Settings ->
		// Language had no effect on any of its surfaces. Dictionaries are
		// registered with the shell's locale runtime and read through a
		// bound translate function, so the active language (and any later
		// switch) is respected exactly like host-owned UI.
		// ---------------------------------------------------------------
		const EN = {
			'badge.label': 'Coherence',
			'badge.open': 'Open the contradiction analysis panel',
			'badge.analyzing': 'Analyzing',
			'badge.error': 'Error',
			'panel.title': 'Contradiction Analysis',
			'panel.close': 'Close',
			'status.analyzing': 'Analyzing\u2026',
			'status.error': 'Last analysis failed',
			'status.ready': 'Coherence score \u2014 0% = contradictory, 100% = smooth',
			'status.idle': 'No analysis yet',
			'scope.note': 'These controls apply to this conversation only. Defaults for new conversations live in Settings \u2192 Contradictions.',
			'auto.every': 'Auto-analyze every',
			'auto.turns': 'turns',
			'auto.intervalLabel': 'Auto-analyze interval in turns',
			'auto.off': 'Auto-analysis is off for this conversation',
			'auto.next': 'Next auto-analysis in {turns} turn(s) ({done} / {total})',
			'auto.nextNow': 'Next analysis: this turn',
			'steer.label': 'Steer next turn with a system reminder',
			'prompt1.label': 'Message 1 \u2014 analysis prompt',
			'prompt2.label': 'Message 2 \u2014 system-reminder steer',
			'prompt2.hint': 'Use {{score}} and {{commentary}} as placeholders.',
			'analyze.now': 'Analyze now',
			'analyze.busy': 'Analyzing\u2026',
			'analyze.failed': 'Could not trigger analysis.',
			'body.empty': 'No analysis yet. Choose \u201cAnalyze now\u201d or enable auto-analysis.',
			'settings.title': 'Contradiction Indicator',
			'settings.intro': 'Defaults for new conversations. Changing anything here never touches a conversation that already exists \u2014 open its panel to adjust that one.',
			'settings.autoDefault': 'Enable auto-analysis in new conversations',
			'settings.steerDefault': 'Steer next turn with a system reminder',
			'settings.intervalLabel': 'Default auto-analyze interval in turns',
			'settings.loading': 'Loading contradiction settings\u2026',
			'settings.loadError': 'Could not load contradiction settings.',
			'settings.retry': 'Retry',
			'settings.saved': 'Saved'
		};

		const ZH = {
			'badge.label': '一致性',
			'badge.open': '打开矛盾分析面板',
			'badge.analyzing': '分析中',
			'badge.error': '错误',
			'panel.title': '矛盾分析',
			'panel.close': '关闭',
			'status.analyzing': '分析中\u2026',
			'status.error': '上次分析失败',
			'status.ready': '一致性评分 \u2014 0% 表示自相矛盾，100% 表示完全一致',
			'status.idle': '尚未分析',
			'scope.note': '这些设置仅作用于当前对话。新对话的默认值请在「设置 \u2192 矛盾分析」中修改。',
			'auto.every': '自动分析间隔',
			'auto.turns': '轮',
			'auto.intervalLabel': '自动分析间隔（轮）',
			'auto.off': '当前对话已关闭自动分析',
			'auto.next': '距下次自动分析还有 {turns} 轮（{done} / {total}）',
			'auto.nextNow': '下次分析：本轮',
			'steer.label': '用系统提醒引导下一轮回复',
			'prompt1.label': '消息 1 \u2014 分析提示词',
			'prompt2.label': '消息 2 \u2014 系统提醒引导语',
			'prompt2.hint': '可使用 {{score}} 与 {{commentary}} 占位符。',
			'analyze.now': '立即分析',
			'analyze.busy': '分析中\u2026',
			'analyze.failed': '无法启动分析。',
			'body.empty': '尚未分析。请选择「立即分析」或启用自动分析。',
			'settings.title': '矛盾指示器',
			'settings.intro': '新对话的默认值。在此处的修改不会影响任何已存在的对话 \u2014 请打开对应对话的面板单独调整。',
			'settings.autoDefault': '在新对话中默认启用自动分析',
			'settings.steerDefault': '用系统提醒引导下一轮回复',
			'settings.intervalLabel': '默认自动分析间隔（轮）',
			'settings.loading': '正在加载矛盾分析设置\u2026',
			'settings.loadError': '无法加载矛盾分析设置。',
			'settings.retry': '重试',
			'settings.saved': '已保存'
		};

		// Fallback translator used only if the shell composes without a
		// locale service; it keeps the UI readable instead of blank.
		let translate = (key, params) => format(EN[key] === undefined ? key : EN[key], params);

		function format(template, params) {
			if (!params) return template;
			let out = String(template);
			for (const name of Object.keys(params)) {
				out = out.split('{' + name + '}').join(String(params[name]));
			}
			return out;
		}

		function t(key, params) {
			try { return translate(key, params); }
			catch { return key; }
		}

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

		function CaretIcon() {
			return h('svg', {
				className: 'contra-caret', width: 14, height: 14, viewBox: '0 0 14 14',
				fill: 'none', 'aria-hidden': 'true', focusable: 'false'
			}, h('path', {
				d: 'M3.5 5.25L7 8.75l3.5-3.5', stroke: 'currentColor', strokeWidth: 1.4,
				strokeLinecap: 'round', strokeLinejoin: 'round'
			}));
		}

		function CloseIcon() {
			return h('svg', {
				width: 14, height: 14, viewBox: '0 0 14 14', fill: 'none',
				'aria-hidden': 'true', focusable: 'false'
			}, h('path', {
				d: 'M3.5 3.5l7 7M10.5 3.5l-7 7', stroke: 'currentColor', strokeWidth: 1.4,
				strokeLinecap: 'round'
			}));
		}

		const EMPTY = {
			score: null, commentary: null, status: 'idle', messageCount: 0,
			turnsSinceLastAnalysis: 0, turnsUntilNext: null,
			autoEnabled: true, steerEnabled: true, analysisInterval: 25,
			prompt1: '', prompt2: ''
		};

		const store = {
			state: EMPTY,
			listeners: [],
			overlayVisible: false,
			overlayListeners: [],
			localeRevision: 0,
			localeListeners: [],
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
		function notifyLocale() {
			store.localeRevision += 1;
			for (const fn of store.localeListeners.slice()) fn(store.localeRevision);
		}
		function subscribeState(fn) {
			store.listeners.push(fn);
			return () => { const i = store.listeners.indexOf(fn); if (i >= 0) store.listeners.splice(i, 1); };
		}
		function subscribeOverlay(fn) {
			store.overlayListeners.push(fn);
			return () => { const i = store.overlayListeners.indexOf(fn); if (i >= 0) store.overlayListeners.splice(i, 1); };
		}
		function subscribeLocale(fn) {
			store.localeListeners.push(fn);
			return () => { const i = store.localeListeners.indexOf(fn); if (i >= 0) store.localeListeners.splice(i, 1); };
		}
		/** Re-render this component whenever the active language changes. */
		function useLocale() {
			const [, setRevision] = react.useState(store.localeRevision);
			react.useEffect(() => subscribeLocale(setRevision), []);
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
		/**
		 * Update THIS conversation's settings only.
		 *
		 * There is deliberately no `persist` flag any more: a per-session
		 * edit that also rewrote the global defaults meant adjusting one
		 * conversation silently reconfigured the plugin for every future
		 * one. Defaults are now written exclusively from the Settings tab.
		 */
		function patchSession(partial) {
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
					if (onDone) onDone(body || { triggered: false, reason: t('analyze.failed') });
				})
				.catch((error) => {
					if (onDone) onDone({ triggered: false, reason: String((error && error.message) || error) });
				});
		}

		/**
		 * Header capsule. This is a disclosure control, not a command: it
		 * carries a text label, `aria-haspopup="dialog"`, `aria-expanded`
		 * and a rotating caret so it reads as "opens a panel" rather than
		 * "runs an analysis right now". The actual run action lives inside
		 * the panel as a primary button.
		 */
		function ContradictionsBadge(props) {
			const [state, setState] = react.useState(store.state);
			const [expanded, setExpanded] = react.useState(store.overlayVisible);
			useLocale();
			react.useEffect(() => subscribeState(setState), []);
			react.useEffect(() => subscribeOverlay(setExpanded), []);
			react.useEffect(() => { if (props && props.sessionId) adoptSession(props.sessionId); }, [props && props.sessionId]);

			const analyzing = state.status === 'analyzing';
			const errored = state.status === 'error' && state.score === null;

			let tone = scoreClass(state.score);
			if (errored) tone = 'error';

			let valueText;
			if (analyzing && state.score === null) valueText = t('badge.analyzing');
			else if (errored) valueText = t('badge.error');
			else if (state.score !== null) valueText = state.score + '%';
			else valueText = '\u2014';

			return h('button', {
				type: 'button',
				className: 'contra-badge contra-badge-' + tone,
				'data-contra-anchor': 'true',
				'aria-haspopup': 'dialog',
				'aria-expanded': expanded ? 'true' : 'false',
				title: t('badge.open'),
				onClick: toggleOverlay
			},
				h('span', { className: 'contra-dot' }),
				h('span', { className: 'contra-badge-label' }, t('badge.label')),
				h('span', { className: 'contra-badge-score' }, valueText),
				h(CaretIcon, null)
			);
		}

		function PromptFields(current, drafts, setDrafts, commit, keyPrefix) {
			return [
				h('div', { key: keyPrefix + '-label1', className: 'contra-field-label' }, t('prompt1.label')),
				h('textarea', {
					key: keyPrefix + '-prompt1',
					className: 'contra-textarea',
					value: drafts.prompt1,
					onChange: (e) => setDrafts((prev) => ({ ...prev, prompt1: e.target.value })),
					onBlur: () => {
						if (drafts.prompt1 !== current.prompt1) commit({ prompt1: drafts.prompt1 });
					}
				}),
				h('div', { key: keyPrefix + '-label2', className: 'contra-field-label' }, t('prompt2.label')),
				h('div', { key: keyPrefix + '-hint2', className: 'contra-hint' }, t('prompt2.hint')),
				h('textarea', {
					key: keyPrefix + '-prompt2',
					className: 'contra-textarea',
					value: drafts.prompt2,
					onChange: (e) => setDrafts((prev) => ({ ...prev, prompt2: e.target.value })),
					onBlur: () => {
						if (drafts.prompt2 !== current.prompt2) commit({ prompt2: drafts.prompt2 });
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
			const panelRef = react.useRef(null);
			const autoId = useUid('contra-auto');
			const steerId = useUid('contra-steer');
			useLocale();

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
				// Dismiss on any pointer press outside the panel. The
				// header capsule is excluded so its own click toggles
				// rather than closing here and reopening on click.
				function onPointerDown(e) {
					const target = e.target;
					if (!(target instanceof Node)) return;
					const panel = panelRef.current;
					if (panel && panel.contains(target)) return;
					if (target instanceof Element && target.closest('[data-contra-anchor]')) return;
					closeOverlay();
				}
				document.addEventListener('keydown', onKeyDown);
				document.addEventListener('pointerdown', onPointerDown, true);
				return () => {
					document.removeEventListener('keydown', onKeyDown);
					document.removeEventListener('pointerdown', onPointerDown, true);
				};
			}, [visible]);

			if (!visible) return null;
			const isAnalyzing = state.status === 'analyzing';
			const interval = state.analysisInterval || 25;

			let statusText;
			if (isAnalyzing) statusText = t('status.analyzing');
			else if (state.status === 'error') statusText = t('status.error');
			else if (state.score !== null) statusText = t('status.ready');
			else statusText = t('status.idle');

			let progressEl;
			if (state.autoEnabled) {
				const until = state.turnsUntilNext == null ? Math.max(0, interval - (state.turnsSinceLastAnalysis || 0)) : state.turnsUntilNext;
				const done = state.turnsSinceLastAnalysis || 0;
				const pct = interval > 0 ? Math.min(100, Math.round((done / interval) * 100)) : 0;
				progressEl = h('div', { className: 'contra-progress' },
					until === 0 ? t('auto.nextNow') : t('auto.next', { turns: until, done: done, total: interval }),
					h('div', { className: 'contra-progress-bar-track' },
						h('div', { className: 'contra-progress-bar-fill', style: { width: pct + '%' } }))
				);
			} else {
				progressEl = h('div', { className: 'contra-progress' }, t('auto.off'));
			}

			function commitInterval() {
				const n = Math.round(Number(intervalDraft));
				if (!Number.isFinite(n) || n < 1) { setIntervalDraft(String(interval)); return; }
				const clamped = Math.min(500, Math.max(1, n));
				setIntervalDraft(String(clamped));
				if (clamped !== interval) patchSession({ interval: clamped });
			}

			return h('div', {
				className: 'contra-overlay', ref: panelRef, role: 'dialog',
				'aria-label': t('panel.title')
			},
				h('div', { className: 'contra-overlay-header' },
					h('h2', { className: 'contra-overlay-title' }, t('panel.title')),
					h('button', { className: 'contra-overlay-close', onClick: closeOverlay, 'aria-label': t('panel.close'), type: 'button' }, h(CloseIcon, null))
				),
				h('div', { className: 'contra-overlay-score contra-score-' + scoreClass(state.score) },
					state.score === null ? '\u2014' : state.score + '%'),
				h('div', { className: 'contra-overlay-status', 'aria-live': 'polite' }, statusText),
				h('div', { className: 'contra-overlay-controls' },
					h('div', { className: 'contra-scope-note' }, t('scope.note')),
					h('div', { className: 'contra-row' },
						h('input', { type: 'checkbox', id: autoId, checked: state.autoEnabled === true,
							onChange: (e) => patchSession({ enabled: e.target.checked }) }),
						h('label', { htmlFor: autoId }, t('auto.every')),
						h('input', { className: 'contra-interval-input', type: 'number', min: 1, max: 500, value: intervalDraft,
							'aria-label': t('auto.intervalLabel'),
							onChange: (e) => setIntervalDraft(e.target.value), onBlur: commitInterval,
							onKeyDown: (e) => { if (e.key === 'Enter') commitInterval(); } }),
						h('label', { htmlFor: autoId }, t('auto.turns'))
					),
					h('div', { className: 'contra-row' },
						h('input', { type: 'checkbox', id: steerId, checked: state.steerEnabled !== false,
							onChange: (e) => patchSession({ steer: e.target.checked }) }),
						h('label', { htmlFor: steerId }, t('steer.label'))
					),
					progressEl,
					...PromptFields(state, drafts, setDrafts, patchSession, 'overlay'),
					h('button', { className: 'contra-btn', type: 'button', onClick: () => {
						if (isAnalyzing || triggering) return;
						setTriggering(true); setTriggerMsg(null);
						triggerAnalysis((result) => {
							if (!mountedRef.current) return;
							setTriggering(false);
							if (result && !result.triggered) setTriggerMsg(result.reason || t('analyze.failed'));
						});
					}, disabled: isAnalyzing || triggering, 'aria-busy': isAnalyzing || triggering },
					(isAnalyzing || triggering) ? t('analyze.busy') : t('analyze.now')),
					triggerMsg ? h('div', { className: 'contra-error-text' }, triggerMsg) : null
				),
				h('div', { className: 'contra-overlay-body' },
					state.commentary || t('body.empty'))
			);
		}

		/**
		 * Settings tab: global defaults for conversations created from now
		 * on. Saving here never reaches into a live conversation.
		 */
		function SettingsTab() {
			const [g, setG] = react.useState(null);
			const [loadError, setLoadError] = react.useState(false);
			const [intervalDraft, setIntervalDraft] = react.useState('25');
			const [drafts, setDrafts] = react.useState({ prompt1: '', prompt2: '' });
			const [saved, setSaved] = react.useState('');
			const mountedRef = react.useRef(true);
			const savedTimerRef = react.useRef(null);
			const autoId = useUid('contra-settings-auto');
			const intervalId = useUid('contra-settings-interval');
			const steerId = useUid('contra-settings-steer');
			useLocale();

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
					setSaved(t('settings.saved'));
					if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
					savedTimerRef.current = setTimeout(() => {
						if (mountedRef.current) setSaved('');
					}, 1500);
					// Deliberately NOT re-polling session state here:
					// defaults are for future conversations, so the open
					// conversation's panel must stay exactly as the user
					// left it.
				});
			}

			if (loadError) {
				return h('div', { className: 'contra-settings' },
					h('p', { className: 'contra-error-text' }, t('settings.loadError')),
					h('button', { className: 'contra-btn contra-btn-ghost', type: 'button', onClick: load }, t('settings.retry'))
				);
			}
			if (!g) return h('div', { className: 'contra-settings' }, t('settings.loading'));

			return h('div', { className: 'contra-settings' },
				h('h2', null, t('settings.title')),
				h('p', null, t('settings.intro')),
				h('div', { className: 'contra-row' },
					h('input', { type: 'checkbox', id: autoId, checked: g.autoEnabled === true,
						onChange: (e) => save({ autoEnabled: e.target.checked }) }),
					h('label', { htmlFor: autoId }, t('settings.autoDefault'))
				),
				h('div', { className: 'contra-row' },
					h('label', { htmlFor: intervalId }, t('auto.every')),
					h('input', { className: 'contra-interval-input', id: intervalId, type: 'number', min: 1, max: 500, value: intervalDraft,
						'aria-label': t('settings.intervalLabel'),
						onChange: (e) => setIntervalDraft(e.target.value),
						onBlur: () => {
							const n = Math.min(500, Math.max(1, Math.round(Number(intervalDraft)) || 25));
							setIntervalDraft(String(n));
							if (n !== g.interval) save({ interval: n });
						} }),
					h('span', null, t('auto.turns'))
				),
				h('div', { className: 'contra-row' },
					h('input', { type: 'checkbox', id: steerId, checked: g.steerEnabled !== false,
						onChange: (e) => save({ steerEnabled: e.target.checked }) }),
					h('label', { htmlFor: steerId }, t('settings.steerDefault'))
				),
				...PromptFields(g, drafts, setDrafts, save, 'settings'),
				saved ? h('div', { className: 'contra-hint' }, saved) : null
			);
		}

		const name = "dsh-contradictions-indicator-client";
		// `locale` is the shell's language runtime — the same service the
		// Settings -> Language row writes to. Declaring it here is what
		// guarantees this plugin activates after it, so our dictionaries
		// are registered before the first render.
		const inject = ["slots", "locale"];

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

			// Bind to the shell's locale runtime so Settings -> Language
			// drives this plugin's copy too. Composed-out locale service
			// leaves the English fallback translator in place.
			ctx.effect(() => {
				const locale = ctx.locale;
				if (!locale) return () => {};
				const disposers = [];
				try {
					const off = locale.register(LOCALE_NS, { en: EN, zh: ZH });
					if (typeof off === 'function') disposers.push(off);
				} catch (error) {
					console.error('[dsh-contradictions-indicator] locale register failed', error);
				}
				try {
					const bound = locale.bind(LOCALE_NS);
					if (typeof bound === 'function') {
						translate = (key, params) => bound(key, params);
					}
				} catch (error) {
					console.error('[dsh-contradictions-indicator] locale bind failed', error);
				}
				if (typeof locale.subscribe === 'function') {
					const offSub = locale.subscribe(() => notifyLocale());
					if (typeof offSub === 'function') disposers.push(offSub);
				}
				notifyLocale();
				return () => {
					for (const dispose of disposers.reverse()) {
						try { dispose(); } catch {}
					}
					translate = (key, params) => format(EN[key] === undefined ? key : EN[key], params);
					notifyLocale();
				};
			}, 'contradictions: locale');

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
					label: () => t('settings.title'),
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
