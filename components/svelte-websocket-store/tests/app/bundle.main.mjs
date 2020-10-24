function noop() { }
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
function set_store_value(store, ret, value = ret) {
    store.set(value);
    return ret;
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
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
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
function set_input_value(input, value) {
    input.value = value == null ? '' : value;
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
const outroing = new Set();
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
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

const reopenTimeouts = [2000, 5000, 10000, 30000, 60000];

/**
 * Create a writable store based on a web-socket.
 * Data is transferred as JSON.
 * Keeps socket open (reopens if closed) as long as there are subscriptions.
 * @param {string} url the WebSocket url
 * @param {any} initialValue store value used befor 1st. response from server is present
 * @param {string[]} socketOptions transparently passed to the WebSocket constructor
 * @return {Store}
 */
function websocketStore(url, initialValue, socketOptions) {
  let socket;
  let reopenCount = 0;
  const subscriptions = new Set();
  let reopenTimeoutHandler;

  function reopenTimeout() {
    const n = reopenCount;
    reopenCount++;
    return reopenTimeouts[
      n >= reopenTimeouts.length - 1 ? reopenTimeouts.length - 1 : n
    ];
  }

  function close() {
    if (reopenTimeoutHandler) {
      clearTimeout(reopenTimeoutHandler);
    }

    if (socket) {
      socket.close();
      socket = undefined;
    }
  }

  function reopen() {
    close();
    if (subscriptions.size > 0) {
      reopenTimeoutHandler = setTimeout(() => open(), reopenTimeout());
    }
  }

  async function open() {
    if (reopenTimeoutHandler) {
      clearTimeout(reopenTimeoutHandler);
      reopenTimeoutHandler = undefined;
    }

    if (socket) {
      return;
    }

    socket = new WebSocket(url, socketOptions);

    socket.onmessage = event => {
      initialValue = JSON.parse(event.data);
      subscriptions.forEach(subscription => subscription(initialValue));
    };

    socket.onclose = event => reopen();

    return new Promise((resolve, reject) => {
      socket.onopen = event => {
        reopenCount = 0;
        resolve();
      };
    });
  }

  return {
    set(value) {
      open().then(() => socket.send(JSON.stringify(value)));
    },
    subscribe(subscription) {
      open();
      subscription(initialValue);
      subscriptions.add(subscription);
      return () => {
        subscriptions.delete(subscription);
        if (subscriptions.size === 0) {
          close();
        }
      };
    }
  };
}

/* tests/app/src/App.svelte generated by Svelte v3.29.4 */

function create_fragment(ctx) {
	let input0;
	let t0;
	let input1;
	let t1;
	let button0;
	let t2;
	let t3_value = (/*isTimerRunning*/ ctx[2] ? "Off" : "On") + "";
	let t3;
	let t4;
	let button1;
	let mounted;
	let dispose;

	return {
		c() {
			input0 = element("input");
			t0 = space();
			input1 = element("input");
			t1 = space();
			button0 = element("button");
			t2 = text("Server Timer ");
			t3 = text(t3_value);
			t4 = space();
			button1 = element("button");
			button1.textContent = "Server Disconnect";
			attr(input0, "id", "input1");
			attr(input0, "placeholder", "publish value");
			attr(input1, "id", "input2");
			attr(input1, "placeholder", "back from server");
		},
		m(target, anchor) {
			insert(target, input0, anchor);
			set_input_value(input0, /*$socket1*/ ctx[3]);
			insert(target, t0, anchor);
			insert(target, input1, anchor);
			set_input_value(input1, /*$socket2*/ ctx[4]);
			insert(target, t1, anchor);
			insert(target, button0, anchor);
			append(button0, t2);
			append(button0, t3);
			insert(target, t4, anchor);
			insert(target, button1, anchor);

			if (!mounted) {
				dispose = [
					listen(input0, "input", /*input0_input_handler*/ ctx[7]),
					listen(input1, "input", /*input1_input_handler*/ ctx[8]),
					listen(button0, "click", /*timer*/ ctx[5]),
					listen(button1, "click", /*disconnect*/ ctx[6])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*$socket1*/ 8 && input0.value !== /*$socket1*/ ctx[3]) {
				set_input_value(input0, /*$socket1*/ ctx[3]);
			}

			if (dirty & /*$socket2*/ 16 && input1.value !== /*$socket2*/ ctx[4]) {
				set_input_value(input1, /*$socket2*/ ctx[4]);
			}

			if (dirty & /*isTimerRunning*/ 4 && t3_value !== (t3_value = (/*isTimerRunning*/ ctx[2] ? "Off" : "On") + "")) set_data(t3, t3_value);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(input0);
			if (detaching) detach(t0);
			if (detaching) detach(input1);
			if (detaching) detach(t1);
			if (detaching) detach(button0);
			if (detaching) detach(t4);
			if (detaching) detach(button1);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let $socket1,
		$$unsubscribe_socket1 = noop,
		$$subscribe_socket1 = () => ($$unsubscribe_socket1(), $$unsubscribe_socket1 = subscribe(socket1, $$value => $$invalidate(3, $socket1 = $$value)), socket1);

	let $socket2,
		$$unsubscribe_socket2 = noop,
		$$subscribe_socket2 = () => ($$unsubscribe_socket2(), $$unsubscribe_socket2 = subscribe(socket2, $$value => $$invalidate(4, $socket2 = $$value)), socket2);

	$$self.$$.on_destroy.push(() => $$unsubscribe_socket1());
	$$self.$$.on_destroy.push(() => $$unsubscribe_socket2());
	const socket1 = websocketStore("ws://localhost:5001");
	$$subscribe_socket1();
	const socket2 = websocketStore("ws://localhost:5001");
	$$subscribe_socket2();
	let isTimerRunning = false;

	function timer() {
		set_store_value(socket1, $socket1 = isTimerRunning ? "timer(off)" : "timer(on)", $socket1);
		$$invalidate(2, isTimerRunning = !isTimerRunning);
	}

	function disconnect() {
		set_store_value(socket1, $socket1 = "disconnect(2000)", $socket1);
	}

	function input0_input_handler() {
		$socket1 = this.value;
		socket1.set($socket1);
	}

	function input1_input_handler() {
		$socket2 = this.value;
		socket2.set($socket2);
	}

	return [
		socket1,
		socket2,
		isTimerRunning,
		$socket1,
		$socket2,
		timer,
		disconnect,
		input0_input_handler,
		input1_input_handler
	];
}

class App extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { socket1: 0, socket2: 1 });
	}

	get socket1() {
		return this.$$.ctx[0];
	}

	get socket2() {
		return this.$$.ctx[1];
	}
}

var index = new App({
  target: document.body
});

export default index;
//# sourceMappingURL=bundle.main.mjs.map
