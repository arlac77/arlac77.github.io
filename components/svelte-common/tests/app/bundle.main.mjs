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
function subscribe(store, ...callbacks) {
    if (store == null) {
        return noop;
    }
    const unsub = store.subscribe(...callbacks);
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}
function component_subscribe(component, store, callback) {
    component.$$.on_destroy.push(subscribe(store, callback));
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
    node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
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
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
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

/* src/components/TCPSocket.svelte generated by Svelte v3.29.4 */

function create_fragment(ctx) {
	let t0_value = /*socket*/ ctx[0].host + "";
	let t0;
	let t1;
	let t2_value = /*socket*/ ctx[0].port + "";
	let t2;

	return {
		c() {
			t0 = text(t0_value);
			t1 = text(":");
			t2 = text(t2_value);
		},
		m(target, anchor) {
			insert(target, t0, anchor);
			insert(target, t1, anchor);
			insert(target, t2, anchor);
		},
		p(ctx, [dirty]) {
			if (dirty & /*socket*/ 1 && t0_value !== (t0_value = /*socket*/ ctx[0].host + "")) set_data(t0, t0_value);
			if (dirty & /*socket*/ 1 && t2_value !== (t2_value = /*socket*/ ctx[0].port + "")) set_data(t2, t2_value);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(t0);
			if (detaching) detach(t1);
			if (detaching) detach(t2);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { socket } = $$props;

	$$self.$$set = $$props => {
		if ("socket" in $$props) $$invalidate(0, socket = $$props.socket);
	};

	return [socket];
}

class TCPSocket extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { socket: 0 });
	}
}

/* src/components/Peer.svelte generated by Svelte v3.29.4 */

function add_css() {
	var style = element("style");
	style.id = "svelte-r1ty4g-style";
	style.textContent = ".peer.svelte-r1ty4g{display:inline-block;background-color:var(--button-disabled-background-color);border-radius:0.5em;padding:0.2em;margin:0.2em}";
	append(document.head, style);
}

// (18:2) {#if peer.referrer}
function create_if_block_1(ctx) {
	let t0;
	let tcpsocket;
	let t1;
	let current;

	tcpsocket = new TCPSocket({
			props: { socket: /*peer*/ ctx[0].referrer }
		});

	return {
		c() {
			t0 = text("(referrer\n    ");
			create_component(tcpsocket.$$.fragment);
			t1 = text(")");
		},
		m(target, anchor) {
			insert(target, t0, anchor);
			mount_component(tcpsocket, target, anchor);
			insert(target, t1, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const tcpsocket_changes = {};
			if (dirty & /*peer*/ 1) tcpsocket_changes.socket = /*peer*/ ctx[0].referrer;
			tcpsocket.$set(tcpsocket_changes);
		},
		i(local) {
			if (current) return;
			transition_in(tcpsocket.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(tcpsocket.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(t0);
			destroy_component(tcpsocket, detaching);
			if (detaching) detach(t1);
		}
	};
}

// (22:2) {#if peer.to}
function create_if_block(ctx) {
	let t0;
	let tcpsocket;
	let t1;
	let current;
	tcpsocket = new TCPSocket({ props: { socket: /*peer*/ ctx[0].to } });

	return {
		c() {
			t0 = text("(to\n    ");
			create_component(tcpsocket.$$.fragment);
			t1 = text(")");
		},
		m(target, anchor) {
			insert(target, t0, anchor);
			mount_component(tcpsocket, target, anchor);
			insert(target, t1, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const tcpsocket_changes = {};
			if (dirty & /*peer*/ 1) tcpsocket_changes.socket = /*peer*/ ctx[0].to;
			tcpsocket.$set(tcpsocket_changes);
		},
		i(local) {
			if (current) return;
			transition_in(tcpsocket.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(tcpsocket.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(t0);
			destroy_component(tcpsocket, detaching);
			if (detaching) detach(t1);
		}
	};
}

function create_fragment$1(ctx) {
	let div;
	let tcpsocket;
	let t0;
	let t1;
	let current;
	tcpsocket = new TCPSocket({ props: { socket: /*peer*/ ctx[0] } });
	let if_block0 = /*peer*/ ctx[0].referrer && create_if_block_1(ctx);
	let if_block1 = /*peer*/ ctx[0].to && create_if_block(ctx);

	return {
		c() {
			div = element("div");
			create_component(tcpsocket.$$.fragment);
			t0 = space();
			if (if_block0) if_block0.c();
			t1 = space();
			if (if_block1) if_block1.c();
			attr(div, "class", "peer svelte-r1ty4g");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			mount_component(tcpsocket, div, null);
			append(div, t0);
			if (if_block0) if_block0.m(div, null);
			append(div, t1);
			if (if_block1) if_block1.m(div, null);
			current = true;
		},
		p(ctx, [dirty]) {
			const tcpsocket_changes = {};
			if (dirty & /*peer*/ 1) tcpsocket_changes.socket = /*peer*/ ctx[0];
			tcpsocket.$set(tcpsocket_changes);

			if (/*peer*/ ctx[0].referrer) {
				if (if_block0) {
					if_block0.p(ctx, dirty);

					if (dirty & /*peer*/ 1) {
						transition_in(if_block0, 1);
					}
				} else {
					if_block0 = create_if_block_1(ctx);
					if_block0.c();
					transition_in(if_block0, 1);
					if_block0.m(div, t1);
				}
			} else if (if_block0) {
				group_outros();

				transition_out(if_block0, 1, 1, () => {
					if_block0 = null;
				});

				check_outros();
			}

			if (/*peer*/ ctx[0].to) {
				if (if_block1) {
					if_block1.p(ctx, dirty);

					if (dirty & /*peer*/ 1) {
						transition_in(if_block1, 1);
					}
				} else {
					if_block1 = create_if_block(ctx);
					if_block1.c();
					transition_in(if_block1, 1);
					if_block1.m(div, null);
				}
			} else if (if_block1) {
				group_outros();

				transition_out(if_block1, 1, 1, () => {
					if_block1 = null;
				});

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(tcpsocket.$$.fragment, local);
			transition_in(if_block0);
			transition_in(if_block1);
			current = true;
		},
		o(local) {
			transition_out(tcpsocket.$$.fragment, local);
			transition_out(if_block0);
			transition_out(if_block1);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			destroy_component(tcpsocket);
			if (if_block0) if_block0.d();
			if (if_block1) if_block1.d();
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
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
		init(this, options, instance$1, create_fragment$1, safe_not_equal, { peer: 0 });
	}
}

/* src/components/Entitlement.svelte generated by Svelte v3.29.4 */

function add_css$1() {
	var style = element("style");
	style.id = "svelte-irwou9-style";
	style.textContent = ".entitlement.svelte-irwou9{display:inline-block;background-color:var(--button-disabled-background-color);border-radius:0.5em;padding:0.2em;margin:0.2em}";
	append(document.head, style);
}

function create_fragment$2(ctx) {
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

function instance$2($$self, $$props, $$invalidate) {
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
		init(this, options, instance$2, create_fragment$2, safe_not_equal, { id: 0 });
	}
}

/* src/components/Modal.svelte generated by Svelte v3.29.4 */

function create_fragment$3(ctx) {
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

function instance$3($$self, $$props, $$invalidate) {
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
		init(this, options, instance$3, create_fragment$3, safe_not_equal, { close: 3 });
	}
}

/* src/components/Collapse.svelte generated by Svelte v3.29.4 */

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

function create_fragment$4(ctx) {
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

function instance$4($$self, $$props, $$invalidate) {
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
		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});
	}
}

/* src/components/ActionButton.svelte generated by Svelte v3.29.4 */

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

function create_fragment$5(ctx) {
	let button;
	let t;
	let current;
	let mounted;
	let dispose;
	let if_block = /*active*/ ctx[0] && create_if_block$2();
	const default_slot_template = /*#slots*/ ctx[5].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[4], null);

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
				if (default_slot.p && dirty & /*$$scope*/ 16) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[4], dirty, null, null);
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

function instance$5($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let { action } = $$props;
	let { error = e => console.error(e) } = $$props;
	let active;

	async function click() {
		try {
			$$invalidate(0, active = true);
			await action();
		} catch(e) {
			error(e);
		} finally {
			$$invalidate(0, active = false);
		}
	}

	$$self.$$set = $$props => {
		if ("action" in $$props) $$invalidate(2, action = $$props.action);
		if ("error" in $$props) $$invalidate(3, error = $$props.error);
		if ("$$scope" in $$props) $$invalidate(4, $$scope = $$props.$$scope);
	};

	return [active, click, action, error, $$scope, slots];
}

class ActionButton extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$5, create_fragment$5, safe_not_equal, { action: 2, error: 3 });
	}
}

/* src/components/AnchorContentCatcher.svelte generated by Svelte v3.29.4 */

function add_css$2() {
	var style = element("style");
	style.id = "svelte-1biulrt-style";
	style.textContent = "svg.svelte-1biulrt.svelte-1biulrt{position:absolute;z-index:99;pointer-events:none}svg.svelte-1biulrt.svelte-1biulrt:hover{stroke-width:6}svg.svelte-1biulrt path.svelte-1biulrt{stroke:red;stroke-width:2;fill:#eee7;pointer-events:auto}";
	append(document.head, style);
}

const get_content_slot_changes$1 = dirty => ({});
const get_content_slot_context$1 = ctx => ({});
const get_anchor_slot_changes = dirty => ({});
const get_anchor_slot_context = ctx => ({});

function create_fragment$6(ctx) {
	let svg;
	let path_1;
	let rect;
	let t0;
	let div0;
	let t1;
	let div1;
	let current;
	let mounted;
	let dispose;
	const anchor_slot_template = /*#slots*/ ctx[5].anchor;
	const anchor_slot = create_slot(anchor_slot_template, ctx, /*$$scope*/ ctx[4], get_anchor_slot_context);
	const content_slot_template = /*#slots*/ ctx[5].content;
	const content_slot = create_slot(content_slot_template, ctx, /*$$scope*/ ctx[4], get_content_slot_context$1);

	return {
		c() {
			svg = svg_element("svg");
			path_1 = svg_element("path");
			rect = svg_element("rect");
			t0 = space();
			div0 = element("div");
			if (anchor_slot) anchor_slot.c();
			t1 = space();
			div1 = element("div");
			if (content_slot) content_slot.c();
			attr(path_1, "class", "svelte-1biulrt");
			attr(rect, "width", "100");
			attr(rect, "height", "100");
			attr(svg, "width", "10000");
			attr(svg, "height", "10000");
			attr(svg, "class", "svelte-1biulrt");
		},
		m(target, anchor) {
			insert(target, svg, anchor);
			append(svg, path_1);
			/*path_1_binding*/ ctx[6](path_1);
			append(svg, rect);
			insert(target, t0, anchor);
			insert(target, div0, anchor);

			if (anchor_slot) {
				anchor_slot.m(div0, null);
			}

			/*div0_binding*/ ctx[7](div0);
			insert(target, t1, anchor);
			insert(target, div1, anchor);

			if (content_slot) {
				content_slot.m(div1, null);
			}

			/*div1_binding*/ ctx[8](div1);
			current = true;

			if (!mounted) {
				dispose = listen(div0, "mouseleave", function () {
					if (is_function(/*close*/ ctx[0])) /*close*/ ctx[0].apply(this, arguments);
				});

				mounted = true;
			}
		},
		p(new_ctx, [dirty]) {
			ctx = new_ctx;

			if (anchor_slot) {
				if (anchor_slot.p && dirty & /*$$scope*/ 16) {
					update_slot(anchor_slot, anchor_slot_template, ctx, /*$$scope*/ ctx[4], dirty, get_anchor_slot_changes, get_anchor_slot_context);
				}
			}

			if (content_slot) {
				if (content_slot.p && dirty & /*$$scope*/ 16) {
					update_slot(content_slot, content_slot_template, ctx, /*$$scope*/ ctx[4], dirty, get_content_slot_changes$1, get_content_slot_context$1);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(anchor_slot, local);
			transition_in(content_slot, local);
			current = true;
		},
		o(local) {
			transition_out(anchor_slot, local);
			transition_out(content_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(svg);
			/*path_1_binding*/ ctx[6](null);
			if (detaching) detach(t0);
			if (detaching) detach(div0);
			if (anchor_slot) anchor_slot.d(detaching);
			/*div0_binding*/ ctx[7](null);
			if (detaching) detach(t1);
			if (detaching) detach(div1);
			if (content_slot) content_slot.d(detaching);
			/*div1_binding*/ ctx[8](null);
			mounted = false;
			dispose();
		}
	};
}

const OFFSET = 9;

function instance$6($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let { close } = $$props;
	let anchor;
	let content;
	let path;

	function layoutPath() {
		const a = anchor.getBoundingClientRect();
		const c = content.getBoundingClientRect();
		a.x -= OFFSET;
		a.y -= OFFSET;
		c.x -= OFFSET;
		c.y -= OFFSET;
		let ax1, ax2, aw, ah, ay1, ay2, cx1;
		ax1 = a.x;
		aw = a.width;
		ah = a.height;
		ay1 = a.y;
		ay2 = a.y + a.height;
		cx1 = c.x;

		if (a.x + a.width > c.x + c.width) {
			ax1 = a.x + a.width;
			aw = -a.width;
			cx1 = c.x + c.width;
		}

		ax2 = ax1;

		if (a.y < c.y) {
			ax2 = a.x + a.width;
		}

		if (a.y + a.height > c.y + c.height) {
			ax1 = a.x + a.width;
			aw = 0;
		}

		const d = `M ${ax2} ${ay1}
   Q ${cx1} ${ay1}
    ${cx1} ${c.y}
   v ${c.height}
   Q ${cx1} ${ay2}
    ${ax1} ${ay2}
   h ${aw}
   v ${-ah}
   z`;

		console.log(d);
		path.setAttribute("d", d);
	}

	onMount(() => layoutPath());

	function path_1_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			path = $$value;
			$$invalidate(3, path);
		});
	}

	function div0_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			anchor = $$value;
			$$invalidate(1, anchor);
		});
	}

	function div1_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			content = $$value;
			$$invalidate(2, content);
		});
	}

	$$self.$$set = $$props => {
		if ("close" in $$props) $$invalidate(0, close = $$props.close);
		if ("$$scope" in $$props) $$invalidate(4, $$scope = $$props.$$scope);
	};

	return [
		close,
		anchor,
		content,
		path,
		$$scope,
		slots,
		path_1_binding,
		div0_binding,
		div1_binding
	];
}

class AnchorContentCatcher extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-1biulrt-style")) add_css$2();
		init(this, options, instance$6, create_fragment$6, safe_not_equal, { close: 0 });
	}
}

/* src/components/Menue.svelte generated by Svelte v3.29.4 */

function add_css$3() {
	var style = element("style");
	style.id = "svelte-k7ph6n-style";
	style.textContent = ".x.svelte-k7ph6n{position:absolute;top:100px}";
	append(document.head, style);
}

const get_title_slot_changes_1 = dirty => ({});
const get_title_slot_context_1 = ctx => ({});
const get_content_slot_changes$2 = dirty => ({});
const get_content_slot_context$2 = ctx => ({});
const get_title_slot_changes = dirty => ({});
const get_title_slot_context = ctx => ({});

// (29:0) {:else}
function create_else_block(ctx) {
	let a;
	let t;
	let svg;
	let path;
	let current;
	let mounted;
	let dispose;
	const title_slot_template = /*#slots*/ ctx[3].title;
	const title_slot = create_slot(title_slot_template, ctx, /*$$scope*/ ctx[4], get_title_slot_context_1);

	return {
		c() {
			a = element("a");
			if (title_slot) title_slot.c();
			t = space();
			svg = svg_element("svg");
			path = svg_element("path");
			attr(path, "d", "M6 7l6 6 6-6 2 2-8 8-8-8z");
			attr(svg, "width", "18");
			attr(svg, "height", "16");
			attr(a, "href", " ");
		},
		m(target, anchor) {
			insert(target, a, anchor);

			if (title_slot) {
				title_slot.m(a, null);
			}

			append(a, t);
			append(a, svg);
			append(svg, path);
			current = true;

			if (!mounted) {
				dispose = [
					listen(a, "click", prevent_default(/*show*/ ctx[2])),
					listen(a, "mouseenter", /*show*/ ctx[2])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (title_slot) {
				if (title_slot.p && dirty & /*$$scope*/ 16) {
					update_slot(title_slot, title_slot_template, ctx, /*$$scope*/ ctx[4], dirty, get_title_slot_changes_1, get_title_slot_context_1);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(title_slot, local);
			current = true;
		},
		o(local) {
			transition_out(title_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(a);
			if (title_slot) title_slot.d(detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (20:0) {#if open}
function create_if_block$3(ctx) {
	let anchorcontentcatcher;
	let current;

	anchorcontentcatcher = new AnchorContentCatcher({
			props: {
				close: /*hide*/ ctx[1],
				$$slots: {
					default: [create_default_slot],
					content: [create_content_slot],
					anchor: [create_anchor_slot]
				},
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(anchorcontentcatcher.$$.fragment);
		},
		m(target, anchor) {
			mount_component(anchorcontentcatcher, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const anchorcontentcatcher_changes = {};

			if (dirty & /*$$scope*/ 16) {
				anchorcontentcatcher_changes.$$scope = { dirty, ctx };
			}

			anchorcontentcatcher.$set(anchorcontentcatcher_changes);
		},
		i(local) {
			if (current) return;
			transition_in(anchorcontentcatcher.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(anchorcontentcatcher.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(anchorcontentcatcher, detaching);
		}
	};
}

// (22:4) <a href=" " slot="anchor">
function create_anchor_slot(ctx) {
	let a;
	let current;
	const title_slot_template = /*#slots*/ ctx[3].title;
	const title_slot = create_slot(title_slot_template, ctx, /*$$scope*/ ctx[4], get_title_slot_context);

	return {
		c() {
			a = element("a");
			if (title_slot) title_slot.c();
			attr(a, "href", " ");
			attr(a, "slot", "anchor");
		},
		m(target, anchor) {
			insert(target, a, anchor);

			if (title_slot) {
				title_slot.m(a, null);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (title_slot) {
				if (title_slot.p && dirty & /*$$scope*/ 16) {
					update_slot(title_slot, title_slot_template, ctx, /*$$scope*/ ctx[4], dirty, get_title_slot_changes, get_title_slot_context);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(title_slot, local);
			current = true;
		},
		o(local) {
			transition_out(title_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(a);
			if (title_slot) title_slot.d(detaching);
		}
	};
}

// (25:4) <div class="x" slot="content">
function create_content_slot(ctx) {
	let div;
	let current;
	const content_slot_template = /*#slots*/ ctx[3].content;
	const content_slot = create_slot(content_slot_template, ctx, /*$$scope*/ ctx[4], get_content_slot_context$2);

	return {
		c() {
			div = element("div");
			if (content_slot) content_slot.c();
			attr(div, "class", "x svelte-k7ph6n");
			attr(div, "slot", "content");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			if (content_slot) {
				content_slot.m(div, null);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (content_slot) {
				if (content_slot.p && dirty & /*$$scope*/ 16) {
					update_slot(content_slot, content_slot_template, ctx, /*$$scope*/ ctx[4], dirty, get_content_slot_changes$2, get_content_slot_context$2);
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
			if (detaching) detach(div);
			if (content_slot) content_slot.d(detaching);
		}
	};
}

// (21:2) <AnchorContentCatcher close={hide}>
function create_default_slot(ctx) {
	let t;

	return {
		c() {
			t = space();
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

function create_fragment$7(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block$3, create_else_block];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*open*/ ctx[0]) return 0;
		return 1;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	return {
		c() {
			if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if_blocks[current_block_type_index].m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
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
				if_block.m(if_block_anchor.parentNode, if_block_anchor);
			}
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
			if_blocks[current_block_type_index].d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

function instance$7($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let open = false;

	function hide() {
		$$invalidate(0, open = false);
	}

	function show() {
		$$invalidate(0, open = true);
	}

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(4, $$scope = $$props.$$scope);
	};

	return [open, hide, show, slots, $$scope];
}

class Menue extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-k7ph6n-style")) add_css$3();
		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});
	}
}

/* src/components/TopNav.svelte generated by Svelte v3.29.4 */

function create_fragment$8(ctx) {
	let scrolling = false;

	let clear_scrolling = () => {
		scrolling = false;
	};

	let scrolling_timeout;
	let nav;
	let current;
	let mounted;
	let dispose;
	add_render_callback(/*onwindowscroll*/ ctx[6]);
	const default_slot_template = /*#slots*/ ctx[5].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[4], null);

	return {
		c() {
			nav = element("nav");
			if (default_slot) default_slot.c();
			attr(nav, "class", /*headerClass*/ ctx[0]);
		},
		m(target, anchor) {
			insert(target, nav, anchor);

			if (default_slot) {
				default_slot.m(nav, null);
			}

			current = true;

			if (!mounted) {
				dispose = listen(window, "scroll", () => {
					scrolling = true;
					clearTimeout(scrolling_timeout);
					scrolling_timeout = setTimeout(clear_scrolling, 100);
					/*onwindowscroll*/ ctx[6]();
				});

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*y*/ 2 && !scrolling) {
				scrolling = true;
				clearTimeout(scrolling_timeout);
				scrollTo(window.pageXOffset, /*y*/ ctx[1]);
				scrolling_timeout = setTimeout(clear_scrolling, 100);
			}

			if (default_slot) {
				if (default_slot.p && dirty & /*$$scope*/ 16) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[4], dirty, null, null);
				}
			}

			if (!current || dirty & /*headerClass*/ 1) {
				attr(nav, "class", /*headerClass*/ ctx[0]);
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
			if (detaching) detach(nav);
			if (default_slot) default_slot.d(detaching);
			mounted = false;
			dispose();
		}
	};
}

function instance$8($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let { offset = 0 } = $$props;
	let { tolerance = 0 } = $$props;
	let headerClass = "show";
	let y = 0;
	let lastY = 0;

	function deriveClass(y, dy) {
		if (y < offset) {
			return "show";
		}

		if (Math.abs(dy) <= tolerance) {
			return headerClass;
		}

		return dy < 0 ? "show" : "hide";
	}

	function updateClass(y) {
		const dy = lastY - y;
		lastY = y;
		return deriveClass(y, dy);
	}

	function onwindowscroll() {
		$$invalidate(1, y = window.pageYOffset);
	}

	$$self.$$set = $$props => {
		if ("offset" in $$props) $$invalidate(2, offset = $$props.offset);
		if ("tolerance" in $$props) $$invalidate(3, tolerance = $$props.tolerance);
		if ("$$scope" in $$props) $$invalidate(4, $$scope = $$props.$$scope);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*y*/ 2) {
			 $$invalidate(0, headerClass = updateClass(y));
		}
	};

	return [headerClass, y, offset, tolerance, $$scope, slots, onwindowscroll];
}

class TopNav extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$8, create_fragment$8, safe_not_equal, { offset: 2, tolerance: 3 });
	}
}

/* src/components/DataGrid.svelte generated by Svelte v3.29.4 */

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[5] = list[i];
	return child_ctx;
}

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[2] = list[i];
	return child_ctx;
}

function get_each_context_2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[5] = list[i];
	return child_ctx;
}

// (8:4) {#each columns as column}
function create_each_block_2(ctx) {
	let th;
	let t_value = (/*column*/ ctx[5].title || /*column*/ ctx[5].id) + "";
	let t;

	return {
		c() {
			th = element("th");
			t = text(t_value);
		},
		m(target, anchor) {
			insert(target, th, anchor);
			append(th, t);
		},
		p(ctx, dirty) {
			if (dirty & /*columns*/ 1 && t_value !== (t_value = (/*column*/ ctx[5].title || /*column*/ ctx[5].id) + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(th);
		}
	};
}

// (15:8) {#each columns as column}
function create_each_block_1(ctx) {
	let td;
	let t_value = /*entry*/ ctx[2][/*column*/ ctx[5].id] + "";
	let t;

	return {
		c() {
			td = element("td");
			t = text(t_value);
		},
		m(target, anchor) {
			insert(target, td, anchor);
			append(td, t);
		},
		p(ctx, dirty) {
			if (dirty & /*source, columns*/ 3 && t_value !== (t_value = /*entry*/ ctx[2][/*column*/ ctx[5].id] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(td);
		}
	};
}

// (13:4) {#each source.entries as entry}
function create_each_block(ctx) {
	let tr;
	let t;
	let each_value_1 = /*columns*/ ctx[0];
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	return {
		c() {
			tr = element("tr");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t = space();
		},
		m(target, anchor) {
			insert(target, tr, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(tr, null);
			}

			append(tr, t);
		},
		p(ctx, dirty) {
			if (dirty & /*source, columns*/ 3) {
				each_value_1 = /*columns*/ ctx[0];
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(tr, t);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_1.length;
			}
		},
		d(detaching) {
			if (detaching) detach(tr);
			destroy_each(each_blocks, detaching);
		}
	};
}

function create_fragment$9(ctx) {
	let table;
	let thead;
	let t;
	let tbody;
	let each_value_2 = /*columns*/ ctx[0];
	let each_blocks_1 = [];

	for (let i = 0; i < each_value_2.length; i += 1) {
		each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
	}

	let each_value = /*source*/ ctx[1].entries;
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			table = element("table");
			thead = element("thead");

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].c();
			}

			t = space();
			tbody = element("tbody");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}
		},
		m(target, anchor) {
			insert(target, table, anchor);
			append(table, thead);

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].m(thead, null);
			}

			append(table, t);
			append(table, tbody);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(tbody, null);
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*columns*/ 1) {
				each_value_2 = /*columns*/ ctx[0];
				let i;

				for (i = 0; i < each_value_2.length; i += 1) {
					const child_ctx = get_each_context_2(ctx, each_value_2, i);

					if (each_blocks_1[i]) {
						each_blocks_1[i].p(child_ctx, dirty);
					} else {
						each_blocks_1[i] = create_each_block_2(child_ctx);
						each_blocks_1[i].c();
						each_blocks_1[i].m(thead, null);
					}
				}

				for (; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].d(1);
				}

				each_blocks_1.length = each_value_2.length;
			}

			if (dirty & /*columns, source*/ 3) {
				each_value = /*source*/ ctx[1].entries;
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(tbody, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(table);
			destroy_each(each_blocks_1, detaching);
			destroy_each(each_blocks, detaching);
		}
	};
}

function instance$9($$self, $$props, $$invalidate) {
	let { columns = [] } = $$props;
	let { source = { entries: [] } } = $$props;

	$$self.$$set = $$props => {
		if ("columns" in $$props) $$invalidate(0, columns = $$props.columns);
		if ("source" in $$props) $$invalidate(1, source = $$props.source);
	};

	return [columns, source];
}

class DataGrid extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$9, create_fragment$9, safe_not_equal, { columns: 0, source: 1 });
	}
}

/* src/components/ServiceWorkerRegistrationDetails.svelte generated by Svelte v3.29.4 */

function create_default_slot_1(ctx) {
	let t;

	return {
		c() {
			t = text("Update");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (17:4) <ActionButton action={() => serviceWorkerRegistration.unregister()}>
function create_default_slot$1(ctx) {
	let t;

	return {
		c() {
			t = text("Unregister");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

function create_fragment$a(ctx) {
	let tr0;
	let td0;
	let t0;
	let td1;
	let t2;
	let td2;
	let t3_value = /*serviceWorkerRegistration*/ ctx[0].scope + "";
	let t3;
	let t4;
	let tr1;
	let td3;
	let t5;
	let td4;
	let actionbutton0;
	let t6;
	let actionbutton1;
	let current;

	actionbutton0 = new ActionButton({
			props: {
				action: /*func*/ ctx[1],
				$$slots: { default: [create_default_slot_1] },
				$$scope: { ctx }
			}
		});

	actionbutton1 = new ActionButton({
			props: {
				action: /*func_1*/ ctx[2],
				$$slots: { default: [create_default_slot$1] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			tr0 = element("tr");
			td0 = element("td");
			t0 = space();
			td1 = element("td");
			td1.textContent = "Scope";
			t2 = space();
			td2 = element("td");
			t3 = text(t3_value);
			t4 = space();
			tr1 = element("tr");
			td3 = element("td");
			t5 = space();
			td4 = element("td");
			create_component(actionbutton0.$$.fragment);
			t6 = space();
			create_component(actionbutton1.$$.fragment);
			attr(td2, "id", "serviceWorkerScope");
			attr(td4, "colspan", "2");
		},
		m(target, anchor) {
			insert(target, tr0, anchor);
			append(tr0, td0);
			append(tr0, t0);
			append(tr0, td1);
			append(tr0, t2);
			append(tr0, td2);
			append(td2, t3);
			insert(target, t4, anchor);
			insert(target, tr1, anchor);
			append(tr1, td3);
			append(tr1, t5);
			append(tr1, td4);
			mount_component(actionbutton0, td4, null);
			append(td4, t6);
			mount_component(actionbutton1, td4, null);
			current = true;
		},
		p(ctx, [dirty]) {
			if ((!current || dirty & /*serviceWorkerRegistration*/ 1) && t3_value !== (t3_value = /*serviceWorkerRegistration*/ ctx[0].scope + "")) set_data(t3, t3_value);
			const actionbutton0_changes = {};
			if (dirty & /*serviceWorkerRegistration*/ 1) actionbutton0_changes.action = /*func*/ ctx[1];

			if (dirty & /*$$scope*/ 8) {
				actionbutton0_changes.$$scope = { dirty, ctx };
			}

			actionbutton0.$set(actionbutton0_changes);
			const actionbutton1_changes = {};
			if (dirty & /*serviceWorkerRegistration*/ 1) actionbutton1_changes.action = /*func_1*/ ctx[2];

			if (dirty & /*$$scope*/ 8) {
				actionbutton1_changes.$$scope = { dirty, ctx };
			}

			actionbutton1.$set(actionbutton1_changes);
		},
		i(local) {
			if (current) return;
			transition_in(actionbutton0.$$.fragment, local);
			transition_in(actionbutton1.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(actionbutton0.$$.fragment, local);
			transition_out(actionbutton1.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(tr0);
			if (detaching) detach(t4);
			if (detaching) detach(tr1);
			destroy_component(actionbutton0);
			destroy_component(actionbutton1);
		}
	};
}

function instance$a($$self, $$props, $$invalidate) {
	let { serviceWorkerRegistration } = $$props;
	const func = () => serviceWorkerRegistration.update();
	const func_1 = () => serviceWorkerRegistration.unregister();

	$$self.$$set = $$props => {
		if ("serviceWorkerRegistration" in $$props) $$invalidate(0, serviceWorkerRegistration = $$props.serviceWorkerRegistration);
	};

	return [serviceWorkerRegistration, func, func_1];
}

class ServiceWorkerRegistrationDetails extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$a, create_fragment$a, safe_not_equal, { serviceWorkerRegistration: 0 });
	}
}

/* src/components/ServiceWorkerDetails.svelte generated by Svelte v3.29.4 */

function create_fragment$b(ctx) {
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

function instance$b($$self, $$props, $$invalidate) {
	let { serviceWorker } = $$props;

	$$self.$$set = $$props => {
		if ("serviceWorker" in $$props) $$invalidate(0, serviceWorker = $$props.serviceWorker);
	};

	return [serviceWorker];
}

class ServiceWorkerDetails extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$b, create_fragment$b, safe_not_equal, { serviceWorker: 0 });
	}
}

/* src/components/Duration.svelte generated by Svelte v3.29.4 */

function create_fragment$c(ctx) {
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

function instance$c($$self, $$props, $$invalidate) {
	let { seconds } = $$props;

	$$self.$$set = $$props => {
		if ("seconds" in $$props) $$invalidate(0, seconds = $$props.seconds);
	};

	return [seconds];
}

class Duration extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$c, create_fragment$c, safe_not_equal, { seconds: 0 });
	}
}

/* src/components/Bytes.svelte generated by Svelte v3.29.4 */

function create_fragment$d(ctx) {
	let span;
	let t_value = formatBytes(/*value*/ ctx[0]) + "";
	let t;

	return {
		c() {
			span = element("span");
			t = text(t_value);
		},
		m(target, anchor) {
			insert(target, span, anchor);
			append(span, t);
		},
		p(ctx, [dirty]) {
			if (dirty & /*value*/ 1 && t_value !== (t_value = formatBytes(/*value*/ ctx[0]) + "")) set_data(t, t_value);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(span);
		}
	};
}

function instance$d($$self, $$props, $$invalidate) {
	let { value } = $$props;

	$$self.$$set = $$props => {
		if ("value" in $$props) $$invalidate(0, value = $$props.value);
	};

	return [value];
}

class Bytes extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$d, create_fragment$d, safe_not_equal, { value: 0 });
	}
}

/* src/components/ServerDetails.svelte generated by Svelte v3.29.4 */

function create_else_block$1(ctx) {
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

function create_fragment$e(ctx) {
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
	let bytes0;
	let t14;
	let tr4;
	let td10;
	let t15;
	let td11;
	let t17;
	let td12;
	let bytes1;
	let t18;
	let tr5;
	let td13;
	let t19;
	let td14;
	let t21;
	let td15;
	let bytes2;
	let t22;
	let tr6;
	let td16;
	let t23;
	let td17;
	let t25;
	let td18;
	let bytes3;
	let current;
	const if_block_creators = [create_if_block$4, create_else_block$1];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*server*/ ctx[0].uptime >= 0) return 0;
		return 1;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	bytes0 = new Bytes({
			props: {
				value: /*server*/ ctx[0].memory.heapTotal
			}
		});

	bytes1 = new Bytes({
			props: { value: /*server*/ ctx[0].memory.heapUsed }
		});

	bytes2 = new Bytes({
			props: { value: /*server*/ ctx[0].memory.external }
		});

	bytes3 = new Bytes({
			props: { value: /*server*/ ctx[0].memory.rss }
		});

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
			create_component(bytes0.$$.fragment);
			t14 = space();
			tr4 = element("tr");
			td10 = element("td");
			t15 = space();
			td11 = element("td");
			td11.textContent = "Heap Used";
			t17 = space();
			td12 = element("td");
			create_component(bytes1.$$.fragment);
			t18 = space();
			tr5 = element("tr");
			td13 = element("td");
			t19 = space();
			td14 = element("td");
			td14.textContent = "External";
			t21 = space();
			td15 = element("td");
			create_component(bytes2.$$.fragment);
			t22 = space();
			tr6 = element("tr");
			td16 = element("td");
			t23 = space();
			td17 = element("td");
			td17.textContent = "RSS";
			t25 = space();
			td18 = element("td");
			create_component(bytes3.$$.fragment);
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
			mount_component(bytes0, td9, null);
			insert(target, t14, anchor);
			insert(target, tr4, anchor);
			append(tr4, td10);
			append(tr4, t15);
			append(tr4, td11);
			append(tr4, t17);
			append(tr4, td12);
			mount_component(bytes1, td12, null);
			insert(target, t18, anchor);
			insert(target, tr5, anchor);
			append(tr5, td13);
			append(tr5, t19);
			append(tr5, td14);
			append(tr5, t21);
			append(tr5, td15);
			mount_component(bytes2, td15, null);
			insert(target, t22, anchor);
			insert(target, tr6, anchor);
			append(tr6, td16);
			append(tr6, t23);
			append(tr6, td17);
			append(tr6, t25);
			append(tr6, td18);
			mount_component(bytes3, td18, null);
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

			const bytes0_changes = {};
			if (dirty & /*server*/ 1) bytes0_changes.value = /*server*/ ctx[0].memory.heapTotal;
			bytes0.$set(bytes0_changes);
			const bytes1_changes = {};
			if (dirty & /*server*/ 1) bytes1_changes.value = /*server*/ ctx[0].memory.heapUsed;
			bytes1.$set(bytes1_changes);
			const bytes2_changes = {};
			if (dirty & /*server*/ 1) bytes2_changes.value = /*server*/ ctx[0].memory.external;
			bytes2.$set(bytes2_changes);
			const bytes3_changes = {};
			if (dirty & /*server*/ 1) bytes3_changes.value = /*server*/ ctx[0].memory.rss;
			bytes3.$set(bytes3_changes);
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			transition_in(bytes0.$$.fragment, local);
			transition_in(bytes1.$$.fragment, local);
			transition_in(bytes2.$$.fragment, local);
			transition_in(bytes3.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			transition_out(bytes0.$$.fragment, local);
			transition_out(bytes1.$$.fragment, local);
			transition_out(bytes2.$$.fragment, local);
			transition_out(bytes3.$$.fragment, local);
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
			destroy_component(bytes0);
			if (detaching) detach(t14);
			if (detaching) detach(tr4);
			destroy_component(bytes1);
			if (detaching) detach(t18);
			if (detaching) detach(tr5);
			destroy_component(bytes2);
			if (detaching) detach(t22);
			if (detaching) detach(tr6);
			destroy_component(bytes3);
		}
	};
}

function instance$e($$self, $$props, $$invalidate) {
	let { server } = $$props;

	$$self.$$set = $$props => {
		if ("server" in $$props) $$invalidate(0, server = $$props.server);
	};

	return [server];
}

class ServerDetails extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$e, create_fragment$e, safe_not_equal, { server: 0 });
	}
}

/* src/components/DateTime.svelte generated by Svelte v3.29.4 */

function create_fragment$f(ctx) {
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

function instance$f($$self, $$props, $$invalidate) {
	let { date } = $$props;

	$$self.$$set = $$props => {
		if ("date" in $$props) $$invalidate(0, date = $$props.date);
	};

	return [date];
}

class DateTime extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$f, create_fragment$f, safe_not_equal, { date: 0 });
	}
}

/* src/components/SessionDetails.svelte generated by Svelte v3.29.4 */

function get_each_context$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[1] = list[i];
	return child_ctx;
}

// (26:4) {#each [...session.entitlements].sort() as name}
function create_each_block$1(ctx) {
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

function create_fragment$g(ctx) {
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
		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
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
					const child_ctx = get_each_context$1(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block$1(child_ctx);
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

function instance$g($$self, $$props, $$invalidate) {
	let { session } = $$props;

	$$self.$$set = $$props => {
		if ("session" in $$props) $$invalidate(0, session = $$props.session);
	};

	return [session];
}

class SessionDetails extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$g, create_fragment$g, safe_not_equal, { session: 0 });
	}
}

/* src/components/PeerDetails.svelte generated by Svelte v3.29.4 */

function get_each_context$2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[1] = list[i];
	return child_ctx;
}

// (10:4) {#each peers as peer}
function create_each_block$2(ctx) {
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

function create_fragment$h(ctx) {
	let tr;
	let td0;
	let t1;
	let td1;
	let current;
	let each_value = /*peers*/ ctx[0];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
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
					const child_ctx = get_each_context$2(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block$2(child_ctx);
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

function instance$h($$self, $$props, $$invalidate) {
	let { peers } = $$props;

	$$self.$$set = $$props => {
		if ("peers" in $$props) $$invalidate(0, peers = $$props.peers);
	};

	return [peers];
}

class PeerDetails extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$h, create_fragment$h, safe_not_equal, { peers: 0 });
	}
}

/* src/components/ApplicationDetails.svelte generated by Svelte v3.29.4 */

function create_fragment$i(ctx) {
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

function instance$i($$self, $$props, $$invalidate) {
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
		init(this, options, instance$i, create_fragment$i, safe_not_equal, { name: 0, version: 1, description: 2 });
	}
}

/* src/components/About.svelte generated by Svelte v3.29.4 */

function create_fragment$j(ctx) {
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
			attr(table, "class", "bordered striped");
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

function instance$j($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;

	$$self.$$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	return [$$scope, slots];
}

class About extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$j, create_fragment$j, safe_not_equal, {});
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

/* tests/app/src/App.svelte generated by Svelte v3.29.4 */

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

// (115:8) <div slot="content" class="dropdown-menu dropdown-menu-sw">
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

// (113:6) <Menue>
function create_default_slot_6(ctx) {
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

// (106:0) <TopNav offset={42}>
function create_default_slot_5(ctx) {
	let a0;
	let t1;
	let ul0;
	let t3;
	let ul1;
	let li1;
	let menue;
	let current;

	menue = new Menue({
			props: {
				$$slots: {
					default: [create_default_slot_6],
					content: [create_content_slot_1],
					title: [create_title_slot]
				},
				$$scope: { ctx }
			}
		});

	return {
		c() {
			a0 = element("a");
			a0.textContent = "Example";
			t1 = space();
			ul0 = element("ul");
			ul0.innerHTML = `<li><a href="/">Entry</a></li>`;
			t3 = space();
			ul1 = element("ul");
			li1 = element("li");
			create_component(menue.$$.fragment);
			attr(a0, "href", "/");
		},
		m(target, anchor) {
			insert(target, a0, anchor);
			insert(target, t1, anchor);
			insert(target, ul0, anchor);
			insert(target, t3, anchor);
			insert(target, ul1, anchor);
			append(ul1, li1);
			mount_component(menue, li1, null);
			current = true;
		},
		p(ctx, dirty) {
			const menue_changes = {};

			if (dirty & /*$$scope*/ 131072) {
				menue_changes.$$scope = { dirty, ctx };
			}

			menue.$set(menue_changes);
		},
		i(local) {
			if (current) return;
			transition_in(menue.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(menue.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(a0);
			if (detaching) detach(t1);
			if (detaching) detach(ul0);
			if (detaching) detach(t3);
			if (detaching) detach(ul1);
			destroy_component(menue);
		}
	};
}

// (129:2) <ActionButton {action}>
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

// (133:2) <ActionButton action={failingAction} error={e => alert(e)}>
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

// (139:4) <ul id="collapse-content" slot="content" in:fade out:fade>
function create_content_slot$1(ctx) {
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

// (137:2) <Collapse>
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

// (163:2) {#if modal}
function create_if_block_1$1(ctx) {
	let modal_1;
	let current;

	modal_1 = new Modal({
			props: {
				close: /*close*/ ctx[8],
				$$slots: { default: [create_default_slot_1$1] },
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

			if (dirty & /*$$scope*/ 131072) {
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

// (164:4) <Modal {close}>
function create_default_slot_1$1(ctx) {
	let form;

	return {
		c() {
			form = element("form");

			form.innerHTML = `<fieldset><label for="username">Username 1
            <input id="username" type="text" placeholder="Username" name="username" required="" value="XXX" size="10"/></label> 
          <label for="password">Password 1
            <input id="password" type="password" placeholder="Password" name="password" size="10" required=""/></label></fieldset> 

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

// (195:2) {#if about}
function create_if_block$5(ctx) {
	let about_1;
	let current;

	about_1 = new About({
			props: {
				$$slots: { default: [create_default_slot$2] },
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

			if (dirty & /*$$scope, $serviceWorkerRegistration, $serviceWorker, server*/ 131100) {
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

// (196:4) <About>
function create_default_slot$2(ctx) {
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
	let serviceworkerregistrationdetails;
	let t9;
	let peerdetails;
	let current;

	applicationdetails = new ApplicationDetails({
			props: {
				version: "1.0",
				name: "my title",
				description: "a description"
			}
		});

	sessiondetails = new SessionDetails({ props: { session: /*session*/ ctx[9] } });
	serverdetails = new ServerDetails({ props: { server: /*server*/ ctx[2] } });

	serviceworkerdetails = new ServiceWorkerDetails({
			props: { serviceWorker: /*$serviceWorker*/ ctx[3] }
		});

	serviceworkerregistrationdetails = new ServiceWorkerRegistrationDetails({
			props: {
				serviceWorkerRegistration: /*$serviceWorkerRegistration*/ ctx[4]
			}
		});

	peerdetails = new PeerDetails({ props: { peers: /*peers*/ ctx[10] } });

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
			create_component(serviceworkerregistrationdetails.$$.fragment);
			t9 = space();
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
			mount_component(serviceworkerregistrationdetails, target, anchor);
			insert(target, t9, anchor);
			mount_component(peerdetails, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const serverdetails_changes = {};
			if (dirty & /*server*/ 4) serverdetails_changes.server = /*server*/ ctx[2];
			serverdetails.$set(serverdetails_changes);
			const serviceworkerdetails_changes = {};
			if (dirty & /*$serviceWorker*/ 8) serviceworkerdetails_changes.serviceWorker = /*$serviceWorker*/ ctx[3];
			serviceworkerdetails.$set(serviceworkerdetails_changes);
			const serviceworkerregistrationdetails_changes = {};
			if (dirty & /*$serviceWorkerRegistration*/ 16) serviceworkerregistrationdetails_changes.serviceWorkerRegistration = /*$serviceWorkerRegistration*/ ctx[4];
			serviceworkerregistrationdetails.$set(serviceworkerregistrationdetails_changes);
		},
		i(local) {
			if (current) return;
			transition_in(applicationdetails.$$.fragment, local);
			transition_in(sessiondetails.$$.fragment, local);
			transition_in(serverdetails.$$.fragment, local);
			transition_in(serviceworkerdetails.$$.fragment, local);
			transition_in(serviceworkerregistrationdetails.$$.fragment, local);
			transition_in(peerdetails.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(applicationdetails.$$.fragment, local);
			transition_out(sessiondetails.$$.fragment, local);
			transition_out(serverdetails.$$.fragment, local);
			transition_out(serviceworkerdetails.$$.fragment, local);
			transition_out(serviceworkerregistrationdetails.$$.fragment, local);
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
			destroy_component(serviceworkerregistrationdetails, detaching);
			if (detaching) detach(t9);
			destroy_component(peerdetails, detaching);
		}
	};
}

function create_fragment$k(ctx) {
	let topnav;
	let t0;
	let main;
	let actionbutton0;
	let t1;
	let div0;
	let t2;
	let t3;
	let actionbutton1;
	let t4;
	let collapse;
	let t5;
	let div1;
	let t6;
	let duration0;
	let t7;
	let duration1;
	let t8;
	let datetime;
	let t9;
	let bytes0;
	let t10;
	let bytes1;
	let t11;
	let bytes2;
	let t12;
	let bytes3;
	let t13;
	let bytes4;
	let t14;
	let bytes5;
	let t15;
	let bytes6;
	let t16;
	let datagrid;
	let t17;
	let t18;
	let current;

	topnav = new TopNav({
			props: {
				offset: 42,
				$$slots: { default: [create_default_slot_5] },
				$$scope: { ctx }
			}
		});

	actionbutton0 = new ActionButton({
			props: {
				action: /*action*/ ctx[7],
				$$slots: { default: [create_default_slot_4] },
				$$scope: { ctx }
			}
		});

	actionbutton1 = new ActionButton({
			props: {
				action: failingAction,
				error: /*func*/ ctx[13],
				$$slots: { default: [create_default_slot_3] },
				$$scope: { ctx }
			}
		});

	collapse = new Collapse({
			props: {
				$$slots: {
					default: [create_default_slot_2],
					content: [create_content_slot$1]
				},
				$$scope: { ctx }
			}
		});

	duration0 = new Duration({ props: { seconds: "1000000" } });
	duration1 = new Duration({ props: { seconds: "5000" } });
	datetime = new DateTime({ props: { date: new Date() } });
	bytes0 = new Bytes({ props: { value: "10" } });
	bytes1 = new Bytes({ props: { value: "100" } });
	bytes2 = new Bytes({ props: { value: "1000" } });
	bytes3 = new Bytes({ props: { value: "10000" } });
	bytes4 = new Bytes({ props: { value: "100000" } });
	bytes5 = new Bytes({ props: { value: "1000000" } });
	bytes6 = new Bytes({ props: { value: "10000000" } });

	datagrid = new DataGrid({
			props: {
				columns: /*columns*/ ctx[5],
				source: /*source*/ ctx[6]
			}
		});

	let if_block0 = /*modal*/ ctx[1] && create_if_block_1$1(ctx);
	let if_block1 =  create_if_block$5(ctx);

	return {
		c() {
			create_component(topnav.$$.fragment);
			t0 = space();
			main = element("main");
			create_component(actionbutton0.$$.fragment);
			t1 = space();
			div0 = element("div");
			t2 = text(/*actionExecuted*/ ctx[0]);
			t3 = space();
			create_component(actionbutton1.$$.fragment);
			t4 = space();
			create_component(collapse.$$.fragment);
			t5 = space();
			div1 = element("div");
			t6 = text("Days\n    ");
			create_component(duration0.$$.fragment);
			t7 = text("\n    Hours\n    ");
			create_component(duration1.$$.fragment);
			t8 = space();
			create_component(datetime.$$.fragment);
			t9 = space();
			create_component(bytes0.$$.fragment);
			t10 = space();
			create_component(bytes1.$$.fragment);
			t11 = space();
			create_component(bytes2.$$.fragment);
			t12 = space();
			create_component(bytes3.$$.fragment);
			t13 = space();
			create_component(bytes4.$$.fragment);
			t14 = space();
			create_component(bytes5.$$.fragment);
			t15 = space();
			create_component(bytes6.$$.fragment);
			t16 = space();
			create_component(datagrid.$$.fragment);
			t17 = space();
			if (if_block0) if_block0.c();
			t18 = space();
			if (if_block1) if_block1.c();
			attr(div0, "id", "actionExecuted");
		},
		m(target, anchor) {
			mount_component(topnav, target, anchor);
			insert(target, t0, anchor);
			insert(target, main, anchor);
			mount_component(actionbutton0, main, null);
			append(main, t1);
			append(main, div0);
			append(div0, t2);
			append(main, t3);
			mount_component(actionbutton1, main, null);
			append(main, t4);
			mount_component(collapse, main, null);
			append(main, t5);
			append(main, div1);
			append(div1, t6);
			mount_component(duration0, div1, null);
			append(div1, t7);
			mount_component(duration1, div1, null);
			append(div1, t8);
			mount_component(datetime, div1, null);
			append(main, t9);
			mount_component(bytes0, main, null);
			append(main, t10);
			mount_component(bytes1, main, null);
			append(main, t11);
			mount_component(bytes2, main, null);
			append(main, t12);
			mount_component(bytes3, main, null);
			append(main, t13);
			mount_component(bytes4, main, null);
			append(main, t14);
			mount_component(bytes5, main, null);
			append(main, t15);
			mount_component(bytes6, main, null);
			append(main, t16);
			mount_component(datagrid, main, null);
			append(main, t17);
			if (if_block0) if_block0.m(main, null);
			append(main, t18);
			if (if_block1) if_block1.m(main, null);
			current = true;
		},
		p(ctx, [dirty]) {
			const topnav_changes = {};

			if (dirty & /*$$scope*/ 131072) {
				topnav_changes.$$scope = { dirty, ctx };
			}

			topnav.$set(topnav_changes);
			const actionbutton0_changes = {};

			if (dirty & /*$$scope*/ 131072) {
				actionbutton0_changes.$$scope = { dirty, ctx };
			}

			actionbutton0.$set(actionbutton0_changes);
			if (!current || dirty & /*actionExecuted*/ 1) set_data(t2, /*actionExecuted*/ ctx[0]);
			const actionbutton1_changes = {};

			if (dirty & /*$$scope*/ 131072) {
				actionbutton1_changes.$$scope = { dirty, ctx };
			}

			actionbutton1.$set(actionbutton1_changes);
			const collapse_changes = {};

			if (dirty & /*$$scope*/ 131072) {
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
					if_block0.m(main, t18);
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
			transition_in(topnav.$$.fragment, local);
			transition_in(actionbutton0.$$.fragment, local);
			transition_in(actionbutton1.$$.fragment, local);
			transition_in(collapse.$$.fragment, local);
			transition_in(duration0.$$.fragment, local);
			transition_in(duration1.$$.fragment, local);
			transition_in(datetime.$$.fragment, local);
			transition_in(bytes0.$$.fragment, local);
			transition_in(bytes1.$$.fragment, local);
			transition_in(bytes2.$$.fragment, local);
			transition_in(bytes3.$$.fragment, local);
			transition_in(bytes4.$$.fragment, local);
			transition_in(bytes5.$$.fragment, local);
			transition_in(bytes6.$$.fragment, local);
			transition_in(datagrid.$$.fragment, local);
			transition_in(if_block0);
			transition_in(if_block1);
			current = true;
		},
		o(local) {
			transition_out(topnav.$$.fragment, local);
			transition_out(actionbutton0.$$.fragment, local);
			transition_out(actionbutton1.$$.fragment, local);
			transition_out(collapse.$$.fragment, local);
			transition_out(duration0.$$.fragment, local);
			transition_out(duration1.$$.fragment, local);
			transition_out(datetime.$$.fragment, local);
			transition_out(bytes0.$$.fragment, local);
			transition_out(bytes1.$$.fragment, local);
			transition_out(bytes2.$$.fragment, local);
			transition_out(bytes3.$$.fragment, local);
			transition_out(bytes4.$$.fragment, local);
			transition_out(bytes5.$$.fragment, local);
			transition_out(bytes6.$$.fragment, local);
			transition_out(datagrid.$$.fragment, local);
			transition_out(if_block0);
			transition_out(if_block1);
			current = false;
		},
		d(detaching) {
			destroy_component(topnav, detaching);
			if (detaching) detach(t0);
			if (detaching) detach(main);
			destroy_component(actionbutton0);
			destroy_component(actionbutton1);
			destroy_component(collapse);
			destroy_component(duration0);
			destroy_component(duration1);
			destroy_component(datetime);
			destroy_component(bytes0);
			destroy_component(bytes1);
			destroy_component(bytes2);
			destroy_component(bytes3);
			destroy_component(bytes4);
			destroy_component(bytes5);
			destroy_component(bytes6);
			destroy_component(datagrid);
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

function instance$k($$self, $$props, $$invalidate) {
	let $serviceWorker;
	let $serviceWorkerRegistration;
	const columns = [{ id: "col1" }, { id: "col2", title: "Title for col2" }];

	const source = {
		entries: [{ col1: "a1", col2: "b1" }, { col1: "a2", col2: "b2" }]
	};

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
	const to = { host: "1.2.3.4", port: 1234 };
	const referrer = { host: "1.2.3.4", port: 1235 };

	const peers = [
		{ host: "somewhere", port: 33 },
		{ host: "somewhere2", port: 33, to },
		{
			host: "somewhere3",
			port: 33,
			to,
			referrer
		}
	];

	const serviceWorker = readable({ state: "up", scriptURL: "somewhere.mjs" }, set => {
		return () => {
			
		};
	});

	component_subscribe($$self, serviceWorker, value => $$invalidate(3, $serviceWorker = value));

	const serviceWorkerRegistration = readable(
		{
			scope: "http://localhost:5000/components/svelte-common/tests/app/"
		},
		set => {
			return () => {
				
			};
		}
	);

	component_subscribe($$self, serviceWorkerRegistration, value => $$invalidate(4, $serviceWorkerRegistration = value));
	const func = e => alert(e);

	return [
		actionExecuted,
		modal,
		server,
		$serviceWorker,
		$serviceWorkerRegistration,
		columns,
		source,
		action,
		close,
		session,
		peers,
		serviceWorker,
		serviceWorkerRegistration,
		func
	];
}

class App extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$k, create_fragment$k, safe_not_equal, {});
	}
}

var index = new App({
  target: document.body
});

export default index;
//# sourceMappingURL=bundle.main.mjs.map
