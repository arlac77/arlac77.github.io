function noop() { }
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
function set_custom_element_data(node, prop, value) {
    if (prop in node) {
        node[prop] = value;
    }
    else {
        attr(node, prop, value);
    }
}
function children(element) {
    return Array.from(element.childNodes);
}
function set_data(text, data) {
    data = '' + data;
    if (text.wholeText !== data)
        text.data = data;
}
function set_style(node, key, value, important) {
    node.style.setProperty(key, value, important ? 'important' : '');
}
// unfortunately this can't be a constant as that wouldn't be tree-shakeable
// so we cache the result instead
let crossorigin;
function is_crossorigin() {
    if (crossorigin === undefined) {
        crossorigin = false;
        try {
            if (typeof window !== 'undefined' && window.parent) {
                void window.parent.document;
            }
        }
        catch (error) {
            crossorigin = true;
        }
    }
    return crossorigin;
}
function add_resize_listener(node, fn) {
    const computed_style = getComputedStyle(node);
    const z_index = (parseInt(computed_style.zIndex) || 0) - 1;
    if (computed_style.position === 'static') {
        node.style.position = 'relative';
    }
    const iframe = element('iframe');
    iframe.setAttribute('style', `display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; ` +
        `overflow: hidden; border: 0; opacity: 0; pointer-events: none; z-index: ${z_index};`);
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    const crossorigin = is_crossorigin();
    let unsubscribe;
    if (crossorigin) {
        iframe.src = `data:text/html,<script>onresize=function(){parent.postMessage(0,'*')}</script>`;
        unsubscribe = listen(window, 'message', (event) => {
            if (event.source === iframe.contentWindow)
                fn();
        });
    }
    else {
        iframe.src = 'about:blank';
        iframe.onload = () => {
            unsubscribe = listen(iframe.contentWindow, 'resize', fn);
        };
    }
    append(node, iframe);
    return () => {
        if (crossorigin) {
            unsubscribe();
        }
        else if (unsubscribe && iframe.contentWindow) {
            unsubscribe();
        }
        detach(iframe);
    };
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error(`Function called outside component initialization`);
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
function add_flush_callback(fn) {
    flush_callbacks.push(fn);
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
function outro_and_destroy_block(block, lookup) {
    transition_out(block, 1, 1, () => {
        lookup.delete(block.key);
    });
}
function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
    let o = old_blocks.length;
    let n = list.length;
    let i = o;
    const old_indexes = {};
    while (i--)
        old_indexes[old_blocks[i].key] = i;
    const new_blocks = [];
    const new_lookup = new Map();
    const deltas = new Map();
    i = n;
    while (i--) {
        const child_ctx = get_context(ctx, list, i);
        const key = get_key(child_ctx);
        let block = lookup.get(key);
        if (!block) {
            block = create_each_block(key, child_ctx);
            block.c();
        }
        else if (dynamic) {
            block.p(child_ctx, dirty);
        }
        new_lookup.set(key, new_blocks[i] = block);
        if (key in old_indexes)
            deltas.set(key, Math.abs(i - old_indexes[key]));
    }
    const will_move = new Set();
    const did_move = new Set();
    function insert(block) {
        transition_in(block, 1);
        block.m(node, next);
        lookup.set(block.key, block);
        next = block.first;
        n--;
    }
    while (o && n) {
        const new_block = new_blocks[n - 1];
        const old_block = old_blocks[o - 1];
        const new_key = new_block.key;
        const old_key = old_block.key;
        if (new_block === old_block) {
            // do nothing
            next = new_block.first;
            o--;
            n--;
        }
        else if (!new_lookup.has(old_key)) {
            // remove old block
            destroy(old_block, lookup);
            o--;
        }
        else if (!lookup.has(new_key) || will_move.has(new_key)) {
            insert(new_block);
        }
        else if (did_move.has(old_key)) {
            o--;
        }
        else if (deltas.get(new_key) > deltas.get(old_key)) {
            did_move.add(new_key);
            insert(new_block);
        }
        else {
            will_move.add(old_key);
            o--;
        }
    }
    while (o--) {
        const old_block = old_blocks[o];
        if (!new_lookup.has(old_block.key))
            destroy(old_block, lookup);
    }
    while (n)
        insert(new_blocks[n - 1]);
    return new_blocks;
}

function bind(component, name, callback) {
    const index = component.$$.props[name];
    if (index !== undefined) {
        component.$$.bound[index] = callback;
        callback(component.$$.ctx[index]);
    }
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

/**
 * Produces lines from a reader
 * @param {Reader} reader
 * @param {TextDecoder} decoder
 * @return {AsyncIterator<string>} lines
 */
async function* lineIterator(reader, decoder = new TextDecoder()) {
  let { value, done } = await reader.read();

  if (done) {
    return;
  }

  value = value ? decoder.decode(value) : "";

  const re = /\n|\r\n/gm;
  let startIndex = 0;

  for (;;) {
    const result = re.exec(value);
    if (!result) {
      if (done) {
        break;
      }
      const remainder = value.substr(startIndex);
      ({ value, done } = await reader.read());

      if (value) {
        value = remainder + decoder.decode(value);
      } else {
        value = remainder;
      }
      startIndex = re.lastIndex = 0;
      continue;
    }
    yield value.substring(startIndex, result.index);
    startIndex = re.lastIndex;
  }
  if (startIndex < value.length) {
    yield value.substr(startIndex);
  }
}

/* src/LogView.svelte generated by Svelte v3.26.0 */

function add_css() {
	var style = element("style");
	style.id = "svelte-1g83plk-style";
	style.textContent = "log-viewport.svelte-1g83plk{position:relative;overflow-y:auto;display:block}log-contents.svelte-1g83plk,log-row.svelte-1g83plk{display:block}log-row.svelte-1g83plk{overflow:hidden}";
	append(document.head, style);
}

const get_default_slot_changes = dirty => ({ entry: dirty & /*visible*/ 1 });
const get_default_slot_context = ctx => ({ entry: /*entry*/ ctx[19] });

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[19] = list[i];
	child_ctx[21] = i;
	return child_ctx;
}

// (106:4) {#each visible as entry, i (i)}
function create_each_block(key_1, ctx) {
	let log_row;
	let t;
	let current;
	const default_slot_template = /*#slots*/ ctx[13].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[12], get_default_slot_context);

	return {
		key: key_1,
		first: null,
		c() {
			log_row = element("log-row");
			if (default_slot) default_slot.c();
			t = space();
			set_custom_element_data(log_row, "class", "svelte-1g83plk");
			this.first = log_row;
		},
		m(target, anchor) {
			insert(target, log_row, anchor);

			if (default_slot) {
				default_slot.m(log_row, null);
			}

			append(log_row, t);
			current = true;
		},
		p(ctx, dirty) {
			if (default_slot) {
				if (default_slot.p && dirty & /*$$scope, visible*/ 4097) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[12], dirty, get_default_slot_changes, get_default_slot_context);
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
			if (detaching) detach(log_row);
			if (default_slot) default_slot.d(detaching);
		}
	};
}

function create_fragment(ctx) {
	let log_viewport;
	let log_contents;
	let each_blocks = [];
	let each_1_lookup = new Map();
	let log_viewport_resize_listener;
	let current;
	let mounted;
	let dispose;
	let each_value = /*visible*/ ctx[0];
	const get_key = ctx => /*i*/ ctx[21];

	for (let i = 0; i < each_value.length; i += 1) {
		let child_ctx = get_each_context(ctx, each_value, i);
		let key = get_key(child_ctx);
		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
	}

	return {
		c() {
			log_viewport = element("log-viewport");
			log_contents = element("log-contents");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			set_custom_element_data(log_contents, "class", "svelte-1g83plk");
			set_style(log_viewport, "height", /*height*/ ctx[1]);
			set_custom_element_data(log_viewport, "class", "svelte-1g83plk");
			add_render_callback(() => /*log_viewport_elementresize_handler*/ ctx[16].call(log_viewport));
		},
		m(target, anchor) {
			insert(target, log_viewport, anchor);
			append(log_viewport, log_contents);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(log_contents, null);
			}

			/*log_contents_binding*/ ctx[14](log_contents);
			/*log_viewport_binding*/ ctx[15](log_viewport);
			log_viewport_resize_listener = add_resize_listener(log_viewport, /*log_viewport_elementresize_handler*/ ctx[16].bind(log_viewport));
			current = true;

			if (!mounted) {
				dispose = [
					listen(window, "keydown", /*handleKeydown*/ ctx[6]),
					listen(log_viewport, "scroll", /*handleScroll*/ ctx[5])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*$$scope, visible*/ 4097) {
				const each_value = /*visible*/ ctx[0];
				group_outros();
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, log_contents, outro_and_destroy_block, create_each_block, null, get_each_context);
				check_outros();
			}

			if (!current || dirty & /*height*/ 2) {
				set_style(log_viewport, "height", /*height*/ ctx[1]);
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
			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(log_viewport);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].d();
			}

			/*log_contents_binding*/ ctx[14](null);
			/*log_viewport_binding*/ ctx[15](null);
			log_viewport_resize_listener();
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let { source } = $$props;
	let { start = 0 } = $$props;
	let { height = "100%" } = $$props;
	let { visibleRows = 1000000 } = $$props;
	let { entries = [] } = $$props;
	let { visible = entries } = $$props;
	let { follow = true } = $$props;
	let viewport;
	let contents;
	let rows;
	let viewportHeight = 0;

	onMount(async () => {
		rows = contents.getElementsByTagName("log-row");

		for await (const entry of source()) {
			entries.push(entry);

			if (entries.length <= visibleRows) {
				$$invalidate(0, visible = entries);
			} else if (follow) {
				$$invalidate(7, start++, start);
				$$invalidate(0, visible = entries.slice(start));
			}
		}
	});

	async function refresh(firstLine) {
		if (firstLine > entries.length - visibleRows) {
			firstLine = entries.length - visibleRows;
		}

		if (firstLine < 0) {
			for await (const entry of source(entries[0], -1)) {
				entries.splice(0, 0, entry);

				if (firstLine++ === 0) {
					break;
				}
			}

			firstLine = 0;
		}

		$$invalidate(7, start = firstLine);
		$$invalidate(0, visible = entries.slice(start, start + visibleRows));
	}

	async function handleScroll() {
		const { scrollTop } = viewport;
		console.log("handleScroll", scrollTop, start, entries.length, rows.length);
	}

	function handleKeydown(event) {
		switch (event.key) {
			case "ArrowUp":
				refresh(start - 1);
				break;
			case "ArrowDown":
				refresh(start + 1);
				break;
			case "PageUp":
				refresh(start - visibleRows);
				break;
			case "PageDown":
				refresh(start + visibleRows);
				break;
			case "G":
				refresh(entries.length - visibleRows);
				break;
			case "g":
				refresh(0);
				break;
			case "f":
				$$invalidate(8, follow = !follow);
				break;
		}
	}

	function log_contents_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			contents = $$value;
			$$invalidate(3, contents);
		});
	}

	function log_viewport_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			viewport = $$value;
			$$invalidate(2, viewport);
		});
	}

	function log_viewport_elementresize_handler() {
		viewportHeight = this.offsetHeight;
		$$invalidate(4, viewportHeight);
	}

	$$self.$$set = $$props => {
		if ("source" in $$props) $$invalidate(9, source = $$props.source);
		if ("start" in $$props) $$invalidate(7, start = $$props.start);
		if ("height" in $$props) $$invalidate(1, height = $$props.height);
		if ("visibleRows" in $$props) $$invalidate(10, visibleRows = $$props.visibleRows);
		if ("entries" in $$props) $$invalidate(11, entries = $$props.entries);
		if ("visible" in $$props) $$invalidate(0, visible = $$props.visible);
		if ("follow" in $$props) $$invalidate(8, follow = $$props.follow);
		if ("$$scope" in $$props) $$invalidate(12, $$scope = $$props.$$scope);
	};

	return [
		visible,
		height,
		viewport,
		contents,
		viewportHeight,
		handleScroll,
		handleKeydown,
		start,
		follow,
		source,
		visibleRows,
		entries,
		$$scope,
		slots,
		log_contents_binding,
		log_viewport_binding,
		log_viewport_elementresize_handler
	];
}

class LogView extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-1g83plk-style")) add_css();

		init(this, options, instance, create_fragment, safe_not_equal, {
			source: 9,
			start: 7,
			height: 1,
			visibleRows: 10,
			entries: 11,
			visible: 0,
			follow: 8
		});
	}
}

/* tests/app/src/App.svelte generated by Svelte v3.26.0 */

function add_css$1() {
	var style = element("style");
	style.id = "svelte-19sqqwv-style";
	style.textContent = "#log.svelte-19sqqwv{max-height:200px;height:200px}";
	append(document.head, style);
}

// (23:2) <LogView visibleRows={10} {source} let:entry bind:follow bind:start>
function create_default_slot(ctx) {
	let t_value = /*entry*/ ctx[5] + "";
	let t;

	return {
		c() {
			t = text(t_value);
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*entry*/ 32 && t_value !== (t_value = /*entry*/ ctx[5] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

function create_fragment$1(ctx) {
	let div;
	let logview;
	let updating_follow;
	let updating_start;
	let t0;
	let p0;
	let t1;
	let t2;
	let p1;
	let t3_value = (/*follow*/ ctx[1] ? "F" : "-") + "";
	let t3;
	let current;

	function logview_follow_binding(value) {
		/*logview_follow_binding*/ ctx[3].call(null, value);
	}

	function logview_start_binding(value) {
		/*logview_start_binding*/ ctx[4].call(null, value);
	}

	let logview_props = {
		visibleRows: 10,
		source: /*source*/ ctx[2],
		$$slots: {
			default: [
				create_default_slot,
				({ entry }) => ({ 5: entry }),
				({ entry }) => entry ? 32 : 0
			]
		},
		$$scope: { ctx }
	};

	if (/*follow*/ ctx[1] !== void 0) {
		logview_props.follow = /*follow*/ ctx[1];
	}

	if (/*start*/ ctx[0] !== void 0) {
		logview_props.start = /*start*/ ctx[0];
	}

	logview = new LogView({ props: logview_props });
	binding_callbacks.push(() => bind(logview, "follow", logview_follow_binding));
	binding_callbacks.push(() => bind(logview, "start", logview_start_binding));

	return {
		c() {
			div = element("div");
			create_component(logview.$$.fragment);
			t0 = space();
			p0 = element("p");
			t1 = text(/*start*/ ctx[0]);
			t2 = space();
			p1 = element("p");
			t3 = text(t3_value);
			attr(div, "id", "log");
			attr(div, "class", "svelte-19sqqwv");
			attr(p0, "id", "start");
			attr(p1, "id", "follow");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			mount_component(logview, div, null);
			insert(target, t0, anchor);
			insert(target, p0, anchor);
			append(p0, t1);
			insert(target, t2, anchor);
			insert(target, p1, anchor);
			append(p1, t3);
			current = true;
		},
		p(ctx, [dirty]) {
			const logview_changes = {};

			if (dirty & /*$$scope, entry*/ 96) {
				logview_changes.$$scope = { dirty, ctx };
			}

			if (!updating_follow && dirty & /*follow*/ 2) {
				updating_follow = true;
				logview_changes.follow = /*follow*/ ctx[1];
				add_flush_callback(() => updating_follow = false);
			}

			if (!updating_start && dirty & /*start*/ 1) {
				updating_start = true;
				logview_changes.start = /*start*/ ctx[0];
				add_flush_callback(() => updating_start = false);
			}

			logview.$set(logview_changes);
			if (!current || dirty & /*start*/ 1) set_data(t1, /*start*/ ctx[0]);
			if ((!current || dirty & /*follow*/ 2) && t3_value !== (t3_value = (/*follow*/ ctx[1] ? "F" : "-") + "")) set_data(t3, t3_value);
		},
		i(local) {
			if (current) return;
			transition_in(logview.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(logview.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			destroy_component(logview);
			if (detaching) detach(t0);
			if (detaching) detach(p0);
			if (detaching) detach(t2);
			if (detaching) detach(p1);
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	async function* source(cursor, number) {
		//if(cursor) { query = `?cursor=` + cursor.substring(5); }
		const response = await fetch(number < 0 ? "/api/back/log" : "/api/log");

		yield* lineIterator(response.body.getReader());
	}

	let start = 0;
	let follow = true;

	function logview_follow_binding(value) {
		follow = value;
		$$invalidate(1, follow);
	}

	function logview_start_binding(value) {
		start = value;
		$$invalidate(0, start);
	}

	return [start, follow, source, logview_follow_binding, logview_start_binding];
}

class App extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-19sqqwv-style")) add_css$1();
		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});
	}
}

var index = new App({
  target: document.body
});

export default index;
//# sourceMappingURL=bundle.main.mjs.map
