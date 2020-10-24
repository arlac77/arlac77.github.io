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
function subscribe(store, ...callbacks) {
    if (store == null) {
        return noop;
    }
    const unsub = store.subscribe(...callbacks);
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
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
 * Bring session into the valid state by calling the authorization endpoint
 * and asking for a access_token.
 * Executes a POST on the endpoint url expecting username, and password as json
 * @param {Session} session to be opened
 * @param {string} endpoint authorization url
 * @param {string} username id of the user
 * @param {string} password user credentials
 * @return {string} error message in case of failure or undefined on success
 */
async function login(session, endpoint, username, password) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      })
    });
    if (response.ok) {
      const data = await response.json();
      session.update({ username, access_token: data.access_token });
      session.save();
    } else {
      session.update({ username });
      return handleFailedResponse(response);
    }
  } catch (e) {
    session.update({ username });
    throw e;
  }
}

/**
 * Extract error description from response
 * @param {FetchResponse} response
 * @return {string}
 */
async function handleFailedResponse(response) {
  const wa = response.headers.get("WWW-Authenticate");

  if (wa) {
    const o = Object.fromEntries(
      wa.split(/\s*,\s*/).map(entry => entry.split(/=/))
    );
    if (o.error_description) {
      return o.error_description;
    }
  }

  let message = response.statusText;

  const ct = response.headers.get("Content-Type").replace(/;.*/, "");

  switch (ct) {
    case "text/plain":
      message += "\n" + (await response.text());
      break;
    case "text/html":
      const root = document.createElement("html");
      root.innerHTML = await response.text();

      for (const tag of ["title", "h1", "h2"]) {
        for (const item of root.getElementsByTagName(tag)) {
          const text = item.innerText;
          if (text) {
            return text;
          }
        }
      }
      break;
  }

  return message;
}

/* src/Login.svelte generated by Svelte v3.29.4 */
const get_submit_slot_changes = dirty => ({});
const get_submit_slot_context = ctx => ({});
const get_inputs_slot_changes = dirty => ({});
const get_inputs_slot_context = ctx => ({});
const get_message_slot_changes = dirty => ({});
const get_message_slot_context = ctx => ({});

// (31:2) {#if message}
function create_if_block_1(ctx) {
	let current;
	const message_slot_template = /*#slots*/ ctx[9].message;
	const message_slot = create_slot(message_slot_template, ctx, /*$$scope*/ ctx[8], get_message_slot_context);
	const message_slot_or_fallback = message_slot || fallback_block_2(ctx);

	return {
		c() {
			if (message_slot_or_fallback) message_slot_or_fallback.c();
		},
		m(target, anchor) {
			if (message_slot_or_fallback) {
				message_slot_or_fallback.m(target, anchor);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (message_slot) {
				if (message_slot.p && dirty & /*$$scope*/ 256) {
					update_slot(message_slot, message_slot_template, ctx, /*$$scope*/ ctx[8], dirty, get_message_slot_changes, get_message_slot_context);
				}
			} else {
				if (message_slot_or_fallback && message_slot_or_fallback.p && dirty & /*message*/ 8) {
					message_slot_or_fallback.p(ctx, dirty);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(message_slot_or_fallback, local);
			current = true;
		},
		o(local) {
			transition_out(message_slot_or_fallback, local);
			current = false;
		},
		d(detaching) {
			if (message_slot_or_fallback) message_slot_or_fallback.d(detaching);
		}
	};
}

// (32:25)        
function fallback_block_2(ctx) {
	let div;
	let t;

	return {
		c() {
			div = element("div");
			t = text(/*message*/ ctx[3]);
			attr(div, "class", "error");
			attr(div, "id", "message");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, t);
		},
		p(ctx, dirty) {
			if (dirty & /*message*/ 8) set_data(t, /*message*/ ctx[3]);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (37:22)      
function fallback_block_1(ctx) {
	let label0;
	let t0;
	let input0;
	let t1;
	let label1;
	let t2;
	let input1;
	let mounted;
	let dispose;

	return {
		c() {
			label0 = element("label");
			t0 = text("Username\n      ");
			input0 = element("input");
			t1 = space();
			label1 = element("label");
			t2 = text("Password\n      ");
			input1 = element("input");
			attr(input0, "aria-label", "username");
			attr(input0, "aria-required", "true");
			attr(input0, "maxlength", "75");
			attr(input0, "size", "32");
			attr(input0, "autocorrect", "off");
			attr(input0, "autocapitalize", "off");
			attr(input0, "autocomplete", "username");
			attr(input0, "id", "username");
			attr(input0, "type", "text");
			attr(input0, "placeholder", "Username");
			attr(input0, "name", "username");
			input0.required = true;
			input0.disabled = /*active*/ ctx[2];
			attr(label0, "for", "username");
			attr(input1, "aria-label", "password");
			attr(input1, "aria-required", "true");
			attr(input1, "size", "32");
			attr(input1, "autocorrect", "off");
			attr(input1, "autocapitalize", "off");
			attr(input1, "autocomplete", "current-password");
			attr(input1, "id", "password");
			attr(input1, "type", "password");
			attr(input1, "placeholder", "Password");
			attr(input1, "name", "password");
			input1.required = true;
			input1.disabled = /*active*/ ctx[2];
			attr(label1, "for", "password");
		},
		m(target, anchor) {
			insert(target, label0, anchor);
			append(label0, t0);
			append(label0, input0);
			set_input_value(input0, /*username*/ ctx[0]);
			insert(target, t1, anchor);
			insert(target, label1, anchor);
			append(label1, t2);
			append(label1, input1);
			set_input_value(input1, /*password*/ ctx[1]);

			if (!mounted) {
				dispose = [
					listen(input0, "input", /*input0_input_handler*/ ctx[10]),
					listen(input1, "input", /*input1_input_handler*/ ctx[11])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*active*/ 4) {
				input0.disabled = /*active*/ ctx[2];
			}

			if (dirty & /*username*/ 1 && input0.value !== /*username*/ ctx[0]) {
				set_input_value(input0, /*username*/ ctx[0]);
			}

			if (dirty & /*active*/ 4) {
				input1.disabled = /*active*/ ctx[2];
			}

			if (dirty & /*password*/ 2 && input1.value !== /*password*/ ctx[1]) {
				set_input_value(input1, /*password*/ ctx[1]);
			}
		},
		d(detaching) {
			if (detaching) detach(label0);
			if (detaching) detach(t1);
			if (detaching) detach(label1);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (78:6) {#if active}
function create_if_block(ctx) {
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

// (75:22)      
function fallback_block(ctx) {
	let button;
	let t;
	let button_disabled_value;
	let if_block = /*active*/ ctx[2] && create_if_block();

	return {
		c() {
			button = element("button");
			t = text("Login\n      ");
			if (if_block) if_block.c();
			attr(button, "id", "submit");
			attr(button, "type", "submit");
			button.disabled = button_disabled_value = !/*username*/ ctx[0] || !/*password*/ ctx[1];
		},
		m(target, anchor) {
			insert(target, button, anchor);
			append(button, t);
			if (if_block) if_block.m(button, null);
		},
		p(ctx, dirty) {
			if (/*active*/ ctx[2]) {
				if (if_block) ; else {
					if_block = create_if_block();
					if_block.c();
					if_block.m(button, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			if (dirty & /*username, password*/ 3 && button_disabled_value !== (button_disabled_value = !/*username*/ ctx[0] || !/*password*/ ctx[1])) {
				button.disabled = button_disabled_value;
			}
		},
		d(detaching) {
			if (detaching) detach(button);
			if (if_block) if_block.d();
		}
	};
}

function create_fragment(ctx) {
	let form;
	let t0;
	let t1;
	let current;
	let mounted;
	let dispose;
	let if_block = /*message*/ ctx[3] && create_if_block_1(ctx);
	const inputs_slot_template = /*#slots*/ ctx[9].inputs;
	const inputs_slot = create_slot(inputs_slot_template, ctx, /*$$scope*/ ctx[8], get_inputs_slot_context);
	const inputs_slot_or_fallback = inputs_slot || fallback_block_1(ctx);
	const submit_slot_template = /*#slots*/ ctx[9].submit;
	const submit_slot = create_slot(submit_slot_template, ctx, /*$$scope*/ ctx[8], get_submit_slot_context);
	const submit_slot_or_fallback = submit_slot || fallback_block(ctx);

	return {
		c() {
			form = element("form");
			if (if_block) if_block.c();
			t0 = space();
			if (inputs_slot_or_fallback) inputs_slot_or_fallback.c();
			t1 = space();
			if (submit_slot_or_fallback) submit_slot_or_fallback.c();
		},
		m(target, anchor) {
			insert(target, form, anchor);
			if (if_block) if_block.m(form, null);
			append(form, t0);

			if (inputs_slot_or_fallback) {
				inputs_slot_or_fallback.m(form, null);
			}

			append(form, t1);

			if (submit_slot_or_fallback) {
				submit_slot_or_fallback.m(form, null);
			}

			current = true;

			if (!mounted) {
				dispose = listen(form, "submit", prevent_default(/*submit*/ ctx[4]));
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (/*message*/ ctx[3]) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty & /*message*/ 8) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block_1(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(form, t0);
				}
			} else if (if_block) {
				group_outros();

				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});

				check_outros();
			}

			if (inputs_slot) {
				if (inputs_slot.p && dirty & /*$$scope*/ 256) {
					update_slot(inputs_slot, inputs_slot_template, ctx, /*$$scope*/ ctx[8], dirty, get_inputs_slot_changes, get_inputs_slot_context);
				}
			} else {
				if (inputs_slot_or_fallback && inputs_slot_or_fallback.p && dirty & /*active, password, username*/ 7) {
					inputs_slot_or_fallback.p(ctx, dirty);
				}
			}

			if (submit_slot) {
				if (submit_slot.p && dirty & /*$$scope*/ 256) {
					update_slot(submit_slot, submit_slot_template, ctx, /*$$scope*/ ctx[8], dirty, get_submit_slot_changes, get_submit_slot_context);
				}
			} else {
				if (submit_slot_or_fallback && submit_slot_or_fallback.p && dirty & /*username, password, active*/ 7) {
					submit_slot_or_fallback.p(ctx, dirty);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			transition_in(inputs_slot_or_fallback, local);
			transition_in(submit_slot_or_fallback, local);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			transition_out(inputs_slot_or_fallback, local);
			transition_out(submit_slot_or_fallback, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(form);
			if (if_block) if_block.d();
			if (inputs_slot_or_fallback) inputs_slot_or_fallback.d(detaching);
			if (submit_slot_or_fallback) submit_slot_or_fallback.d(detaching);
			mounted = false;
			dispose();
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let { endpoint } = $$props;
	let { session } = $$props;
	let { result } = $$props;
	let username = "";
	let password = "";
	let active = false;
	let message;

	async function submit() {
		try {
			$$invalidate(2, active = true);
			$$invalidate(3, message = await login(session, endpoint, username, password));

			if (!message && result !== undefined) {
				await result();
			}
		} catch(e) {
			$$invalidate(3, message = e);
		} finally {
			$$invalidate(2, active = false);
			$$invalidate(1, password = "");
		}
	}

	function input0_input_handler() {
		username = this.value;
		$$invalidate(0, username);
	}

	function input1_input_handler() {
		password = this.value;
		$$invalidate(1, password);
	}

	$$self.$$set = $$props => {
		if ("endpoint" in $$props) $$invalidate(5, endpoint = $$props.endpoint);
		if ("session" in $$props) $$invalidate(6, session = $$props.session);
		if ("result" in $$props) $$invalidate(7, result = $$props.result);
		if ("$$scope" in $$props) $$invalidate(8, $$scope = $$props.$$scope);
	};

	return [
		username,
		password,
		active,
		message,
		submit,
		endpoint,
		session,
		result,
		$$scope,
		slots,
		input0_input_handler,
		input1_input_handler
	];
}

class Login extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { endpoint: 5, session: 6, result: 7 });
	}
}

/**
 * Data as preserved in the backing store
 * @typedef {Object} SessionData
 * @property {string} username user name (id)
 * @property {string} access_token JWT token
 */

/**
 * User session
 * To create as session backed by browser local storage
 * ```js
 * let session = new Session(localStorage);
 * ```
 * or by browser session storage
 * ```js
 * let session = new Session(sessionStorage);
 * ```
 * @param {SessionData} data
 * @property {Set<string>} entitlements
 * @property {Set<Object>} subscriptions store subscriptions
 * @property {Date} expirationDate
 * @property {string} access_token token itself
 * @property {SessionData} store backing store to use for save same as data param
 */
class Session {
  constructor(data) {
    let expirationTimer;

    Object.defineProperties(this, {
      store: {
        value: data
      },
      subscriptions: {
        value: new Set()
      },
      entitlements: {
        value: new Set()
      },
      expirationDate: {
        value: new Date(0)
      },
      expirationTimer: {
        get: () => expirationTimer,
        set: v => (expirationTimer = v)
      }
    });

    this.update(data);
  }

  /**
   * Invalidate session data
   */
  clear() {
    this.entitlements.clear();
    this.expirationDate.setTime(0);
    this.username = undefined;
    this.access_token = undefined;
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = undefined;
    }
  }

  update(data) {
    this.clear();

    if (data !== undefined) {
      this.username = data.username !== "undefined" ? data.username : undefined;
      this.access_token = data.access_token;

      const decoded = decode(data.access_token);

      if (decoded) {
        this.expirationDate.setUTCSeconds(decoded.exp);

        const expiresInMilliSeconds =
          this.expirationDate.valueOf() - Date.now();

        if(expiresInMilliSeconds > 0) {
          if(decoded.entitlements) {
            decoded.entitlements.split(/,/).forEach(e => this.entitlements.add(e));
          }

          this.expirationTimer = setTimeout(() => {
            this.clear();
            this.fire();
          }, expiresInMilliSeconds);
        }
      }
    }

    this.fire();
  }

  /**
   * Persist into the backing store
   */
  save() {
    if (this.username === undefined) {
      delete this.store.access_token;
      delete this.store.username;
    } else {
      this.store.access_token = this.access_token;
      this.store.username = this.username;
    }
  }

  /**
   * http header suitable for fetch
   * @return {Object} header The http header.
   * @return {string} header.Authorization The Bearer access token.
   */
  get authorizationHeader() {
    return { Authorization: "Bearer " + this.access_token };
  }

  /**
   * As long as the expirationTimer is running we must be valid
   * @return {boolean} true if session is valid (not expired)
   */
  get isValid() {
    return this.expirationTimer !== undefined;
  }

  /**
   * Remove all tokens from the session and the backing store
   */
  invalidate() {
    this.update();
    this.save();
  }

  /**
   * Check presence of an entilement.
   * @param {string} name of the entitlement
   * @return {boolean} true if the named entitlement is present
   */ 
  hasEntitlement(name) {
    return this.entitlements.has(name);
  }

  fire() {
    this.subscriptions.forEach(subscription => subscription(this));
  }

  /**
   * Fired when the session changes
   * @param {Function} subscription
   */
  subscribe(subscription) {
    subscription(this);
    this.subscriptions.add(subscription);
    return () => this.subscriptions.delete(subscription);
  }
}

function decode(token) {
  return token === undefined || token === "undefined"
    ? undefined
    : JSON.parse(atob(token.split(".")[1]));
}

/* tests/app/src/App.svelte generated by Svelte v3.29.4 */

function create_if_block$1(ctx) {
	let div1;
	let div0;
	let login;
	let current;

	login = new Login({
			props: {
				session: /*session*/ ctx[0],
				endpoint: "/api/login",
				result: /*result*/ ctx[3]
			}
		});

	return {
		c() {
			div1 = element("div");
			div0 = element("div");
			create_component(login.$$.fragment);
			attr(div0, "class", "window");
			attr(div1, "class", "modal center");
		},
		m(target, anchor) {
			insert(target, div1, anchor);
			append(div1, div0);
			mount_component(login, div0, null);
			current = true;
		},
		p: noop,
		i(local) {
			if (current) return;
			transition_in(login.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(login.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div1);
			destroy_component(login);
		}
	};
}

function create_fragment$1(ctx) {
	let div;
	let h1;
	let t1;
	let bold0;
	let t3;
	let bold1;
	let t5;
	let t6;
	let form;
	let button;
	let t7;
	let button_disabled_value;
	let t8;
	let t9_value = (/*resultCalled*/ ctx[1] ? "RESULT CALLED" : "NOT CALLED") + "";
	let t9;
	let t10;
	let h3;
	let t12;
	let table;
	let tbody;
	let tr0;
	let td0;
	let t14;
	let td1;
	let t15_value = /*$session*/ ctx[2].subscriptions.size + "";
	let t15;
	let t16;
	let tr1;
	let td2;
	let t18;
	let td3;
	let t19_value = /*$session*/ ctx[2].username + "";
	let t19;
	let t20;
	let tr2;
	let td4;
	let t22;
	let td5;
	let t23_value = /*$session*/ ctx[2].expirationDate + "";
	let t23;
	let t24;
	let tr3;
	let td6;
	let t26;
	let td7;
	let t27_value = (/*$session*/ ctx[2].isValid ? "valid" : "invalid") + "";
	let t27;
	let t28;
	let tr4;
	let td8;
	let t30;
	let td9;
	let t31_value = /*$session*/ ctx[2].access_token + "";
	let t31;
	let t32;
	let tr5;
	let td10;
	let t34;
	let td11;
	let t35_value = [.../*$session*/ ctx[2].entitlements].join(",") + "";
	let t35;
	let t36;
	let tr6;
	let td12;
	let t38;
	let td13;
	let t39_value = JSON.stringify(/*$session*/ ctx[2].authorizationHeader) + "";
	let t39;
	let current;
	let mounted;
	let dispose;
	let if_block = !/*$session*/ ctx[2].isValid && create_if_block$1(ctx);

	return {
		c() {
			div = element("div");
			h1 = element("h1");
			h1.textContent = "Example";
			t1 = text("\n  Username is\n  ");
			bold0 = element("bold");
			bold0.textContent = "user";
			t3 = text("\n  Password is\n  ");
			bold1 = element("bold");
			bold1.textContent = "secret";
			t5 = space();
			if (if_block) if_block.c();
			t6 = space();
			form = element("form");
			button = element("button");
			t7 = text("Logoff");
			t8 = space();
			t9 = text(t9_value);
			t10 = space();
			h3 = element("h3");
			h3.textContent = "Session Details";
			t12 = space();
			table = element("table");
			tbody = element("tbody");
			tr0 = element("tr");
			td0 = element("td");
			td0.textContent = "Subscriptions";
			t14 = space();
			td1 = element("td");
			t15 = text(t15_value);
			t16 = space();
			tr1 = element("tr");
			td2 = element("td");
			td2.textContent = "Username";
			t18 = space();
			td3 = element("td");
			t19 = text(t19_value);
			t20 = space();
			tr2 = element("tr");
			td4 = element("td");
			td4.textContent = "Expires";
			t22 = space();
			td5 = element("td");
			t23 = text(t23_value);
			t24 = space();
			tr3 = element("tr");
			td6 = element("td");
			td6.textContent = "Validity";
			t26 = space();
			td7 = element("td");
			t27 = text(t27_value);
			t28 = space();
			tr4 = element("tr");
			td8 = element("td");
			td8.textContent = "Access Token";
			t30 = space();
			td9 = element("td");
			t31 = text(t31_value);
			t32 = space();
			tr5 = element("tr");
			td10 = element("td");
			td10.textContent = "Entitlements";
			t34 = space();
			td11 = element("td");
			t35 = text(t35_value);
			t36 = space();
			tr6 = element("tr");
			td12 = element("td");
			td12.textContent = "Authorization Header";
			t38 = space();
			td13 = element("td");
			t39 = text(t39_value);
			attr(button, "id", "logoff");
			attr(button, "type", "submit");
			button.disabled = button_disabled_value = !/*$session*/ ctx[2].isValid;
			attr(td1, "id", "session_subscriptions");
			attr(td3, "id", "session_username");
			attr(td5, "id", "session_expires");
			attr(td7, "id", "session_validity");
			attr(td9, "id", "session_acccess_token");
			attr(td11, "id", "session_entitlements");
			attr(td13, "id", "session_authorization_header");
			attr(table, "class", "bordered");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, h1);
			append(div, t1);
			append(div, bold0);
			append(div, t3);
			append(div, bold1);
			append(div, t5);
			if (if_block) if_block.m(div, null);
			append(div, t6);
			append(div, form);
			append(form, button);
			append(button, t7);
			append(div, t8);
			append(div, t9);
			append(div, t10);
			append(div, h3);
			append(div, t12);
			append(div, table);
			append(table, tbody);
			append(tbody, tr0);
			append(tr0, td0);
			append(tr0, t14);
			append(tr0, td1);
			append(td1, t15);
			append(tbody, t16);
			append(tbody, tr1);
			append(tr1, td2);
			append(tr1, t18);
			append(tr1, td3);
			append(td3, t19);
			append(tbody, t20);
			append(tbody, tr2);
			append(tr2, td4);
			append(tr2, t22);
			append(tr2, td5);
			append(td5, t23);
			append(tbody, t24);
			append(tbody, tr3);
			append(tr3, td6);
			append(tr3, t26);
			append(tr3, td7);
			append(td7, t27);
			append(tbody, t28);
			append(tbody, tr4);
			append(tr4, td8);
			append(tr4, t30);
			append(tr4, td9);
			append(td9, t31);
			append(tbody, t32);
			append(tbody, tr5);
			append(tr5, td10);
			append(tr5, t34);
			append(tr5, td11);
			append(td11, t35);
			append(tbody, t36);
			append(tbody, tr6);
			append(tr6, td12);
			append(tr6, t38);
			append(tr6, td13);
			append(td13, t39);
			current = true;

			if (!mounted) {
				dispose = listen(form, "submit", prevent_default(/*submit_handler*/ ctx[4]));
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (!/*$session*/ ctx[2].isValid) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty & /*$session*/ 4) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block$1(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(div, t6);
				}
			} else if (if_block) {
				group_outros();

				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});

				check_outros();
			}

			if (!current || dirty & /*$session*/ 4 && button_disabled_value !== (button_disabled_value = !/*$session*/ ctx[2].isValid)) {
				button.disabled = button_disabled_value;
			}

			if ((!current || dirty & /*resultCalled*/ 2) && t9_value !== (t9_value = (/*resultCalled*/ ctx[1] ? "RESULT CALLED" : "NOT CALLED") + "")) set_data(t9, t9_value);
			if ((!current || dirty & /*$session*/ 4) && t15_value !== (t15_value = /*$session*/ ctx[2].subscriptions.size + "")) set_data(t15, t15_value);
			if ((!current || dirty & /*$session*/ 4) && t19_value !== (t19_value = /*$session*/ ctx[2].username + "")) set_data(t19, t19_value);
			if ((!current || dirty & /*$session*/ 4) && t23_value !== (t23_value = /*$session*/ ctx[2].expirationDate + "")) set_data(t23, t23_value);
			if ((!current || dirty & /*$session*/ 4) && t27_value !== (t27_value = (/*$session*/ ctx[2].isValid ? "valid" : "invalid") + "")) set_data(t27, t27_value);
			if ((!current || dirty & /*$session*/ 4) && t31_value !== (t31_value = /*$session*/ ctx[2].access_token + "")) set_data(t31, t31_value);
			if ((!current || dirty & /*$session*/ 4) && t35_value !== (t35_value = [.../*$session*/ ctx[2].entitlements].join(",") + "")) set_data(t35, t35_value);
			if ((!current || dirty & /*$session*/ 4) && t39_value !== (t39_value = JSON.stringify(/*$session*/ ctx[2].authorizationHeader) + "")) set_data(t39, t39_value);
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
			if (detaching) detach(div);
			if (if_block) if_block.d();
			mounted = false;
			dispose();
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	let $session,
		$$unsubscribe_session = noop,
		$$subscribe_session = () => ($$unsubscribe_session(), $$unsubscribe_session = subscribe(session, $$value => $$invalidate(2, $session = $$value)), session);

	$$self.$$.on_destroy.push(() => $$unsubscribe_session());
	const session = new Session(localStorage);
	$$subscribe_session();
	let resultCalled = false;

	function result() {
		$$invalidate(1, resultCalled = true);
	}

	const submit_handler = () => session.invalidate();
	return [session, resultCalled, $session, result, submit_handler];
}

class App extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$1, create_fragment$1, safe_not_equal, { session: 0 });
	}

	get session() {
		return this.$$.ctx[0];
	}
}

var index = new App({
  target: document.body
});

export default index;
//# sourceMappingURL=bundle.main.mjs.map
