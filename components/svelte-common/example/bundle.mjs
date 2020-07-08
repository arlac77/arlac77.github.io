function noop() { }
const identity = x => x;
function assign(tar, src) {
    // @ts-ignore
    for (const k in src)
        tar[k] = src[k];
    return tar;
}
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function create_slot(definition, ctx, $$scope, fn) {
    if (definition) {
        const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
        return definition[0](slot_ctx);
    }
}
function get_slot_context(definition, ctx, $$scope, fn) {
    return definition[1] && fn
        ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
        : $$scope.ctx;
}
function get_slot_changes(definition, $$scope, dirty, fn) {
    if (definition[2] && fn) {
        const lets = definition[2](fn(dirty));
        if ($$scope.dirty === undefined) {
            return lets;
        }
        if (typeof lets === 'object') {
            const merged = [];
            const len = Math.max($$scope.dirty.length, lets.length);
            for (let i = 0; i < len; i += 1) {
                merged[i] = $$scope.dirty[i] | lets[i];
            }
            return merged;
        }
        return $$scope.dirty | lets;
    }
    return $$scope.dirty;
}
function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
    const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
    if (slot_changes) {
        const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
        slot.p(slot_context, slot_changes);
    }
}

const is_client = typeof window !== 'undefined';
let now = is_client
    ? () => window.performance.now()
    : () => Date.now();
let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

const tasks = new Set();
function run_tasks(now) {
    tasks.forEach(task => {
        if (!task.c(now)) {
            tasks.delete(task);
            task.f();
        }
    });
    if (tasks.size !== 0)
        raf(run_tasks);
}
/**
 * Creates a new task that runs on each raf frame
 * until it returns a falsy value or is aborted
 */
function loop(callback) {
    let task;
    if (tasks.size === 0)
        raf(run_tasks);
    return {
        promise: new Promise(fulfill => {
            tasks.add(task = { c: callback, f: fulfill });
        }),
        abort() {
            tasks.delete(task);
        }
    };
}

function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function element(name) {
    return document.createElement(name);
}
function svg_element(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function prevent_default(fn) {
    return function (event) {
        event.preventDefault();
        // @ts-ignore
        return fn.call(this, event);
    };
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function set_data(text, data) {
    data = '' + data;
    if (text.wholeText !== data)
        text.data = data;
}
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}
function custom_event(type, detail) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, false, false, detail);
    return e;
}

const active_docs = new Set();
let active = 0;
// https://github.com/darkskyapp/string-hash/blob/master/index.js
function hash(str) {
    let hash = 5381;
    let i = str.length;
    while (i--)
        hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
    return hash >>> 0;
}
function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
    const step = 16.666 / duration;
    let keyframes = '{\n';
    for (let p = 0; p <= 1; p += step) {
        const t = a + (b - a) * ease(p);
        keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
    }
    const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
    const name = `__svelte_${hash(rule)}_${uid}`;
    const doc = node.ownerDocument;
    active_docs.add(doc);
    const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
    const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
    if (!current_rules[name]) {
        current_rules[name] = true;
        stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
    }
    const animation = node.style.animation || '';
    node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
    active += 1;
    return name;
}
function delete_rule(node, name) {
    const previous = (node.style.animation || '').split(', ');
    const next = previous.filter(name
        ? anim => anim.indexOf(name) < 0 // remove specific animation
        : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
    );
    const deleted = previous.length - next.length;
    if (deleted) {
        node.style.animation = next.join(', ');
        active -= deleted;
        if (!active)
            clear_rules();
    }
}
function clear_rules() {
    raf(() => {
        if (active)
            return;
        active_docs.forEach(doc => {
            const stylesheet = doc.__svelte_stylesheet;
            let i = stylesheet.cssRules.length;
            while (i--)
                stylesheet.deleteRule(i);
            doc.__svelte_rules = {};
        });
        active_docs.clear();
    });
}

let current_component;
function set_current_component(component) {
    current_component = component;
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        dirty_components.length = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}

let promise;
function wait() {
    if (!promise) {
        promise = Promise.resolve();
        promise.then(() => {
            promise = null;
        });
    }
    return promise;
}
function dispatch(node, direction, kind) {
    node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}
const null_transition = { duration: 0 };
function create_in_transition(node, fn, params) {
    let config = fn(node, params);
    let running = false;
    let animation_name;
    let task;
    let uid = 0;
    function cleanup() {
        if (animation_name)
            delete_rule(node, animation_name);
    }
    function go() {
        const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
        if (css)
            animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
        tick(0, 1);
        const start_time = now() + delay;
        const end_time = start_time + duration;
        if (task)
            task.abort();
        running = true;
        add_render_callback(() => dispatch(node, true, 'start'));
        task = loop(now => {
            if (running) {
                if (now >= end_time) {
                    tick(1, 0);
                    dispatch(node, true, 'end');
                    cleanup();
                    return running = false;
                }
                if (now >= start_time) {
                    const t = easing((now - start_time) / duration);
                    tick(t, 1 - t);
                }
            }
            return running;
        });
    }
    let started = false;
    return {
        start() {
            if (started)
                return;
            delete_rule(node);
            if (is_function(config)) {
                config = config();
                wait().then(go);
            }
            else {
                go();
            }
        },
        invalidate() {
            started = false;
        },
        end() {
            if (running) {
                cleanup();
                running = false;
            }
        }
    };
}
function create_out_transition(node, fn, params) {
    let config = fn(node, params);
    let running = true;
    let animation_name;
    const group = outros;
    group.r += 1;
    function go() {
        const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
        if (css)
            animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
        const start_time = now() + delay;
        const end_time = start_time + duration;
        add_render_callback(() => dispatch(node, false, 'start'));
        loop(now => {
            if (running) {
                if (now >= end_time) {
                    tick(0, 1);
                    dispatch(node, false, 'end');
                    if (!--group.r) {
                        // this will result in `end()` being called,
                        // so we don't need to clean up here
                        run_all(group.c);
                    }
                    return false;
                }
                if (now >= start_time) {
                    const t = easing((now - start_time) / duration);
                    tick(1 - t, t);
                }
            }
            return running;
        });
    }
    if (is_function(config)) {
        wait().then(() => {
            // @ts-ignore
            config = config();
            go();
        });
    }
    else {
        go();
    }
    return {
        end(reset) {
            if (reset && config.tick) {
                config.tick(1, 0);
            }
            if (running) {
                if (animation_name)
                    delete_rule(node, animation_name);
                running = false;
            }
        }
    };
}
function create_component(block) {
    block && block.c();
}
function mount_component(component, target, anchor) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    // onMount happens before the initial afterUpdate
    add_render_callback(() => {
        const new_on_destroy = on_mount.map(run).filter(is_function);
        if (on_destroy) {
            on_destroy.push(...new_on_destroy);
        }
        else {
            // Edge case - component was destroyed immediately,
            // most likely as a result of a binding initialising
            run_all(new_on_destroy);
        }
        component.$$.on_mount = [];
    });
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const prop_values = options.props || {};
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        before_update: [],
        after_update: [],
        context: new Map(parent_component ? parent_component.$$.context : []),
        // everything else
        callbacks: blank_object(),
        dirty
    };
    let ready = false;
    $$.ctx = instance
        ? instance(component, prop_values, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if ($$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor);
        flush();
    }
    set_current_component(parent_component);
}
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set() {
        // overridden by instance, if it has props
    }
}

const dateFormatter = new Intl.DateTimeFormat("default", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour12: false,
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit"
});

const durationsISO = [
  [86400, "D"],
  [3600, "H"],
  [60, "M"],
  [1, "S"]
];

function formatDurationISO(seconds) {
  let out = "P";
  let t = false;

  for (const d of durationsISO) {
    if(seconds < 86400 && ! t) {
      out += 'T';
      t = true;
    }

    const n = Math.floor(seconds / d[0]);
    if (n > 0) {
      out += `${n}${d[1]}`;
      seconds -= n * d[0];
    }
  }

  return out;
}

const durations = [
  [604800, "w"],
  [86400, "d"],
  [3600, "h"],
  [60, "m"],
  [1, "s"]
];

function formatDuration(seconds) {
  const out = [];
  for (const d of durations) {
    const n = Math.floor(seconds / d[0]);
    if (n > 0) {
      out.push(`${n}${d[1]}`);
      seconds -= n * d[0];
    }
  }

  return out.join(" ");
}

/*
import { readable } from 'svelte/store';


function liveDuration(seconds) {
  const time = readable(new Date(), set => {
    const interval = setInterval(() => {
      set(seconds);
    }, 1000);
  
    return () => clearInterval(interval);
  });

  return time;
}

*/

/* src/components/Collapse.svelte generated by Svelte v3.24.0 */

const get_content_slot_changes = dirty => ({});
const get_content_slot_context = ctx => ({});

// (12:0) {#if open}
function create_if_block(ctx) {
	let current;
	const content_slot_template = /*$$slots*/ ctx[3].content;
	const content_slot = create_slot(content_slot_template, ctx, /*$$scope*/ ctx[2], get_content_slot_context);

	return {
		c() {
			if (content_slot) content_slot.c();
		},
		m(target, anchor) {
			if (content_slot) {
				content_slot.m(target, anchor);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (content_slot) {
				if (content_slot.p && dirty & /*$$scope*/ 4) {
					update_slot(content_slot, content_slot_template, ctx, /*$$scope*/ ctx[2], dirty, get_content_slot_changes, get_content_slot_context);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(content_slot, local);
			current = true;
		},
		o(local) {
			transition_out(content_slot, local);
			current = false;
		},
		d(detaching) {
			if (content_slot) content_slot.d(detaching);
		}
	};
}

function create_fragment(ctx) {
	let button;
	let t;
	let if_block_anchor;
	let current;
	let mounted;
	let dispose;
	const default_slot_template = /*$$slots*/ ctx[3].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);
	let if_block = /*open*/ ctx[0] && create_if_block(ctx);

	return {
		c() {
			button = element("button");
			if (default_slot) default_slot.c();
			t = space();
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			insert(target, button, anchor);

			if (default_slot) {
				default_slot.m(button, null);
			}

			insert(target, t, anchor);
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;

			if (!mounted) {
				dispose = listen(button, "click", prevent_default(/*toggle*/ ctx[1]));
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && dirty & /*$$scope*/ 4) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[2], dirty, null, null);
				}
			}

			if (/*open*/ ctx[0]) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty & /*open*/ 1) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				group_outros();

				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot, local);
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(default_slot, local);
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(button);
			if (default_slot) default_slot.d(detaching);
			if (detaching) detach(t);
			if (if_block) if_block.d(detaching);
			if (detaching) detach(if_block_anchor);
			mounted = false;
			dispose();
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let open = false;

	function toggle() {
		$$invalidate(0, open = !open);
	}

	let { $$slots = {}, $$scope } = $$props;

	$$self.$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(2, $$scope = $$props.$$scope);
	};

	return [open, toggle, $$scope, $$slots];
}

class Collapse extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

/* src/components/ActionButton.svelte generated by Svelte v3.24.0 */

function create_if_block$1(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			attr(div, "class", "spinner");
		},
		m(target, anchor) {
			insert(target, div, anchor);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

function create_fragment$1(ctx) {
	let button;
	let t;
	let current;
	let mounted;
	let dispose;
	let if_block = /*active*/ ctx[0] && create_if_block$1();
	const default_slot_template = /*$$slots*/ ctx[4].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);

	return {
		c() {
			button = element("button");
			if (if_block) if_block.c();
			t = space();
			if (default_slot) default_slot.c();
			toggle_class(button, "active", /*active*/ ctx[0]);
		},
		m(target, anchor) {
			insert(target, button, anchor);
			if (if_block) if_block.m(button, null);
			append(button, t);

			if (default_slot) {
				default_slot.m(button, null);
			}

			current = true;

			if (!mounted) {
				dispose = listen(button, "click", /*click*/ ctx[1]);
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (/*active*/ ctx[0]) {
				if (if_block) ; else {
					if_block = create_if_block$1();
					if_block.c();
					if_block.m(button, t);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			if (default_slot) {
				if (default_slot.p && dirty & /*$$scope*/ 8) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[3], dirty, null, null);
				}
			}

			if (dirty & /*active*/ 1) {
				toggle_class(button, "active", /*active*/ ctx[0]);
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(button);
			if (if_block) if_block.d();
			if (default_slot) default_slot.d(detaching);
			mounted = false;
			dispose();
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	let { action } = $$props;
	let active;

	async function click() {
		try {
			$$invalidate(0, active = true);
			await action();
		} catch(e) {
			console.log(e);
		} finally {
			$$invalidate(0, active = false);
		}
	}

	let { $$slots = {}, $$scope } = $$props;

	$$self.$set = $$props => {
		if ("action" in $$props) $$invalidate(2, action = $$props.action);
		if ("$$scope" in $$props) $$invalidate(3, $$scope = $$props.$$scope);
	};

	return [active, click, action, $$scope, $$slots];
}

class ActionButton extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$1, create_fragment$1, safe_not_equal, { action: 2 });
	}
}

/* src/components/Menue.svelte generated by Svelte v3.24.0 */

const get_content_slot_changes$1 = dirty => ({});
const get_content_slot_context$1 = ctx => ({});
const get_title_slot_changes = dirty => ({});
const get_title_slot_context = ctx => ({});

// (22:2) {#if open}
function create_if_block$2(ctx) {
	let current;
	const content_slot_template = /*$$slots*/ ctx[4].content;
	const content_slot = create_slot(content_slot_template, ctx, /*$$scope*/ ctx[3], get_content_slot_context$1);

	return {
		c() {
			if (content_slot) content_slot.c();
		},
		m(target, anchor) {
			if (content_slot) {
				content_slot.m(target, anchor);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (content_slot) {
				if (content_slot.p && dirty & /*$$scope*/ 8) {
					update_slot(content_slot, content_slot_template, ctx, /*$$scope*/ ctx[3], dirty, get_content_slot_changes$1, get_content_slot_context$1);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(content_slot, local);
			current = true;
		},
		o(local) {
			transition_out(content_slot, local);
			current = false;
		},
		d(detaching) {
			if (content_slot) content_slot.d(detaching);
		}
	};
}

function create_fragment$2(ctx) {
	let a;
	let t0;
	let svg;
	let path;
	let t1;
	let current;
	let mounted;
	let dispose;
	const title_slot_template = /*$$slots*/ ctx[4].title;
	const title_slot = create_slot(title_slot_template, ctx, /*$$scope*/ ctx[3], get_title_slot_context);
	let if_block = /*open*/ ctx[0] && create_if_block$2(ctx);

	return {
		c() {
			a = element("a");
			if (title_slot) title_slot.c();
			t0 = space();
			svg = svg_element("svg");
			path = svg_element("path");
			t1 = space();
			if (if_block) if_block.c();
			attr(path, "d", "M6 7l6 6 6-6 2 2-8 8-8-8z");
			attr(svg, "width", "18");
			attr(svg, "height", "16");
			attr(svg, "viewBox", "0 0 24 20");
			attr(a, "href", " ");
		},
		m(target, anchor) {
			insert(target, a, anchor);

			if (title_slot) {
				title_slot.m(a, null);
			}

			append(a, t0);
			append(a, svg);
			append(svg, path);
			append(a, t1);
			if (if_block) if_block.m(a, null);
			current = true;

			if (!mounted) {
				dispose = [
					listen(a, "click", prevent_default(/*show*/ ctx[2])),
					listen(a, "mouseenter", /*show*/ ctx[2]),
					listen(a, "mouseleave", /*hide*/ ctx[1])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (title_slot) {
				if (title_slot.p && dirty & /*$$scope*/ 8) {
					update_slot(title_slot, title_slot_template, ctx, /*$$scope*/ ctx[3], dirty, get_title_slot_changes, get_title_slot_context);
				}
			}

			if (/*open*/ ctx[0]) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty & /*open*/ 1) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block$2(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(a, null);
				}
			} else if (if_block) {
				group_outros();

				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(title_slot, local);
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(title_slot, local);
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(a);
			if (title_slot) title_slot.d(detaching);
			if (if_block) if_block.d();
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance$2($$self, $$props, $$invalidate) {
	let open = false;

	function hide() {
		$$invalidate(0, open = false);
	}

	function show() {
		$$invalidate(0, open = true);
	}

	let { $$slots = {}, $$scope } = $$props;

	$$self.$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(3, $$scope = $$props.$$scope);
	};

	return [open, hide, show, $$scope, $$slots];
}

class Menue extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});
	}
}

/* src/components/DateTime.svelte generated by Svelte v3.24.0 */

function create_fragment$3(ctx) {
	let time;
	let t_value = dateFormatter.format(/*date*/ ctx[0]) + "";
	let t;
	let time_localtime_value;

	return {
		c() {
			time = element("time");
			t = text(t_value);
			attr(time, "localtime", time_localtime_value = /*date*/ ctx[0].toISOString());
		},
		m(target, anchor) {
			insert(target, time, anchor);
			append(time, t);
		},
		p(ctx, [dirty]) {
			if (dirty & /*date*/ 1 && t_value !== (t_value = dateFormatter.format(/*date*/ ctx[0]) + "")) set_data(t, t_value);

			if (dirty & /*date*/ 1 && time_localtime_value !== (time_localtime_value = /*date*/ ctx[0].toISOString())) {
				attr(time, "localtime", time_localtime_value);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(time);
		}
	};
}

function instance$3($$self, $$props, $$invalidate) {
	let { date } = $$props;

	$$self.$set = $$props => {
		if ("date" in $$props) $$invalidate(0, date = $$props.date);
	};

	return [date];
}

class DateTime extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$3, create_fragment$3, safe_not_equal, { date: 0 });
	}
}

/* src/components/Duration.svelte generated by Svelte v3.24.0 */

function create_fragment$4(ctx) {
	let time;
	let t_value = formatDuration(/*seconds*/ ctx[0]) + "";
	let t;
	let time_localtime_value;

	return {
		c() {
			time = element("time");
			t = text(t_value);
			attr(time, "localtime", time_localtime_value = formatDurationISO(/*seconds*/ ctx[0]));
		},
		m(target, anchor) {
			insert(target, time, anchor);
			append(time, t);
		},
		p(ctx, [dirty]) {
			if (dirty & /*seconds*/ 1 && t_value !== (t_value = formatDuration(/*seconds*/ ctx[0]) + "")) set_data(t, t_value);

			if (dirty & /*seconds*/ 1 && time_localtime_value !== (time_localtime_value = formatDurationISO(/*seconds*/ ctx[0]))) {
				attr(time, "localtime", time_localtime_value);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(time);
		}
	};
}

function instance$4($$self, $$props, $$invalidate) {
	let { seconds } = $$props;

	$$self.$set = $$props => {
		if ("seconds" in $$props) $$invalidate(0, seconds = $$props.seconds);
	};

	return [seconds];
}

class Duration extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$4, create_fragment$4, safe_not_equal, { seconds: 0 });
	}
}

function fade(node, { delay = 0, duration = 400, easing = identity }) {
    const o = +getComputedStyle(node).opacity;
    return {
        delay,
        duration,
        easing,
        css: t => `opacity: ${t * o}`
    };
}

/* example/src/App.svelte generated by Svelte v3.24.0 */

function create_title_slot(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			div.textContent = "User";
			attr(div, "slot", "title");
			attr(div, "class", "dropdown-trigger");
		},
		m(target, anchor) {
			insert(target, div, anchor);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (35:8) <div slot="content" class="dropdown-menu dropdown-menu-sw">
function create_content_slot_1(ctx) {
	let div0;
	let a0;
	let t1;
	let div1;
	let t2;
	let a1;
	let t4;
	let a2;
	let t6;
	let a3;
	let mounted;
	let dispose;

	return {
		c() {
			div0 = element("div");
			a0 = element("a");
			a0.textContent = "Logout";
			t1 = space();
			div1 = element("div");
			t2 = space();
			a1 = element("a");
			a1.textContent = "Profile";
			t4 = space();
			a2 = element("a");
			a2.textContent = "About";
			t6 = space();
			a3 = element("a");
			a3.textContent = "Setting 1";
			attr(a0, "href", "#!");
			attr(a0, "class", "dropdown-item");
			attr(div1, "role", "none");
			attr(div1, "class", "dropdown-divider");
			attr(a1, "href", "#!");
			attr(a1, "class", "dropdown-item");
			attr(a2, "href", "#!");
			attr(a2, "class", "dropdown-item");
			attr(a3, "href", "#!");
			attr(a3, "class", "dropdown-item");
			attr(div0, "slot", "content");
			attr(div0, "class", "dropdown-menu dropdown-menu-sw");
		},
		m(target, anchor) {
			insert(target, div0, anchor);
			append(div0, a0);
			append(div0, t1);
			append(div0, div1);
			append(div0, t2);
			append(div0, a1);
			append(div0, t4);
			append(div0, a2);
			append(div0, t6);
			append(div0, a3);

			if (!mounted) {
				dispose = listen(a0, "click", prevent_default(logout));
				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(div0);
			mounted = false;
			dispose();
		}
	};
}

// (33:6) <Menue>
function create_default_slot_3(ctx) {
	let t;

	return {
		c() {
			t = space();
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (49:2) <ActionButton {action}>
function create_default_slot_2(ctx) {
	let t;

	return {
		c() {
			t = text("Long Running Action");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (53:2) <ActionButton action={failingAction}>
function create_default_slot_1(ctx) {
	let t;

	return {
		c() {
			t = text("Failing Action");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (57:4) <ul id="collapse-content" slot="content" in:fade out:fade>
function create_content_slot(ctx) {
	let ul;
	let ul_intro;
	let ul_outro;
	let current;

	return {
		c() {
			ul = element("ul");

			ul.innerHTML = `<li>1st.</li> 
      <li>2nd.</li>`;

			attr(ul, "id", "collapse-content");
			attr(ul, "slot", "content");
		},
		m(target, anchor) {
			insert(target, ul, anchor);
			current = true;
		},
		i(local) {
			if (current) return;

			add_render_callback(() => {
				if (ul_outro) ul_outro.end(1);
				if (!ul_intro) ul_intro = create_in_transition(ul, fade, {});
				ul_intro.start();
			});

			current = true;
		},
		o(local) {
			if (ul_intro) ul_intro.invalidate();
			ul_outro = create_out_transition(ul, fade, {});
			current = false;
		},
		d(detaching) {
			if (detaching) detach(ul);
			if (detaching && ul_outro) ul_outro.end();
		}
	};
}

// (55:2) <Collapse>
function create_default_slot(ctx) {
	let t;

	return {
		c() {
			t = text("Collapse\n    ");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

function create_fragment$5(ctx) {
	let nav;
	let a0;
	let t1;
	let ul0;
	let t3;
	let ul1;
	let li1;
	let menue;
	let t4;
	let main;
	let actionbutton0;
	let t5;
	let div0;
	let t6;
	let t7;
	let actionbutton1;
	let t8;
	let collapse;
	let t9;
	let div1;
	let t10;
	let duration0;
	let t11;
	let duration1;
	let t12;
	let datetime;
	let current;

	menue = new Menue({
			props: {
				$$slots: {
					default: [create_default_slot_3],
					content: [create_content_slot_1],
					title: [create_title_slot]
				},
				$$scope: { ctx }
			}
		});

	actionbutton0 = new ActionButton({
			props: {
				action: /*action*/ ctx[1],
				$$slots: { default: [create_default_slot_2] },
				$$scope: { ctx }
			}
		});

	actionbutton1 = new ActionButton({
			props: {
				action: failingAction,
				$$slots: { default: [create_default_slot_1] },
				$$scope: { ctx }
			}
		});

	collapse = new Collapse({
			props: {
				$$slots: {
					default: [create_default_slot],
					content: [create_content_slot]
				},
				$$scope: { ctx }
			}
		});

	duration0 = new Duration({ props: { seconds: "1000000" } });
	duration1 = new Duration({ props: { seconds: "5000" } });
	datetime = new DateTime({ props: { date: new Date() } });

	return {
		c() {
			nav = element("nav");
			a0 = element("a");
			a0.textContent = "Example";
			t1 = space();
			ul0 = element("ul");
			ul0.innerHTML = `<li><a href="/">Entry</a></li>`;
			t3 = space();
			ul1 = element("ul");
			li1 = element("li");
			create_component(menue.$$.fragment);
			t4 = space();
			main = element("main");
			create_component(actionbutton0.$$.fragment);
			t5 = space();
			div0 = element("div");
			t6 = text(/*actionExecuted*/ ctx[0]);
			t7 = space();
			create_component(actionbutton1.$$.fragment);
			t8 = space();
			create_component(collapse.$$.fragment);
			t9 = space();
			div1 = element("div");
			t10 = text("Days ");
			create_component(duration0.$$.fragment);
			t11 = text("\n    Hours ");
			create_component(duration1.$$.fragment);
			t12 = space();
			create_component(datetime.$$.fragment);
			attr(a0, "href", "/");
			attr(div0, "id", "actionExecuted");
		},
		m(target, anchor) {
			insert(target, nav, anchor);
			append(nav, a0);
			append(nav, t1);
			append(nav, ul0);
			append(nav, t3);
			append(nav, ul1);
			append(ul1, li1);
			mount_component(menue, li1, null);
			insert(target, t4, anchor);
			insert(target, main, anchor);
			mount_component(actionbutton0, main, null);
			append(main, t5);
			append(main, div0);
			append(div0, t6);
			append(main, t7);
			mount_component(actionbutton1, main, null);
			append(main, t8);
			mount_component(collapse, main, null);
			append(main, t9);
			append(main, div1);
			append(div1, t10);
			mount_component(duration0, div1, null);
			append(div1, t11);
			mount_component(duration1, div1, null);
			append(div1, t12);
			mount_component(datetime, div1, null);
			current = true;
		},
		p(ctx, [dirty]) {
			const menue_changes = {};

			if (dirty & /*$$scope*/ 4) {
				menue_changes.$$scope = { dirty, ctx };
			}

			menue.$set(menue_changes);
			const actionbutton0_changes = {};

			if (dirty & /*$$scope*/ 4) {
				actionbutton0_changes.$$scope = { dirty, ctx };
			}

			actionbutton0.$set(actionbutton0_changes);
			if (!current || dirty & /*actionExecuted*/ 1) set_data(t6, /*actionExecuted*/ ctx[0]);
			const actionbutton1_changes = {};

			if (dirty & /*$$scope*/ 4) {
				actionbutton1_changes.$$scope = { dirty, ctx };
			}

			actionbutton1.$set(actionbutton1_changes);
			const collapse_changes = {};

			if (dirty & /*$$scope*/ 4) {
				collapse_changes.$$scope = { dirty, ctx };
			}

			collapse.$set(collapse_changes);
		},
		i(local) {
			if (current) return;
			transition_in(menue.$$.fragment, local);
			transition_in(actionbutton0.$$.fragment, local);
			transition_in(actionbutton1.$$.fragment, local);
			transition_in(collapse.$$.fragment, local);
			transition_in(duration0.$$.fragment, local);
			transition_in(duration1.$$.fragment, local);
			transition_in(datetime.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(menue.$$.fragment, local);
			transition_out(actionbutton0.$$.fragment, local);
			transition_out(actionbutton1.$$.fragment, local);
			transition_out(collapse.$$.fragment, local);
			transition_out(duration0.$$.fragment, local);
			transition_out(duration1.$$.fragment, local);
			transition_out(datetime.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(nav);
			destroy_component(menue);
			if (detaching) detach(t4);
			if (detaching) detach(main);
			destroy_component(actionbutton0);
			destroy_component(actionbutton1);
			destroy_component(collapse);
			destroy_component(duration0);
			destroy_component(duration1);
			destroy_component(datetime);
		}
	};
}

async function failingAction() {
	return new Promise((resolve, reject) => setTimeout(() => reject("failed"), 5000));
}

async function logout() {
	alert("logout");
}

function instance$5($$self, $$props, $$invalidate) {
	let actionExecuted = false;

	async function action() {
		$$invalidate(0, actionExecuted = true);
		return new Promise(resolve => setTimeout(resolve, 5000));
	}

	return [actionExecuted, action];
}

class App extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});
	}
}

var index = new App({
  target: document.body
});

export default index;
//# sourceMappingURL=bundle.mjs.map
