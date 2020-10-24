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
function null_to_empty(value) {
    return value == null ? '' : value;
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
function onDestroy(fn) {
    get_current_component().$$.on_destroy.push(fn);
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
 * Extracts lines from a reader and delivers them as an async iterator
 * @param {Reader} reader
 * @return {AsyncIterator<string>} lines
 */
async function* lineIterator(reader) {
  let { value, done } = await reader.read();

  if (done) {
    return;
  }

  const decoder = new TextDecoder();

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

/* src/LogView.svelte generated by Svelte v3.29.4 */

function add_css() {
	var style = element("style");
	style.id = "svelte-14ki3p6-style";
	style.textContent = "log-contents.svelte-14ki3p6{position:relative;overflow-y:auto;display:block}log-row.svelte-14ki3p6{display:block;overflow:hidden}";
	append(document.head, style);
}

const get_default_slot_changes = dirty => ({
	entry: dirty & /*visible*/ 1,
	selected: dirty & /*selected*/ 2,
	position: dirty & /*start, visible*/ 5
});

const get_default_slot_context = ctx => ({
	entry: /*entry*/ ctx[16],
	selected: /*selected*/ ctx[1],
	position: /*start*/ ctx[2] + /*i*/ ctx[18]
});

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[16] = list[i];
	child_ctx[18] = i;
	return child_ctx;
}

// (151:2) {#each visible as entry, i (i)}
function create_each_block(key_1, ctx) {
	let log_row;
	let t;
	let current;
	const default_slot_template = /*#slots*/ ctx[10].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[9], get_default_slot_context);

	return {
		key: key_1,
		first: null,
		c() {
			log_row = element("log-row");
			if (default_slot) default_slot.c();
			t = space();
			set_custom_element_data(log_row, "class", "svelte-14ki3p6");
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
				if (default_slot.p && dirty & /*$$scope, visible, selected, start*/ 519) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[9], dirty, get_default_slot_changes, get_default_slot_context);
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
	let log_contents;
	let each_blocks = [];
	let each_1_lookup = new Map();
	let current;
	let mounted;
	let dispose;
	let each_value = /*visible*/ ctx[0];
	const get_key = ctx => /*i*/ ctx[18];

	for (let i = 0; i < each_value.length; i += 1) {
		let child_ctx = get_each_context(ctx, each_value, i);
		let key = get_key(child_ctx);
		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
	}

	return {
		c() {
			log_contents = element("log-contents");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			set_custom_element_data(log_contents, "class", "svelte-14ki3p6");
		},
		m(target, anchor) {
			insert(target, log_contents, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(log_contents, null);
			}

			/*log_contents_binding*/ ctx[11](log_contents);
			current = true;

			if (!mounted) {
				dispose = listen(window, "keydown", /*handleKeydown*/ ctx[4]);
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*$$scope, visible, selected, start*/ 519) {
				const each_value = /*visible*/ ctx[0];
				group_outros();
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, log_contents, outro_and_destroy_block, create_each_block, null, get_each_context);
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
			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(log_contents);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].d();
			}

			/*log_contents_binding*/ ctx[11](null);
			mounted = false;
			dispose();
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let { source } = $$props;
	let { visibleRows = 1000000 } = $$props;
	let { entries = [] } = $$props;
	let { visible = entries } = $$props;
	let { follow = true } = $$props;
	let { selected = 0 } = $$props;
	let { start = 0 } = $$props;
	let contents;
	let rows;
	onDestroy(() => source.abort());

	onMount(async () => {
		rows = contents.getElementsByTagName("log-row");
		fetchFollow();
	});

	async function fetchFollow() {
		let current;

		if (entries.length > 0) {
			current = entries[entries.length - 1];
		}

		for await (const entry of source.fetch(current, 1)) {
			entries.push(entry);

			if (entries.length <= visibleRows) {
				$$invalidate(0, visible = entries);
			} else {
				if (!follow) {
					$$invalidate(0, visible = entries.slice(start, visibleRows));
				}
			}

			if (follow) {
				setSelected(entries.length - 1);
			}
		}

		$$invalidate(6, follow = false);
	}

	async function setSelected(toBeSelected) {
		$$invalidate(1, selected = toBeSelected);

		if (selected > entries.length - 1) {
			$$invalidate(1, selected = entries.length - 1);
			$$invalidate(2, start = entries.length - visibleRows);
		}

		if (selected < 0) {
			const cursor = entries[0];
			let number = 5;
			let i;

			for (i = 0; i < number; i++) {
				entries.unshift(undefined);
			}

			$$invalidate(1, selected += number);
			$$invalidate(2, start += number);
			i = 0;

			for await (const entry of source.fetch(cursor, -number, number)) {
				$$invalidate(5, entries[i++] = entry, entries);

				if (i >= number) {
					break;
				}

				$$invalidate(0, visible = entries.slice(start, start + visibleRows));
			}
		}

		if (selected < start) {
			$$invalidate(2, start = selected);
		}

		if (selected >= start + visibleRows) {
			$$invalidate(2, start = selected - visibleRows + 1);
		}

		$$invalidate(0, visible = entries.slice(start, start + visibleRows));
	}

	function setFollow(flag) {
		if (follow === flag) {
			return;
		}

		if (flag) {
			fetchFollow();
		} else {
			source.abort();
		}

		$$invalidate(6, follow = flag);
	}

	function handleKeydown(event) {
		switch (event.key) {
			case "ArrowUp":
				setFollow(false);
				setSelected(selected - 1);
				break;
			case "ArrowDown":
				setFollow(false);
				setSelected(selected + 1);
				break;
			case "PageUp":
				setFollow(false);
				setSelected(selected - visibleRows);
				break;
			case "PageDown":
				setFollow(false);
				setSelected(selected + visibleRows);
				break;
			case "G":
				setFollow(false);
				setSelected(entries.length - 1);
				break;
			case "g":
				setFollow(false);
				setSelected(0);
				break;
			case "f":
				setFollow(!follow);
				break;
		}
	}

	function log_contents_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			contents = $$value;
			$$invalidate(3, contents);
		});
	}

	$$self.$$set = $$props => {
		if ("source" in $$props) $$invalidate(7, source = $$props.source);
		if ("visibleRows" in $$props) $$invalidate(8, visibleRows = $$props.visibleRows);
		if ("entries" in $$props) $$invalidate(5, entries = $$props.entries);
		if ("visible" in $$props) $$invalidate(0, visible = $$props.visible);
		if ("follow" in $$props) $$invalidate(6, follow = $$props.follow);
		if ("selected" in $$props) $$invalidate(1, selected = $$props.selected);
		if ("start" in $$props) $$invalidate(2, start = $$props.start);
		if ("$$scope" in $$props) $$invalidate(9, $$scope = $$props.$$scope);
	};

	return [
		visible,
		selected,
		start,
		contents,
		handleKeydown,
		entries,
		follow,
		source,
		visibleRows,
		$$scope,
		slots,
		log_contents_binding
	];
}

class LogView extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-14ki3p6-style")) add_css();

		init(this, options, instance, create_fragment, safe_not_equal, {
			source: 7,
			visibleRows: 8,
			entries: 5,
			visible: 0,
			follow: 6,
			selected: 1,
			start: 2
		});
	}
}

/* tests/app/src/App.svelte generated by Svelte v3.29.4 */

function add_css$1() {
	var style = element("style");
	style.id = "svelte-dutml-style";
	style.textContent = ".selected.svelte-dutml{background-color:antiquewhite}";
	append(document.head, style);
}

// (51:2) <LogView     visibleRows={10}     {source}     let:entry     let:position     bind:selected     bind:follow     bind:start>
function create_default_slot(ctx) {
	let div;
	let t_value = /*entry*/ ctx[8] + "";
	let t;
	let div_class_value;

	return {
		c() {
			div = element("div");
			t = text(t_value);

			attr(div, "class", div_class_value = "" + (null_to_empty(/*selected*/ ctx[2] === /*position*/ ctx[9]
			? "selected"
			: "") + " svelte-dutml"));
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, t);
		},
		p(ctx, dirty) {
			if (dirty & /*entry*/ 256 && t_value !== (t_value = /*entry*/ ctx[8] + "")) set_data(t, t_value);

			if (dirty & /*selected, position*/ 516 && div_class_value !== (div_class_value = "" + (null_to_empty(/*selected*/ ctx[2] === /*position*/ ctx[9]
			? "selected"
			: "") + " svelte-dutml"))) {
				attr(div, "class", div_class_value);
			}
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

function create_fragment$1(ctx) {
	let div;
	let logview;
	let updating_selected;
	let updating_follow;
	let updating_start;
	let t0;
	let p0;
	let t1;
	let t2;
	let p1;
	let t3;
	let t4;
	let p2;
	let t5_value = (/*follow*/ ctx[1] ? "F" : "-") + "";
	let t5;
	let current;

	function logview_selected_binding(value) {
		/*logview_selected_binding*/ ctx[4].call(null, value);
	}

	function logview_follow_binding(value) {
		/*logview_follow_binding*/ ctx[5].call(null, value);
	}

	function logview_start_binding(value) {
		/*logview_start_binding*/ ctx[6].call(null, value);
	}

	let logview_props = {
		visibleRows: 10,
		source: /*source*/ ctx[3],
		$$slots: {
			default: [
				create_default_slot,
				({ entry, position }) => ({ 8: entry, 9: position }),
				({ entry, position }) => (entry ? 256 : 0) | (position ? 512 : 0)
			]
		},
		$$scope: { ctx }
	};

	if (/*selected*/ ctx[2] !== void 0) {
		logview_props.selected = /*selected*/ ctx[2];
	}

	if (/*follow*/ ctx[1] !== void 0) {
		logview_props.follow = /*follow*/ ctx[1];
	}

	if (/*start*/ ctx[0] !== void 0) {
		logview_props.start = /*start*/ ctx[0];
	}

	logview = new LogView({ props: logview_props });
	binding_callbacks.push(() => bind(logview, "selected", logview_selected_binding));
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
			t3 = text(/*selected*/ ctx[2]);
			t4 = space();
			p2 = element("p");
			t5 = text(t5_value);
			attr(div, "id", "log");
			attr(p0, "id", "start");
			attr(p1, "id", "selected");
			attr(p2, "id", "follow");
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
			insert(target, t4, anchor);
			insert(target, p2, anchor);
			append(p2, t5);
			current = true;
		},
		p(ctx, [dirty]) {
			const logview_changes = {};

			if (dirty & /*$$scope, selected, position, entry*/ 1796) {
				logview_changes.$$scope = { dirty, ctx };
			}

			if (!updating_selected && dirty & /*selected*/ 4) {
				updating_selected = true;
				logview_changes.selected = /*selected*/ ctx[2];
				add_flush_callback(() => updating_selected = false);
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
			if (!current || dirty & /*selected*/ 4) set_data(t3, /*selected*/ ctx[2]);
			if ((!current || dirty & /*follow*/ 2) && t5_value !== (t5_value = (/*follow*/ ctx[1] ? "F" : "-") + "")) set_data(t5, t5_value);
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
			if (detaching) detach(t4);
			if (detaching) detach(p2);
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	let controller = new AbortController();

	const source = {
		abort: async () => controller.abort(),
		async *fetch(cursor, offset, number) {
			if (controller) {
				controller.abort();
			}

			controller = new AbortController();
			const params = { offset, number };

			if (cursor) {
				params.cursor = cursor.substring(5);
			}

			try {
				const response = await fetch(`/api/log?${new URLSearchParams(Object.entries(params))}`, { signal: controller.signal });
				yield* lineIterator(response.body.getReader());
			} catch(e) {
				if (!e instanceof AbortSignal) {
					throw e;
				}
			}
		}
	};

	let start = 0;
	let follow = true;
	let selected = -1;

	function logview_selected_binding(value) {
		selected = value;
		$$invalidate(2, selected);
	}

	function logview_follow_binding(value) {
		follow = value;
		$$invalidate(1, follow);
	}

	function logview_start_binding(value) {
		start = value;
		$$invalidate(0, start);
	}

	return [
		start,
		follow,
		selected,
		source,
		logview_selected_binding,
		logview_follow_binding,
		logview_start_binding
	];
}

class App extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-dutml-style")) add_css$1();
		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});
	}
}

var index = new App({
  target: document.body
});

export default index;
//# sourceMappingURL=bundle.main.mjs.map
