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
function is_empty(obj) {
    return Object.keys(obj).length === 0;
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
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
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
        set_current_component(null);
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
        dirty,
        skip_bound: false
    };
    let ready = false;
    $$.ctx = instance
        ? instance(component, prop_values, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
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
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

const subscriber_queue = [];
/**
 * Creates a `Readable` store that allows reading by subscription.
 * @param value initial value
 * @param {StartStopNotifier}start start and stop notifications for subscriptions
 */
function readable(value, start) {
    return {
        subscribe: writable(value, start).subscribe
    };
}
/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}value initial value
 * @param {StartStopNotifier=}start start and stop notifications for subscriptions
 */
function writable(value, start = noop) {
    let stop;
    const subscribers = [];
    function set(new_value) {
        if (safe_not_equal(value, new_value)) {
            value = new_value;
            if (stop) { // store is ready
                const run_queue = !subscriber_queue.length;
                for (let i = 0; i < subscribers.length; i += 1) {
                    const s = subscribers[i];
                    s[1]();
                    subscriber_queue.push(s, value);
                }
                if (run_queue) {
                    for (let i = 0; i < subscriber_queue.length; i += 2) {
                        subscriber_queue[i][0](subscriber_queue[i + 1]);
                    }
                    subscriber_queue.length = 0;
                }
            }
        }
    }
    function update(fn) {
        set(fn(value));
    }
    function subscribe(run, invalidate = noop) {
        const subscriber = [run, invalidate];
        subscribers.push(subscriber);
        if (subscribers.length === 1) {
            stop = start(set) || noop;
        }
        run(value);
        return () => {
            const index = subscribers.indexOf(subscriber);
            if (index !== -1) {
                subscribers.splice(index, 1);
            }
            if (subscribers.length === 0) {
                stop();
                stop = null;
            }
        };
    }
    return { set, update, subscribe };
}

/**
 * Create a store holding a service worker
 * @param {string} script 
 * @return {Readable} store holding the service worker
 */
function initializeServiceWorker(script) {
    const serviceWorker = readable({ state: "unknown" }, set => {
      navigator.serviceWorker
        .register(script)
        .then(serviceWorkerRegistration => {
          // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/update
          for (const state of ["active", "waiting", "installing"]) {
            const sw = serviceWorkerRegistration[state];
            if (sw) {
              set(sw);
              sw.onstatechange = event => set(sw);
              return;
            }
          }
        });
  
      return () => {};
    });
  
    return { serviceWorker };
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

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return (
    parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + byteSizes[i]
  );
}

const byteSizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

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

/* src/components/Peer.svelte generated by Svelte v3.26.0 */

function add_css() {
	var style = element("style");
	style.id = "svelte-r1ty4g-style";
	style.textContent = ".peer.svelte-r1ty4g{display:inline-block;background-color:var(--button-disabled-background-color);border-radius:0.5em;padding:0.2em;margin:0.2em}";
	append(document.head, style);
}

// (17:2) {#if peer.referrer}
function create_if_block_1(ctx) {
	let t0;
	let t1_value = /*peer*/ ctx[0].referrer.host + "";
	let t1;
	let t2;
	let t3_value = /*peer*/ ctx[0].referrer.port + "";
	let t3;
	let t4;

	return {
		c() {
			t0 = text("(referrer ");
			t1 = text(t1_value);
			t2 = text(":");
			t3 = text(t3_value);
			t4 = text(")");
		},
		m(target, anchor) {
			insert(target, t0, anchor);
			insert(target, t1, anchor);
			insert(target, t2, anchor);
			insert(target, t3, anchor);
			insert(target, t4, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*peer*/ 1 && t1_value !== (t1_value = /*peer*/ ctx[0].referrer.host + "")) set_data(t1, t1_value);
			if (dirty & /*peer*/ 1 && t3_value !== (t3_value = /*peer*/ ctx[0].referrer.port + "")) set_data(t3, t3_value);
		},
		d(detaching) {
			if (detaching) detach(t0);
			if (detaching) detach(t1);
			if (detaching) detach(t2);
			if (detaching) detach(t3);
			if (detaching) detach(t4);
		}
	};
}

// (18:2) {#if peer.to}
function create_if_block(ctx) {
	let t0;
	let t1_value = /*peer*/ ctx[0].to.host + "";
	let t1;
	let t2;
	let t3_value = /*peer*/ ctx[0].to.port + "";
	let t3;
	let t4;

	return {
		c() {
			t0 = text("(to ");
			t1 = text(t1_value);
			t2 = text(":");
			t3 = text(t3_value);
			t4 = text(")");
		},
		m(target, anchor) {
			insert(target, t0, anchor);
			insert(target, t1, anchor);
			insert(target, t2, anchor);
			insert(target, t3, anchor);
			insert(target, t4, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*peer*/ 1 && t1_value !== (t1_value = /*peer*/ ctx[0].to.host + "")) set_data(t1, t1_value);
			if (dirty & /*peer*/ 1 && t3_value !== (t3_value = /*peer*/ ctx[0].to.port + "")) set_data(t3, t3_value);
		},
		d(detaching) {
			if (detaching) detach(t0);
			if (detaching) detach(t1);
			if (detaching) detach(t2);
			if (detaching) detach(t3);
			if (detaching) detach(t4);
		}
	};
}

function create_fragment(ctx) {
	let div;
	let t0_value = /*peer*/ ctx[0].host + "";
	let t0;
	let t1;
	let t2_value = /*peer*/ ctx[0].port + "";
	let t2;
	let t3;
	let t4;
	let if_block0 = /*peer*/ ctx[0].referrer && create_if_block_1(ctx);
	let if_block1 = /*peer*/ ctx[0].to && create_if_block(ctx);

	return {
		c() {
			div = element("div");
			t0 = text(t0_value);
			t1 = text(":");
			t2 = text(t2_value);
			t3 = space();
			if (if_block0) if_block0.c();
			t4 = space();
			if (if_block1) if_block1.c();
			attr(div, "class", "peer svelte-r1ty4g");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, t0);
			append(div, t1);
			append(div, t2);
			append(div, t3);
			if (if_block0) if_block0.m(div, null);
			append(div, t4);
			if (if_block1) if_block1.m(div, null);
		},
		p(ctx, [dirty]) {
			if (dirty & /*peer*/ 1 && t0_value !== (t0_value = /*peer*/ ctx[0].host + "")) set_data(t0, t0_value);
			if (dirty & /*peer*/ 1 && t2_value !== (t2_value = /*peer*/ ctx[0].port + "")) set_data(t2, t2_value);

			if (/*peer*/ ctx[0].referrer) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_1(ctx);
					if_block0.c();
					if_block0.m(div, t4);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (/*peer*/ ctx[0].to) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block(ctx);
					if_block1.c();
					if_block1.m(div, null);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
			if (if_block0) if_block0.d();
			if (if_block1) if_block1.d();
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { peer } = $$props;

	$$self.$$set = $$props => {
		if ("peer" in $$props) $$invalidate(0, peer = $$props.peer);
	};

	return [peer];
}

class Peer extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-r1ty4g-style")) add_css();
		init(this, options, instance, create_fragment, safe_not_equal, { peer: 0 });
	}
}

/* src/components/Entitlement.svelte generated by Svelte v3.26.0 */

function add_css$1() {
	var style = element("style");
	style.id = "svelte-irwou9-style";
	style.textContent = ".entitlement.svelte-irwou9{display:inline-block;background-color:var(--button-disabled-background-color);border-radius:0.5em;padding:0.2em;margin:0.2em}";
	append(document.head, style);
}

function create_fragment$1(ctx) {
	let div;
	let t;

	return {
		c() {
			div = element("div");
			t = text(/*id*/ ctx[0]);
			attr(div, "class", "entitlement svelte-irwou9");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, t);
		},
		p(ctx, [dirty]) {
			if (dirty & /*id*/ 1) set_data(t, /*id*/ ctx[0]);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	let { id } = $$props;

	$$self.$$set = $$props => {
		if ("id" in $$props) $$invalidate(0, id = $$props.id);
	};

	return [id];
}

class Entitlement extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-irwou9-style")) add_css$1();
		init(this, options, instance$1, create_fragment$1, safe_not_equal, { id: 0 });
	}
}

/* src/components/Modal.svelte generated by Svelte v3.26.0 */

function create_fragment$2(ctx) {
	let div2;
	let div1;
	let div0;
	let current;
	let mounted;
	let dispose;
	const default_slot_template = /*#slots*/ ctx[5].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[4], null);

	return {
		c() {
			div2 = element("div");
			div1 = element("div");
			div0 = element("div");
			if (default_slot) default_slot.c();
			attr(div0, "class", "window");
			attr(div1, "class", "center modal");
		},
		m(target, anchor) {
			insert(target, div2, anchor);
			append(div2, div1);
			append(div1, div0);

			if (default_slot) {
				default_slot.m(div0, null);
			}

			/*div2_binding*/ ctx[6](div2);
			current = true;

			if (!mounted) {
				dispose = [
					listen(window, "keyup", /*handleKeyup*/ ctx[1]),
					listen(div2, "click", /*handleOuterClick*/ ctx[2])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && dirty & /*$$scope*/ 16) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[4], dirty, null, null);
				}
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
			if (detaching) detach(div2);
			if (default_slot) default_slot.d(detaching);
			/*div2_binding*/ ctx[6](null);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance$2($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let { close } = $$props;
	let background;

	const handleKeyup = event => {
		if (event.key === "Escape") {
			event.preventDefault();
			close();
		}
	};

	const handleOuterClick = event => {
		if (event.target === background) {
			event.preventDefault();
			close();
		}
	};

	function div2_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			background = $$value;
			$$invalidate(0, background);
		});
	}

	$$self.$$set = $$props => {
		if ("close" in $$props) $$invalidate(3, close = $$props.close);
		if ("$$scope" in $$props) $$invalidate(4, $$scope = $$props.$$scope);
	};

	return [background, handleKeyup, handleOuterClick, close, $$scope, slots, div2_binding];
}

class Modal extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$2, create_fragment$2, safe_not_equal, { close: 3 });
	}
}

/* src/components/Collapse.svelte generated by Svelte v3.26.0 */

const get_content_slot_changes = dirty => ({});
const get_content_slot_context = ctx => ({});

// (12:0) {#if open}
function create_if_block$1(ctx) {
	let current;
	const content_slot_template = /*#slots*/ ctx[3].content;
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

function create_fragment$3(ctx) {
	let button;
	let t;
	let if_block_anchor;
	let current;
	let mounted;
	let dispose;
	const default_slot_template = /*#slots*/ ctx[3].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);
	let if_block = /*open*/ ctx[0] && create_if_block$1(ctx);

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
					if_block = create_if_block$1(ctx);
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

function instance$3($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let open = false;

	function toggle() {
		$$invalidate(0, open = !open);
	}

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(2, $$scope = $$props.$$scope);
	};

	return [open, toggle, $$scope, slots];
}

class Collapse extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});
	}
}

/* src/components/ActionButton.svelte generated by Svelte v3.26.0 */

function create_if_block$2(ctx) {
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

function create_fragment$4(ctx) {
	let button;
	let t;
	let current;
	let mounted;
	let dispose;
	let if_block = /*active*/ ctx[0] && create_if_block$2();
	const default_slot_template = /*#slots*/ ctx[4].default;
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
					if_block = create_if_block$2();
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

function instance$4($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
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

	$$self.$$set = $$props => {
		if ("action" in $$props) $$invalidate(2, action = $$props.action);
		if ("$$scope" in $$props) $$invalidate(3, $$scope = $$props.$$scope);
	};

	return [active, click, action, $$scope, slots];
}

class ActionButton extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$4, create_fragment$4, safe_not_equal, { action: 2 });
	}
}

/* src/components/Menue.svelte generated by Svelte v3.26.0 */

const get_content_slot_changes$1 = dirty => ({});
const get_content_slot_context$1 = ctx => ({});
const get_title_slot_changes = dirty => ({});
const get_title_slot_context = ctx => ({});

// (22:2) {#if open}
function create_if_block$3(ctx) {
	let current;
	const content_slot_template = /*#slots*/ ctx[4].content;
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

function create_fragment$5(ctx) {
	let a;
	let t0;
	let svg;
	let path;
	let t1;
	let current;
	let mounted;
	let dispose;
	const title_slot_template = /*#slots*/ ctx[4].title;
	const title_slot = create_slot(title_slot_template, ctx, /*$$scope*/ ctx[3], get_title_slot_context);
	let if_block = /*open*/ ctx[0] && create_if_block$3(ctx);

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
					if_block = create_if_block$3(ctx);
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

function instance$5($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let open = false;

	function hide() {
		$$invalidate(0, open = false);
	}

	function show() {
		$$invalidate(0, open = true);
	}

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(3, $$scope = $$props.$$scope);
	};

	return [open, hide, show, $$scope, slots];
}

class Menue extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});
	}
}

/* src/components/ServiceWorkerDetails.svelte generated by Svelte v3.26.0 */

function create_fragment$6(ctx) {
	let tr0;
	let t1;
	let tr1;
	let td1;
	let t2;
	let td2;
	let t4;
	let td3;
	let t5_value = /*serviceWorker*/ ctx[0].state + "";
	let t5;
	let t6;
	let tr2;
	let td4;
	let t7;
	let td5;
	let t9;
	let td6;
	let t10_value = /*serviceWorker*/ ctx[0].scriptURL + "";
	let t10;

	return {
		c() {
			tr0 = element("tr");
			tr0.innerHTML = `<td colspan="3">Service Worker</td>`;
			t1 = space();
			tr1 = element("tr");
			td1 = element("td");
			t2 = space();
			td2 = element("td");
			td2.textContent = "State";
			t4 = space();
			td3 = element("td");
			t5 = text(t5_value);
			t6 = space();
			tr2 = element("tr");
			td4 = element("td");
			t7 = space();
			td5 = element("td");
			td5.textContent = "scriptURL";
			t9 = space();
			td6 = element("td");
			t10 = text(t10_value);
		},
		m(target, anchor) {
			insert(target, tr0, anchor);
			insert(target, t1, anchor);
			insert(target, tr1, anchor);
			append(tr1, td1);
			append(tr1, t2);
			append(tr1, td2);
			append(tr1, t4);
			append(tr1, td3);
			append(td3, t5);
			insert(target, t6, anchor);
			insert(target, tr2, anchor);
			append(tr2, td4);
			append(tr2, t7);
			append(tr2, td5);
			append(tr2, t9);
			append(tr2, td6);
			append(td6, t10);
		},
		p(ctx, [dirty]) {
			if (dirty & /*serviceWorker*/ 1 && t5_value !== (t5_value = /*serviceWorker*/ ctx[0].state + "")) set_data(t5, t5_value);
			if (dirty & /*serviceWorker*/ 1 && t10_value !== (t10_value = /*serviceWorker*/ ctx[0].scriptURL + "")) set_data(t10, t10_value);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(tr0);
			if (detaching) detach(t1);
			if (detaching) detach(tr1);
			if (detaching) detach(t6);
			if (detaching) detach(tr2);
		}
	};
}

function instance$6($$self, $$props, $$invalidate) {
	let { serviceWorker } = $$props;

	$$self.$$set = $$props => {
		if ("serviceWorker" in $$props) $$invalidate(0, serviceWorker = $$props.serviceWorker);
	};

	return [serviceWorker];
}

class ServiceWorkerDetails extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$6, create_fragment$6, safe_not_equal, { serviceWorker: 0 });
	}
}

/* src/components/Duration.svelte generated by Svelte v3.26.0 */

function create_fragment$7(ctx) {
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

function instance$7($$self, $$props, $$invalidate) {
	let { seconds } = $$props;

	$$self.$$set = $$props => {
		if ("seconds" in $$props) $$invalidate(0, seconds = $$props.seconds);
	};

	return [seconds];
}

class Duration extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$7, create_fragment$7, safe_not_equal, { seconds: 0 });
	}
}

/* src/components/ServerDetails.svelte generated by Svelte v3.26.0 */

function create_else_block(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			div.textContent = "down";
			attr(div, "class", "error");
		},
		m(target, anchor) {
			insert(target, div, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (20:4) {#if server.uptime >= 0}
function create_if_block$4(ctx) {
	let duration;
	let current;

	duration = new Duration({
			props: { seconds: /*server*/ ctx[0].uptime }
		});

	return {
		c() {
			create_component(duration.$$.fragment);
		},
		m(target, anchor) {
			mount_component(duration, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const duration_changes = {};
			if (dirty & /*server*/ 1) duration_changes.seconds = /*server*/ ctx[0].uptime;
			duration.$set(duration_changes);
		},
		i(local) {
			if (current) return;
			transition_in(duration.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(duration.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(duration, detaching);
		}
	};
}

function create_fragment$8(ctx) {
	let tr0;
	let t1;
	let tr1;
	let td1;
	let t2;
	let td2;
	let t4;
	let td3;
	let t5_value = /*server*/ ctx[0].version + "";
	let t5;
	let t6;
	let tr2;
	let td4;
	let t7;
	let td5;
	let t9;
	let td6;
	let current_block_type_index;
	let if_block;
	let t10;
	let tr3;
	let td7;
	let t11;
	let td8;
	let t13;
	let td9;
	let t14_value = formatBytes(/*server*/ ctx[0].memory.heapTotal) + "";
	let t14;
	let t15;
	let tr4;
	let td10;
	let t16;
	let td11;
	let t18;
	let td12;
	let t19_value = formatBytes(/*server*/ ctx[0].memory.heapUsed) + "";
	let t19;
	let t20;
	let tr5;
	let td13;
	let t21;
	let td14;
	let t23;
	let td15;
	let t24_value = formatBytes(/*server*/ ctx[0].memory.external) + "";
	let t24;
	let t25;
	let tr6;
	let td16;
	let t26;
	let td17;
	let t28;
	let td18;
	let t29_value = formatBytes(/*server*/ ctx[0].memory.rss) + "";
	let t29;
	let current;
	const if_block_creators = [create_if_block$4, create_else_block];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*server*/ ctx[0].uptime >= 0) return 0;
		return 1;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	return {
		c() {
			tr0 = element("tr");
			tr0.innerHTML = `<td colspan="3">Server</td>`;
			t1 = space();
			tr1 = element("tr");
			td1 = element("td");
			t2 = space();
			td2 = element("td");
			td2.textContent = "Version";
			t4 = space();
			td3 = element("td");
			t5 = text(t5_value);
			t6 = space();
			tr2 = element("tr");
			td4 = element("td");
			t7 = space();
			td5 = element("td");
			td5.textContent = "Uptime";
			t9 = space();
			td6 = element("td");
			if_block.c();
			t10 = space();
			tr3 = element("tr");
			td7 = element("td");
			t11 = space();
			td8 = element("td");
			td8.textContent = "Heap Total";
			t13 = space();
			td9 = element("td");
			t14 = text(t14_value);
			t15 = space();
			tr4 = element("tr");
			td10 = element("td");
			t16 = space();
			td11 = element("td");
			td11.textContent = "Heap Used";
			t18 = space();
			td12 = element("td");
			t19 = text(t19_value);
			t20 = space();
			tr5 = element("tr");
			td13 = element("td");
			t21 = space();
			td14 = element("td");
			td14.textContent = "External";
			t23 = space();
			td15 = element("td");
			t24 = text(t24_value);
			t25 = space();
			tr6 = element("tr");
			td16 = element("td");
			t26 = space();
			td17 = element("td");
			td17.textContent = "RSS";
			t28 = space();
			td18 = element("td");
			t29 = text(t29_value);
		},
		m(target, anchor) {
			insert(target, tr0, anchor);
			insert(target, t1, anchor);
			insert(target, tr1, anchor);
			append(tr1, td1);
			append(tr1, t2);
			append(tr1, td2);
			append(tr1, t4);
			append(tr1, td3);
			append(td3, t5);
			insert(target, t6, anchor);
			insert(target, tr2, anchor);
			append(tr2, td4);
			append(tr2, t7);
			append(tr2, td5);
			append(tr2, t9);
			append(tr2, td6);
			if_blocks[current_block_type_index].m(td6, null);
			insert(target, t10, anchor);
			insert(target, tr3, anchor);
			append(tr3, td7);
			append(tr3, t11);
			append(tr3, td8);
			append(tr3, t13);
			append(tr3, td9);
			append(td9, t14);
			insert(target, t15, anchor);
			insert(target, tr4, anchor);
			append(tr4, td10);
			append(tr4, t16);
			append(tr4, td11);
			append(tr4, t18);
			append(tr4, td12);
			append(td12, t19);
			insert(target, t20, anchor);
			insert(target, tr5, anchor);
			append(tr5, td13);
			append(tr5, t21);
			append(tr5, td14);
			append(tr5, t23);
			append(tr5, td15);
			append(td15, t24);
			insert(target, t25, anchor);
			insert(target, tr6, anchor);
			append(tr6, td16);
			append(tr6, t26);
			append(tr6, td17);
			append(tr6, t28);
			append(tr6, td18);
			append(td18, t29);
			current = true;
		},
		p(ctx, [dirty]) {
			if ((!current || dirty & /*server*/ 1) && t5_value !== (t5_value = /*server*/ ctx[0].version + "")) set_data(t5, t5_value);
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type(ctx);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				}

				transition_in(if_block, 1);
				if_block.m(td6, null);
			}

			if ((!current || dirty & /*server*/ 1) && t14_value !== (t14_value = formatBytes(/*server*/ ctx[0].memory.heapTotal) + "")) set_data(t14, t14_value);
			if ((!current || dirty & /*server*/ 1) && t19_value !== (t19_value = formatBytes(/*server*/ ctx[0].memory.heapUsed) + "")) set_data(t19, t19_value);
			if ((!current || dirty & /*server*/ 1) && t24_value !== (t24_value = formatBytes(/*server*/ ctx[0].memory.external) + "")) set_data(t24, t24_value);
			if ((!current || dirty & /*server*/ 1) && t29_value !== (t29_value = formatBytes(/*server*/ ctx[0].memory.rss) + "")) set_data(t29, t29_value);
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(tr0);
			if (detaching) detach(t1);
			if (detaching) detach(tr1);
			if (detaching) detach(t6);
			if (detaching) detach(tr2);
			if_blocks[current_block_type_index].d();
			if (detaching) detach(t10);
			if (detaching) detach(tr3);
			if (detaching) detach(t15);
			if (detaching) detach(tr4);
			if (detaching) detach(t20);
			if (detaching) detach(tr5);
			if (detaching) detach(t25);
			if (detaching) detach(tr6);
		}
	};
}

function instance$8($$self, $$props, $$invalidate) {
	let { server } = $$props;

	$$self.$$set = $$props => {
		if ("server" in $$props) $$invalidate(0, server = $$props.server);
	};

	return [server];
}

class ServerDetails extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$8, create_fragment$8, safe_not_equal, { server: 0 });
	}
}

/* src/components/DateTime.svelte generated by Svelte v3.26.0 */

function create_fragment$9(ctx) {
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

function instance$9($$self, $$props, $$invalidate) {
	let { date } = $$props;

	$$self.$$set = $$props => {
		if ("date" in $$props) $$invalidate(0, date = $$props.date);
	};

	return [date];
}

class DateTime extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$9, create_fragment$9, safe_not_equal, { date: 0 });
	}
}

/* src/components/SessionDetails.svelte generated by Svelte v3.26.0 */

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[1] = list[i];
	return child_ctx;
}

// (26:4) {#each [...session.entitlements].sort() as name}
function create_each_block(ctx) {
	let entitlement;
	let current;
	entitlement = new Entitlement({ props: { id: /*name*/ ctx[1] } });

	return {
		c() {
			create_component(entitlement.$$.fragment);
		},
		m(target, anchor) {
			mount_component(entitlement, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const entitlement_changes = {};
			if (dirty & /*session*/ 1) entitlement_changes.id = /*name*/ ctx[1];
			entitlement.$set(entitlement_changes);
		},
		i(local) {
			if (current) return;
			transition_in(entitlement.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(entitlement.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(entitlement, detaching);
		}
	};
}

function create_fragment$a(ctx) {
	let tr0;
	let t1;
	let tr1;
	let td1;
	let t2;
	let td2;
	let t4;
	let td3;
	let t5_value = /*session*/ ctx[0].username + "";
	let t5;
	let t6;
	let tr2;
	let td4;
	let t7;
	let td5;
	let t9;
	let td6;
	let datetime;
	let td6_class_value;
	let t10;
	let tr3;
	let td7;
	let t11;
	let td8;
	let t13;
	let td9;
	let current;

	datetime = new DateTime({
			props: { date: /*session*/ ctx[0].expirationDate }
		});

	let each_value = [.../*session*/ ctx[0].entitlements].sort();
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			tr0 = element("tr");
			tr0.innerHTML = `<td colspan="3">Session</td>`;
			t1 = space();
			tr1 = element("tr");
			td1 = element("td");
			t2 = space();
			td2 = element("td");
			td2.textContent = "Username";
			t4 = space();
			td3 = element("td");
			t5 = text(t5_value);
			t6 = space();
			tr2 = element("tr");
			td4 = element("td");
			t7 = space();
			td5 = element("td");
			td5.textContent = "Expiration";
			t9 = space();
			td6 = element("td");
			create_component(datetime.$$.fragment);
			t10 = space();
			tr3 = element("tr");
			td7 = element("td");
			t11 = space();
			td8 = element("td");
			td8.textContent = "Entitlements";
			t13 = space();
			td9 = element("td");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(td6, "class", td6_class_value = /*session*/ ctx[0].isValid ? "ok" : "error");
		},
		m(target, anchor) {
			insert(target, tr0, anchor);
			insert(target, t1, anchor);
			insert(target, tr1, anchor);
			append(tr1, td1);
			append(tr1, t2);
			append(tr1, td2);
			append(tr1, t4);
			append(tr1, td3);
			append(td3, t5);
			insert(target, t6, anchor);
			insert(target, tr2, anchor);
			append(tr2, td4);
			append(tr2, t7);
			append(tr2, td5);
			append(tr2, t9);
			append(tr2, td6);
			mount_component(datetime, td6, null);
			insert(target, t10, anchor);
			insert(target, tr3, anchor);
			append(tr3, td7);
			append(tr3, t11);
			append(tr3, td8);
			append(tr3, t13);
			append(tr3, td9);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(td9, null);
			}

			current = true;
		},
		p(ctx, [dirty]) {
			if ((!current || dirty & /*session*/ 1) && t5_value !== (t5_value = /*session*/ ctx[0].username + "")) set_data(t5, t5_value);
			const datetime_changes = {};
			if (dirty & /*session*/ 1) datetime_changes.date = /*session*/ ctx[0].expirationDate;
			datetime.$set(datetime_changes);

			if (!current || dirty & /*session*/ 1 && td6_class_value !== (td6_class_value = /*session*/ ctx[0].isValid ? "ok" : "error")) {
				attr(td6, "class", td6_class_value);
			}

			if (dirty & /*session*/ 1) {
				each_value = [.../*session*/ ctx[0].entitlements].sort();
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(td9, null);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(datetime.$$.fragment, local);

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			transition_out(datetime.$$.fragment, local);
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(tr0);
			if (detaching) detach(t1);
			if (detaching) detach(tr1);
			if (detaching) detach(t6);
			if (detaching) detach(tr2);
			destroy_component(datetime);
			if (detaching) detach(t10);
			if (detaching) detach(tr3);
			destroy_each(each_blocks, detaching);
		}
	};
}

function instance$a($$self, $$props, $$invalidate) {
	let { session } = $$props;

	$$self.$$set = $$props => {
		if ("session" in $$props) $$invalidate(0, session = $$props.session);
	};

	return [session];
}

class SessionDetails extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$a, create_fragment$a, safe_not_equal, { session: 0 });
	}
}

/* src/components/PeerDetails.svelte generated by Svelte v3.26.0 */

function get_each_context$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[1] = list[i];
	return child_ctx;
}

// (10:4) {#each peers as peer}
function create_each_block$1(ctx) {
	let peer;
	let current;
	peer = new Peer({ props: { peer: /*peer*/ ctx[1] } });

	return {
		c() {
			create_component(peer.$$.fragment);
		},
		m(target, anchor) {
			mount_component(peer, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const peer_changes = {};
			if (dirty & /*peers*/ 1) peer_changes.peer = /*peer*/ ctx[1];
			peer.$set(peer_changes);
		},
		i(local) {
			if (current) return;
			transition_in(peer.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(peer.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(peer, detaching);
		}
	};
}

function create_fragment$b(ctx) {
	let tr;
	let td0;
	let t1;
	let td1;
	let current;
	let each_value = /*peers*/ ctx[0];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			tr = element("tr");
			td0 = element("td");
			td0.textContent = "Peers";
			t1 = space();
			td1 = element("td");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(td1, "colspan", "2");
		},
		m(target, anchor) {
			insert(target, tr, anchor);
			append(tr, td0);
			append(tr, t1);
			append(tr, td1);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(td1, null);
			}

			current = true;
		},
		p(ctx, [dirty]) {
			if (dirty & /*peers*/ 1) {
				each_value = /*peers*/ ctx[0];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$1(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block$1(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(td1, null);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(tr);
			destroy_each(each_blocks, detaching);
		}
	};
}

function instance$b($$self, $$props, $$invalidate) {
	let { peers } = $$props;

	$$self.$$set = $$props => {
		if ("peers" in $$props) $$invalidate(0, peers = $$props.peers);
	};

	return [peers];
}

class PeerDetails extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$b, create_fragment$b, safe_not_equal, { peers: 0 });
	}
}

/* src/components/ApplicationDetails.svelte generated by Svelte v3.26.0 */

function create_fragment$c(ctx) {
	let tr0;
	let td0;
	let t0;
	let t1;
	let tr1;
	let td1;
	let t2;
	let t3;
	let tr2;
	let td2;
	let t4;
	let td3;
	let t6;
	let td4;
	let t7;

	return {
		c() {
			tr0 = element("tr");
			td0 = element("td");
			t0 = text(/*name*/ ctx[0]);
			t1 = space();
			tr1 = element("tr");
			td1 = element("td");
			t2 = text(/*description*/ ctx[2]);
			t3 = space();
			tr2 = element("tr");
			td2 = element("td");
			t4 = space();
			td3 = element("td");
			td3.textContent = "Version";
			t6 = space();
			td4 = element("td");
			t7 = text(/*version*/ ctx[1]);
			attr(td0, "colspan", "3");
			attr(td1, "colspan", "3");
		},
		m(target, anchor) {
			insert(target, tr0, anchor);
			append(tr0, td0);
			append(td0, t0);
			insert(target, t1, anchor);
			insert(target, tr1, anchor);
			append(tr1, td1);
			append(td1, t2);
			insert(target, t3, anchor);
			insert(target, tr2, anchor);
			append(tr2, td2);
			append(tr2, t4);
			append(tr2, td3);
			append(tr2, t6);
			append(tr2, td4);
			append(td4, t7);
		},
		p(ctx, [dirty]) {
			if (dirty & /*name*/ 1) set_data(t0, /*name*/ ctx[0]);
			if (dirty & /*description*/ 4) set_data(t2, /*description*/ ctx[2]);
			if (dirty & /*version*/ 2) set_data(t7, /*version*/ ctx[1]);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(tr0);
			if (detaching) detach(t1);
			if (detaching) detach(tr1);
			if (detaching) detach(t3);
			if (detaching) detach(tr2);
		}
	};
}

function instance$c($$self, $$props, $$invalidate) {
	let { name } = $$props;
	let { version } = $$props;
	let { description } = $$props;

	$$self.$$set = $$props => {
		if ("name" in $$props) $$invalidate(0, name = $$props.name);
		if ("version" in $$props) $$invalidate(1, version = $$props.version);
		if ("description" in $$props) $$invalidate(2, description = $$props.description);
	};

	return [name, version, description];
}

class ApplicationDetails extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$c, create_fragment$c, safe_not_equal, { name: 0, version: 1, description: 2 });
	}
}

/* src/components/About.svelte generated by Svelte v3.26.0 */

function create_fragment$d(ctx) {
	let table;
	let tbody;
	let current;
	const default_slot_template = /*#slots*/ ctx[1].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

	return {
		c() {
			table = element("table");
			tbody = element("tbody");
			if (default_slot) default_slot.c();
			attr(table, "class", "bordered striped hoverable");
		},
		m(target, anchor) {
			insert(target, table, anchor);
			append(table, tbody);

			if (default_slot) {
				default_slot.m(tbody, null);
			}

			current = true;
		},
		p(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && dirty & /*$$scope*/ 1) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[0], dirty, null, null);
				}
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
			if (detaching) detach(table);
			if (default_slot) default_slot.d(detaching);
		}
	};
}

function instance$d($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	return [$$scope, slots];
}

class About extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$d, create_fragment$d, safe_not_equal, {});
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

/* tests/app/src/App.svelte generated by Svelte v3.26.0 */

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

// (76:8) <div slot="content" class="dropdown-menu dropdown-menu-sw">
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

// (74:6) <Menue>
function create_default_slot_5(ctx) {
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

// (90:2) <ActionButton {action}>
function create_default_slot_4(ctx) {
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

// (94:2) <ActionButton action={failingAction}>
function create_default_slot_3(ctx) {
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

// (98:4) <ul id="collapse-content" slot="content" in:fade out:fade>
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

// (96:2) <Collapse>
function create_default_slot_2(ctx) {
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

// (113:2) {#if modal}
function create_if_block_1$1(ctx) {
	let modal_1;
	let current;

	modal_1 = new Modal({
			props: {
				close: /*close*/ ctx[4],
				$$slots: { default: [create_default_slot_1] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(modal_1.$$.fragment);
		},
		m(target, anchor) {
			mount_component(modal_1, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const modal_1_changes = {};

			if (dirty & /*$$scope*/ 512) {
				modal_1_changes.$$scope = { dirty, ctx };
			}

			modal_1.$set(modal_1_changes);
		},
		i(local) {
			if (current) return;
			transition_in(modal_1.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(modal_1.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(modal_1, detaching);
		}
	};
}

// (114:4) <Modal {close}>
function create_default_slot_1(ctx) {
	let form;

	return {
		c() {
			form = element("form");

			form.innerHTML = `<fieldset><label for="username">Username 1 <input id="username" type="text" placeholder="Username" name="username" required="" value="XXX" size="10"/></label> 
          <label for="password">Password 1 <input id="password" type="password" placeholder="Password" name="password" size="10" required=""/></label></fieldset> 

        <button id="submit" type="submit">Login</button>`;
		},
		m(target, anchor) {
			insert(target, form, anchor);
		},
		d(detaching) {
			if (detaching) detach(form);
		}
	};
}

// (130:2) {#if about}
function create_if_block$5(ctx) {
	let about_1;
	let current;

	about_1 = new About({
			props: {
				$$slots: { default: [create_default_slot] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(about_1.$$.fragment);
		},
		m(target, anchor) {
			mount_component(about_1, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const about_1_changes = {};

			if (dirty & /*$$scope, server*/ 516) {
				about_1_changes.$$scope = { dirty, ctx };
			}

			about_1.$set(about_1_changes);
		},
		i(local) {
			if (current) return;
			transition_in(about_1.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(about_1.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(about_1, detaching);
		}
	};
}

// (131:4) <About>
function create_default_slot(ctx) {
	let applicationdetails;
	let t0;
	let tr;
	let t5;
	let sessiondetails;
	let t6;
	let serverdetails;
	let t7;
	let serviceworkerdetails;
	let t8;
	let peerdetails;
	let current;

	applicationdetails = new ApplicationDetails({
			props: {
				version: "1.0",
				name: "my title",
				description: "a description"
			}
		});

	sessiondetails = new SessionDetails({ props: { session: /*session*/ ctx[5] } });
	serverdetails = new ServerDetails({ props: { server: /*server*/ ctx[2] } });

	serviceworkerdetails = new ServiceWorkerDetails({
			props: { serviceWorker: /*serviceWorker*/ ctx[7] }
		});

	peerdetails = new PeerDetails({ props: { peers: /*peers*/ ctx[6] } });

	return {
		c() {
			create_component(applicationdetails.$$.fragment);
			t0 = space();
			tr = element("tr");

			tr.innerHTML = `<td></td> 
        <td>a new entry</td> 
        <td>a value</td>`;

			t5 = space();
			create_component(sessiondetails.$$.fragment);
			t6 = space();
			create_component(serverdetails.$$.fragment);
			t7 = space();
			create_component(serviceworkerdetails.$$.fragment);
			t8 = space();
			create_component(peerdetails.$$.fragment);
		},
		m(target, anchor) {
			mount_component(applicationdetails, target, anchor);
			insert(target, t0, anchor);
			insert(target, tr, anchor);
			insert(target, t5, anchor);
			mount_component(sessiondetails, target, anchor);
			insert(target, t6, anchor);
			mount_component(serverdetails, target, anchor);
			insert(target, t7, anchor);
			mount_component(serviceworkerdetails, target, anchor);
			insert(target, t8, anchor);
			mount_component(peerdetails, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const serverdetails_changes = {};
			if (dirty & /*server*/ 4) serverdetails_changes.server = /*server*/ ctx[2];
			serverdetails.$set(serverdetails_changes);
		},
		i(local) {
			if (current) return;
			transition_in(applicationdetails.$$.fragment, local);
			transition_in(sessiondetails.$$.fragment, local);
			transition_in(serverdetails.$$.fragment, local);
			transition_in(serviceworkerdetails.$$.fragment, local);
			transition_in(peerdetails.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(applicationdetails.$$.fragment, local);
			transition_out(sessiondetails.$$.fragment, local);
			transition_out(serverdetails.$$.fragment, local);
			transition_out(serviceworkerdetails.$$.fragment, local);
			transition_out(peerdetails.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(applicationdetails, detaching);
			if (detaching) detach(t0);
			if (detaching) detach(tr);
			if (detaching) detach(t5);
			destroy_component(sessiondetails, detaching);
			if (detaching) detach(t6);
			destroy_component(serverdetails, detaching);
			if (detaching) detach(t7);
			destroy_component(serviceworkerdetails, detaching);
			if (detaching) detach(t8);
			destroy_component(peerdetails, detaching);
		}
	};
}

function create_fragment$e(ctx) {
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
	let t13;
	let t14;
	let current;

	menue = new Menue({
			props: {
				$$slots: {
					default: [create_default_slot_5],
					content: [create_content_slot_1],
					title: [create_title_slot]
				},
				$$scope: { ctx }
			}
		});

	actionbutton0 = new ActionButton({
			props: {
				action: /*action*/ ctx[3],
				$$slots: { default: [create_default_slot_4] },
				$$scope: { ctx }
			}
		});

	actionbutton1 = new ActionButton({
			props: {
				action: failingAction,
				$$slots: { default: [create_default_slot_3] },
				$$scope: { ctx }
			}
		});

	collapse = new Collapse({
			props: {
				$$slots: {
					default: [create_default_slot_2],
					content: [create_content_slot]
				},
				$$scope: { ctx }
			}
		});

	duration0 = new Duration({ props: { seconds: "1000000" } });
	duration1 = new Duration({ props: { seconds: "5000" } });
	datetime = new DateTime({ props: { date: new Date() } });
	let if_block0 = /*modal*/ ctx[1] && create_if_block_1$1(ctx);
	let if_block1 =  create_if_block$5(ctx);

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
			t10 = text("Days\n    ");
			create_component(duration0.$$.fragment);
			t11 = text("\n    Hours\n    ");
			create_component(duration1.$$.fragment);
			t12 = space();
			create_component(datetime.$$.fragment);
			t13 = space();
			if (if_block0) if_block0.c();
			t14 = space();
			if (if_block1) if_block1.c();
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
			append(main, t13);
			if (if_block0) if_block0.m(main, null);
			append(main, t14);
			if (if_block1) if_block1.m(main, null);
			current = true;
		},
		p(ctx, [dirty]) {
			const menue_changes = {};

			if (dirty & /*$$scope*/ 512) {
				menue_changes.$$scope = { dirty, ctx };
			}

			menue.$set(menue_changes);
			const actionbutton0_changes = {};

			if (dirty & /*$$scope*/ 512) {
				actionbutton0_changes.$$scope = { dirty, ctx };
			}

			actionbutton0.$set(actionbutton0_changes);
			if (!current || dirty & /*actionExecuted*/ 1) set_data(t6, /*actionExecuted*/ ctx[0]);
			const actionbutton1_changes = {};

			if (dirty & /*$$scope*/ 512) {
				actionbutton1_changes.$$scope = { dirty, ctx };
			}

			actionbutton1.$set(actionbutton1_changes);
			const collapse_changes = {};

			if (dirty & /*$$scope*/ 512) {
				collapse_changes.$$scope = { dirty, ctx };
			}

			collapse.$set(collapse_changes);

			if (/*modal*/ ctx[1]) {
				if (if_block0) {
					if_block0.p(ctx, dirty);

					if (dirty & /*modal*/ 2) {
						transition_in(if_block0, 1);
					}
				} else {
					if_block0 = create_if_block_1$1(ctx);
					if_block0.c();
					transition_in(if_block0, 1);
					if_block0.m(main, t14);
				}
			} else if (if_block0) {
				group_outros();

				transition_out(if_block0, 1, 1, () => {
					if_block0 = null;
				});

				check_outros();
			}

			if_block1.p(ctx, dirty);
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
			transition_in(if_block0);
			transition_in(if_block1);
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
			transition_out(if_block0);
			transition_out(if_block1);
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
			if (if_block0) if_block0.d();
			if (if_block1) if_block1.d();
		}
	};
}

async function failingAction() {
	return new Promise((resolve, reject) => setTimeout(() => reject("failed"), 5000));
}

async function logout() {
	alert("logout");
}

function instance$e($$self, $$props, $$invalidate) {
	let actionExecuted = false;

	async function action() {
		$$invalidate(0, actionExecuted = true);
		return new Promise(resolve => setTimeout(resolve, 5000));
	}

	let modal = true;

	let close = () => {
		$$invalidate(1, modal = false);
	};

	const session = {
		isValid: true,
		username: "huho",
		entitlements: ["a", "b", "c"],
		expirationDate: new Date()
	};

	const start = Date.now();

	const server = {
		version: "1.2.3",
		memory: {
			heapTotal: 1200000,
			heapUsed: 1000000,
			rss: 0,
			external: 0
		}
	};

	setInterval(() => $$invalidate(2, server.uptime = (Date.now() - start) / 1000, server), 5000);
	const peers = [{ host: "somewhere", port: 33 }];

	//const serviceWorker = { state: "up", scriptURL: "somewhere.mjs" };
	const serviceWorker = initializeServiceWorker("service-worker.mjs");

	return [actionExecuted, modal, server, action, close, session, peers, serviceWorker];
}

class App extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$e, create_fragment$e, safe_not_equal, {});
	}
}

var index = new App({
  target: document.body
});

export default index;
//# sourceMappingURL=bundle.main.mjs.map
