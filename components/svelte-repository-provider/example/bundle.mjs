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

/* src/AttributeField.svelte generated by Svelte v3.24.0 */

function create_fragment(ctx) {
	let label;
	let t0_value = /*attribute*/ ctx[0].name + "";
	let t0;
	let t1;
	let t2_value = /*attribute*/ ctx[0].env + "";
	let t2;
	let t3;
	let input;
	let input_aria_label_value;
	let input_aria_required_value;
	let input_id_value;
	let input_placeholder_value;
	let input_name_value;
	let label_for_value;
	let mounted;
	let dispose;

	return {
		c() {
			label = element("label");
			t0 = text(t0_value);
			t1 = text(" (");
			t2 = text(t2_value);
			t3 = text(")\n  ");
			input = element("input");
			attr(input, "aria-label", input_aria_label_value = /*attribute*/ ctx[0].name);
			attr(input, "aria-required", input_aria_required_value = /*attribute*/ ctx[0].mandatory ? "true" : "false");
			attr(input, "maxlength", "75");
			attr(input, "size", "60");
			attr(input, "autocorrect", "off");
			attr(input, "autocapitalize", "off");
			attr(input, "id", input_id_value = /*attribute*/ ctx[0].name);
			attr(input, "type", "text");
			attr(input, "placeholder", input_placeholder_value = /*attribute*/ ctx[0].name);
			attr(input, "name", input_name_value = /*attribute*/ ctx[0].name);
			input.required = true;
			attr(label, "for", label_for_value = /*attribute*/ ctx[0].name);
		},
		m(target, anchor) {
			insert(target, label, anchor);
			append(label, t0);
			append(label, t1);
			append(label, t2);
			append(label, t3);
			append(label, input);
			set_input_value(input, /*attribute*/ ctx[0].value);

			if (!mounted) {
				dispose = listen(input, "input", /*input_input_handler*/ ctx[1]);
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*attribute*/ 1 && t0_value !== (t0_value = /*attribute*/ ctx[0].name + "")) set_data(t0, t0_value);
			if (dirty & /*attribute*/ 1 && t2_value !== (t2_value = /*attribute*/ ctx[0].env + "")) set_data(t2, t2_value);

			if (dirty & /*attribute*/ 1 && input_aria_label_value !== (input_aria_label_value = /*attribute*/ ctx[0].name)) {
				attr(input, "aria-label", input_aria_label_value);
			}

			if (dirty & /*attribute*/ 1 && input_aria_required_value !== (input_aria_required_value = /*attribute*/ ctx[0].mandatory ? "true" : "false")) {
				attr(input, "aria-required", input_aria_required_value);
			}

			if (dirty & /*attribute*/ 1 && input_id_value !== (input_id_value = /*attribute*/ ctx[0].name)) {
				attr(input, "id", input_id_value);
			}

			if (dirty & /*attribute*/ 1 && input_placeholder_value !== (input_placeholder_value = /*attribute*/ ctx[0].name)) {
				attr(input, "placeholder", input_placeholder_value);
			}

			if (dirty & /*attribute*/ 1 && input_name_value !== (input_name_value = /*attribute*/ ctx[0].name)) {
				attr(input, "name", input_name_value);
			}

			if (dirty & /*attribute*/ 1 && input.value !== /*attribute*/ ctx[0].value) {
				set_input_value(input, /*attribute*/ ctx[0].value);
			}

			if (dirty & /*attribute*/ 1 && label_for_value !== (label_for_value = /*attribute*/ ctx[0].name)) {
				attr(label, "for", label_for_value);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(label);
			mounted = false;
			dispose();
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { attribute } = $$props;

	function input_input_handler() {
		attribute.value = this.value;
		$$invalidate(0, attribute);
	}

	$$self.$set = $$props => {
		if ("attribute" in $$props) $$invalidate(0, attribute = $$props.attribute);
	};

	return [attribute, input_input_handler];
}

class AttributeField extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { attribute: 0 });
	}
}

/* src/SecureAttributeField.svelte generated by Svelte v3.24.0 */

function create_fragment$1(ctx) {
	let label;
	let t0_value = /*attribute*/ ctx[0].name + "";
	let t0;
	let t1;
	let t2_value = /*attribute*/ ctx[0].env + "";
	let t2;
	let t3;
	let input;
	let input_aria_label_value;
	let input_aria_required_value;
	let input_id_value;
	let input_placeholder_value;
	let input_name_value;
	let label_for_value;
	let mounted;
	let dispose;

	return {
		c() {
			label = element("label");
			t0 = text(t0_value);
			t1 = text(" (");
			t2 = text(t2_value);
			t3 = text(")\n  ");
			input = element("input");
			attr(input, "aria-label", input_aria_label_value = /*attribute*/ ctx[0].name);
			attr(input, "aria-required", input_aria_required_value = /*attribute*/ ctx[0].mandatory ? "true" : "false");
			attr(input, "maxlength", "128");
			attr(input, "size", "60");
			attr(input, "autocorrect", "off");
			attr(input, "autocapitalize", "off");
			attr(input, "id", input_id_value = /*attribute*/ ctx[0].name);
			attr(input, "type", "password");
			attr(input, "placeholder", input_placeholder_value = /*attribute*/ ctx[0].name);
			attr(input, "name", input_name_value = /*attribute*/ ctx[0].name);
			input.required = true;
			attr(label, "for", label_for_value = /*attribute*/ ctx[0].name);
		},
		m(target, anchor) {
			insert(target, label, anchor);
			append(label, t0);
			append(label, t1);
			append(label, t2);
			append(label, t3);
			append(label, input);
			set_input_value(input, /*attribute*/ ctx[0].value);

			if (!mounted) {
				dispose = listen(input, "input", /*input_input_handler*/ ctx[1]);
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*attribute*/ 1 && t0_value !== (t0_value = /*attribute*/ ctx[0].name + "")) set_data(t0, t0_value);
			if (dirty & /*attribute*/ 1 && t2_value !== (t2_value = /*attribute*/ ctx[0].env + "")) set_data(t2, t2_value);

			if (dirty & /*attribute*/ 1 && input_aria_label_value !== (input_aria_label_value = /*attribute*/ ctx[0].name)) {
				attr(input, "aria-label", input_aria_label_value);
			}

			if (dirty & /*attribute*/ 1 && input_aria_required_value !== (input_aria_required_value = /*attribute*/ ctx[0].mandatory ? "true" : "false")) {
				attr(input, "aria-required", input_aria_required_value);
			}

			if (dirty & /*attribute*/ 1 && input_id_value !== (input_id_value = /*attribute*/ ctx[0].name)) {
				attr(input, "id", input_id_value);
			}

			if (dirty & /*attribute*/ 1 && input_placeholder_value !== (input_placeholder_value = /*attribute*/ ctx[0].name)) {
				attr(input, "placeholder", input_placeholder_value);
			}

			if (dirty & /*attribute*/ 1 && input_name_value !== (input_name_value = /*attribute*/ ctx[0].name)) {
				attr(input, "name", input_name_value);
			}

			if (dirty & /*attribute*/ 1 && input.value !== /*attribute*/ ctx[0].value) {
				set_input_value(input, /*attribute*/ ctx[0].value);
			}

			if (dirty & /*attribute*/ 1 && label_for_value !== (label_for_value = /*attribute*/ ctx[0].name)) {
				attr(label, "for", label_for_value);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(label);
			mounted = false;
			dispose();
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	let { attribute } = $$props;

	function input_input_handler() {
		attribute.value = this.value;
		$$invalidate(0, attribute);
	}

	$$self.$set = $$props => {
		if ("attribute" in $$props) $$invalidate(0, attribute = $$props.attribute);
	};

	return [attribute, input_input_handler];
}

class SecureAttributeField extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$1, create_fragment$1, safe_not_equal, { attribute: 0 });
	}
}

/* example/src/App.svelte generated by Svelte v3.24.0 */

function create_fragment$2(ctx) {
	let attributefield;
	let t;
	let secureattributefield;
	let current;

	attributefield = new AttributeField({
			props: {
				attribute: { name: "a1", value: "value a1" }
			}
		});

	secureattributefield = new SecureAttributeField({
			props: {
				attribute: { name: "s1", value: "value s1" }
			}
		});

	return {
		c() {
			create_component(attributefield.$$.fragment);
			t = space();
			create_component(secureattributefield.$$.fragment);
		},
		m(target, anchor) {
			mount_component(attributefield, target, anchor);
			insert(target, t, anchor);
			mount_component(secureattributefield, target, anchor);
			current = true;
		},
		p: noop,
		i(local) {
			if (current) return;
			transition_in(attributefield.$$.fragment, local);
			transition_in(secureattributefield.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(attributefield.$$.fragment, local);
			transition_out(secureattributefield.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(attributefield, detaching);
			if (detaching) detach(t);
			destroy_component(secureattributefield, detaching);
		}
	};
}

class App extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, null, create_fragment$2, safe_not_equal, {});
	}
}

var index = new App({
  target: document.body
});

export default index;
//# sourceMappingURL=bundle.mjs.map
