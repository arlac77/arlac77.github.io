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
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
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
function set_input_value(input, value) {
    input.value = value == null ? '' : value;
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
function setContext(key, context) {
    get_current_component().$$.context.set(key, context);
}
function getContext(key) {
    return get_current_component().$$.context.get(key);
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

function destroy_block(block, lookup) {
    block.d(1);
    lookup.delete(block.key);
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
 * Create a named object wich can act as a store
 * @param {string} name
 * @param {any} initialValue
 * @property {any} value
 * @return {Store}
 */
function nameValueStore(name, initialValue) {
  const subscriptions = new Set();
  let value = initialValue;

  const o = {
    name,
    subscribe: cb => {
      subscriptions.add(cb);
      cb(value);
      return () => subscriptions.delete(cb);
    },
    set(v) {
      o.value = v;
    }
  };

  Object.defineProperties(o, {
    value: {
      get() {
        return value;
      },
      set(v) {
        value = v;
        subscriptions.forEach(subscription => subscription(value));
      }
    },
    subscriptions: { value: subscriptions }
  });

  return o;
}
const ROUTER = "@private-ROUTER";
const NAVIGATION_EVENT = "routeLink";

/**
 * Result of the routes compilation
 * @typedef {Object} CompiledRoutes
 * @property {number} priority higher number reflect more precise matches
 * @property {string[]} keys param names extractable from route
 * @property {RegEx} regex
 */

/**
 * One single route
 * @typedef {Object} Route
 * @property {string} path
 */

/**
 * Result of a match
 * @typedef  {Object} Match
 * @property {Route[]} route as given to the compiler, undefined if no matching route found
 * @property {Object} params extracted from the path
 */

/**
 * Prioritiy for a plain path component
 */
const PLAIN = 100;

/**
 * Prioritiy for a path component with matching
 */
const MATCH = 10;

/**
 * Prioritiy for a parameter path component
 */
const PARAM = 1;

/**
 * Compile a set of routes.
 * All properties of the original routes are preserved
 * @param {Route[]} routes
 * @return {CompiledRoutes}
 */
function compile(routes) {
  return routes
    .map(route => Object.assign(route, pathToRegexp(route.path)))
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Result of a path compilation
 * priorities for each path component
 * - :param       {@link PARAM}
 * - match * or ? {@link MATCH}
 * - plain        {@link PLAIN}
 * @typedef  {Object} CompiledRoute
 * @property {RegExp} regex for later checking and params extration
 * @property {string[]} keys all keys found in the route
 * @property {number} priority order in which to check
 */

/**
 * Generate regex with priority
 * @param {string} path
 * @return {CompiledRoute}
 */
function pathToRegexp(path) {
  const keys = [];
  let priority = 0;

  const segments = path.split(/\//).map(part => {
    if (part[0] === ":") {
      keys.push(part.slice(1));
      priority += PARAM;
      return "([^/#?]*)";
    }

    const mod = part.replace(/(\*|\?)/, ".$1", "g");

    priority += mod === part ? PLAIN : MATCH;

    return mod;
  });

  return {
    keys,
    regex: RegExp("^" + segments.join("\\/") + "([\\?#].*)?$"),
    priority
  };
}

/**
 * Find best match for a given path
 * @param {CompiledRoutes} compiled
 * @param {string} path
 * @return {Match} match
 */
function matcher(compiled, path) {
  for (const route of compiled) {
    const m = path.match(route.regex);
    if (m) {
      return {
        route,
        params: Object.fromEntries(route.keys.map((k, i) => [k, m[i + 1]]))
      };
    }
  }

  return { params: {} };
}

/**
 * Transition between routes
 * @param {Router} router
 * @param {string} path destination
 * @property {Router} router
 * @property {string} path destination
 * @property {string} state
 */
class Transition {
  constructor(router, path) {
    let component;

    Object.defineProperties(this, {
      router: { value: router },
      path: { value: path },
      saved: { value: router.state },
      component: {
        get: () => (this.redirected === undefined ? component : undefined),
        set: value => {
          component = value;
          this.router.notifySubscriptions();
        }
      }
    });
  }

  /**
   * Start the transition
   * - leave old route
   * - find matching target route @see matcher()
   * - set params
   * - set current route
   * - enter new route
   */
  async start() {
    try {
      const router = this.router;
      const state = matcher(router.routes, this.path);

      if (state.route) {
        const ancestor = state.route.commonAncestor(this.saved.route);

        if (this.saved.route !== undefined) {
          await this.saved.route.leave(this, ancestor);
        }

        router.state = state;

        await router.route.enter(this, ancestor);
      }
    } catch (e) {
      await this.abort(e);
    } finally {
      this.end();
    }
  }

  /**
   * Cleanup transition
   * Update Nodes active state
   * @see Router.finalizePush
   */
  end() {
    if (this.redirected === undefined) {
      this.router.finalizePush(this.path);
    }
  }

  /**
   * Halt current transition and go to another route.
   * To proceed with the original route by calling {@link continue()}
   * The original transition will cept in place and be continued afterwards
   * @param {string} path new route to enter temporary
   */
  async redirect(path) {
    this.redirected = { state: this.router.replace(path) };

    return new Promise((resolve, reject) => {
      this.redirected.continue = async () => {
        try {
          this.router.state = this.redirected.state;
          resolve();
        } catch (e) {
          await this.abort(e);
          reject(e);
        } finally {
          this.redirected = undefined;
        }
      };

      this.redirected.abort = () => {
        this.redirected = undefined;
        reject();
      };
    });
  }

  /**
   * Continue a redirected route to its original destination.
   * Does nothing if the transition has not been redirected
   */
  async continue() {
    if (this.redirected !== undefined) {
      return this.redirected.continue();
    }
  }

  /**
   * Bring back the router into the state before the transition has started
   * @param {Exception|undefined} e
   */
  async abort(e) {
    if (e) {
      this.router.error(e);
    }

    if (this.redirected !== undefined) {
      await this.redirected.abort();
    }

    this.router.state = this.saved;
    history.back();
    setTimeout(() => this.router.finalizePush(), 0);
  }
}

/**
 * Keys also act as svelte stores and can be subscribed.
 * ```js
 * export const article = derived(
 * [articles, router.keys.article],
 * ([$articles, $id], set) => {
 *   set($articles.find(a => a.id === $id));
 *   return () => {};
 * }
 * );
 * ```
 * @typedef {Object} Key
 * @property {string} name
 * @property {any} value
 * @property {Set} subscriptions
 */

/**
 * key subscriptions:
 * ```js
 * const aKey = router.keys.aKey;
 * $aKey // fired if value of aKey changes
 * ```
 * @param {Route[]} routes
 * @param {string} base url
 * @property {Set<Node>} linkNodes nodes having their active state updated
 * @property {Route[]} routes
 * @property {Object} keys collected keys of all routes
 * @property {Object} params value mapping from keys (from current route)
 * @property {Route} route current
 * @property {Transition} transition ongoing transition
 * @property {string} base url
 */
class BaseRouter {
  constructor(routes, base) {
    let route;

    this.routes = routes;

    const keys = {};
    const params = {};

    Object.defineProperties(this, {
      base: { value: base },
      linkNodes: { value: new Set() },
      subscriptions: { value: new Set() },
      keys: { value: keys },
      params: {
        set(np) {
          for (const key of Object.keys(keys)) {
            const value = np[key];
            if (params[key] !== value) {
              if (value === undefined) {
                delete params[key];
              } else {
                params[key] = value;
              }
              const k = keys[key];
              k.value = value;
            }
          }
        },
        get() {
          return params;
        }
      },
      route: {
        get() {
          return route;
        },
        set(value) {
          if (route !== value) {
            route = value;
            this.notifySubscriptions();
          }
        }
      }
    });

    this.compile();

    window.addEventListener(NAVIGATION_EVENT, event =>
      this.push(event.detail.path)
    );

    window.addEventListener("popstate", event =>
      this.replace(window.location.pathname.slice(this.base.length))
    );
  }

  compile() {
    this.routes = compile(this.routes);

    for (const route of this.routes) {
      route.keys.forEach(key => {
        if (!this.keys[key]) {
          this.keys[key] = nameValueStore(key);
        }
      });
    }
  }

  /**
   * Current component.
   * Either from a redirected transition or from the current route
   * @return {SvelteComponent}
   */
  get component() {
    for (const o of [this.transition, this.route]) {
      if (o !== undefined && o.component !== undefined) {
        return o.component;
      }
    }
  }

  /**
   * Value if the current route
   * @return {any}
   */
  get value() {
    return this.route ? this.route.value : undefined;
  }

  get path() {
    return window.location.pathname.slice(this.base.length);
  }

  /**
   * Replace current route
   * @param {string} path
   * @return {Object} former state
   */
  replace(path) {
    const formerState = this.state;

    this.state = matcher(this.routes, path);

    return formerState;
  }

  get state() {
    return {
      params: { ...this.params },
      route: this.route
    };
  }

  set state(state) {
    this.params = state.params;
    this.route = state.route;
  }

  /**
   * Leave current route and enter route for given path.
   * The work is done by a Transition
   * @param {string} path where to go
   * @return {Transition} running transition
   */
  async push(path) {
    this.transition = new Transition(this, path);
    return this.transition.start();
  }

  /**
   * Called from a transition to manifest the new destination.
   * If path is undefined the transition has been aborderd
   * @param {string} path
   */
  finalizePush(path) {
    this.transition = undefined;

    if (path !== undefined) {
      history.pushState(undefined, undefined, this.base + path);
    }

    this.notifySubscriptions();

    this.linkNodes.forEach(n => this.updateActive(n));
  }

  /**
   * Continue a transition to its original destination.
   * Shortcut for this.transition.continue().
   * If there is no transition ongoing and a fallbackPath is
   * present it will be entered.
   * Otherwise does nothing.
   * @param {string} fallbackPath
   */
  async continue(fallbackPath) {
    if (this.transition) {
      return this.transition.continue();
    }
    if (fallbackPath) {
      return this.push(fallbackPath);
    }
  }

  /**
   * Abort a transition.
   * Shortcut for this.transition.abort()
   * If there is no transition ongoing and a fallbackPath is
   * present it will be entered.
   * Otherwise does nothing.
   * @param {string} fallbackPath
   */
  async abort(fallbackPath) {
    if (this.transition) {
      return this.transition.abort();
    }
    if (fallbackPath) {
      return this.push(fallbackPath);
    }
  }

  /**
   * Router subscription.
   * Changes in the current route will trigger a update
   * @param {Function} subscription
   */
  subscribe(subscription) {
    this.subscriptions.add(subscription);
    subscription(this);
    return () => this.subscriptions.delete(subscription);
  }

  notifySubscriptions() {
    this.subscriptions.forEach(subscription => subscription(this));
  }

  /**
   * Update the active state of a node
   * @param {Node} node
   */
  updateActive(node) {
    node.classList.remove("active");

    const href = node.getAttribute("href");

    if (this.path === href) {
      node.classList.add("active");
    }
  }

  /**
   * Add a new Route.
   * @param {Route} route
   */
  addRoute(route) {
    this.routes.push(route);
    this.compile();
  }

  /**
   * Find Route for a given object
   * @param {Object} object
   * @return {Route} able to support given object
   */
  routeFor(object) {
    for (let i = this.routes.length - 1; i >= 0; i--) {
      const r = this.routes[i];
      if (r.propertiesFor(object)) {
        return r;
      }
    }
  }

  error(err) {
    console.error(err);
  }
}

/* node_modules/svelte-guard-history-router/src/components/Router.svelte generated by Svelte v3.29.4 */

function create_fragment(ctx) {
	let current;
	const default_slot_template = /*#slots*/ ctx[4].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);

	return {
		c() {
			if (default_slot) default_slot.c();
		},
		m(target, anchor) {
			if (default_slot) {
				default_slot.m(target, anchor);
			}

			current = true;
		},
		p(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && dirty & /*$$scope*/ 8) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[3], dirty, null, null);
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
			if (default_slot) default_slot.d(detaching);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let { router = undefined } = $$props;
	let { routes = [] } = $$props;
	let { base = "" } = $$props;

	if (router === undefined) {
		router = new BaseRouter(routes, base);
	}

	setContext(ROUTER, router);
	onMount(() => router.push(window.location.pathname.slice(base.length)));

	$$self.$$set = $$props => {
		if ("router" in $$props) $$invalidate(0, router = $$props.router);
		if ("routes" in $$props) $$invalidate(1, routes = $$props.routes);
		if ("base" in $$props) $$invalidate(2, base = $$props.base);
		if ("$$scope" in $$props) $$invalidate(3, $$scope = $$props.$$scope);
	};

	return [router, routes, base, $$scope, slots];
}

class Router extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { router: 0, routes: 1, base: 2 });
	}
}

/* node_modules/svelte-guard-history-router/src/components/Link.svelte generated by Svelte v3.29.4 */

function create_fragment$1(ctx) {
	let a;
	let current;
	let mounted;
	let dispose;
	const default_slot_template = /*#slots*/ ctx[3].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);

	return {
		c() {
			a = element("a");
			if (default_slot) default_slot.c();
			attr(a, "href", /*href*/ ctx[0]);
		},
		m(target, anchor) {
			insert(target, a, anchor);

			if (default_slot) {
				default_slot.m(a, null);
			}

			current = true;

			if (!mounted) {
				dispose = listen(a, "click", prevent_default(/*click*/ ctx[1]));
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && dirty & /*$$scope*/ 4) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[2], dirty, null, null);
				}
			}

			if (!current || dirty & /*href*/ 1) {
				attr(a, "href", /*href*/ ctx[0]);
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
			if (detaching) detach(a);
			if (default_slot) default_slot.d(detaching);
			mounted = false;
			dispose();
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let { href } = $$props;

	function click(e) {
		const ct = e.currentTarget;
		window.dispatchEvent(new CustomEvent(NAVIGATION_EVENT, { detail: { path: ct.pathname + ct.hash } }));
	}

	$$self.$$set = $$props => {
		if ("href" in $$props) $$invalidate(0, href = $$props.href);
		if ("$$scope" in $$props) $$invalidate(2, $$scope = $$props.$$scope);
	};

	return [href, click, $$scope, slots];
}

class Link extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$1, create_fragment$1, safe_not_equal, { href: 0 });
	}
}

/* node_modules/svelte-guard-history-router/src/components/ObjectLink.svelte generated by Svelte v3.29.4 */
const get_noFound_slot_changes = dirty => ({});
const get_noFound_slot_context = ctx => ({});

// (28:0) {:else}
function create_else_block(ctx) {
	let current;
	const noFound_slot_template = /*#slots*/ ctx[4].noFound;
	const noFound_slot = create_slot(noFound_slot_template, ctx, /*$$scope*/ ctx[5], get_noFound_slot_context);

	return {
		c() {
			if (noFound_slot) noFound_slot.c();
		},
		m(target, anchor) {
			if (noFound_slot) {
				noFound_slot.m(target, anchor);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (noFound_slot) {
				if (noFound_slot.p && dirty & /*$$scope*/ 32) {
					update_slot(noFound_slot, noFound_slot_template, ctx, /*$$scope*/ ctx[5], dirty, get_noFound_slot_changes, get_noFound_slot_context);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(noFound_slot, local);
			current = true;
		},
		o(local) {
			transition_out(noFound_slot, local);
			current = false;
		},
		d(detaching) {
			if (noFound_slot) noFound_slot.d(detaching);
		}
	};
}

// (21:0) {#if href}
function create_if_block(ctx) {
	let link;
	let current;

	link = new Link({
			props: {
				href: /*href*/ ctx[1],
				$$slots: { default: [create_default_slot] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(link.$$.fragment);
		},
		m(target, anchor) {
			mount_component(link, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const link_changes = {};
			if (dirty & /*href*/ 2) link_changes.href = /*href*/ ctx[1];

			if (dirty & /*$$scope, object*/ 33) {
				link_changes.$$scope = { dirty, ctx };
			}

			link.$set(link_changes);
		},
		i(local) {
			if (current) return;
			transition_in(link.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(link.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(link, detaching);
		}
	};
}

// (23:4) {#if route.linkComponent}
function create_if_block_1(ctx) {
	let switch_instance;
	let switch_instance_anchor;
	let current;
	var switch_value = /*route*/ ctx[2].linkComponent;

	function switch_props(ctx) {
		return { props: { object: /*object*/ ctx[0] } };
	}

	if (switch_value) {
		switch_instance = new switch_value(switch_props(ctx));
	}

	return {
		c() {
			if (switch_instance) create_component(switch_instance.$$.fragment);
			switch_instance_anchor = empty();
		},
		m(target, anchor) {
			if (switch_instance) {
				mount_component(switch_instance, target, anchor);
			}

			insert(target, switch_instance_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const switch_instance_changes = {};
			if (dirty & /*object*/ 1) switch_instance_changes.object = /*object*/ ctx[0];

			if (switch_value !== (switch_value = /*route*/ ctx[2].linkComponent)) {
				if (switch_instance) {
					group_outros();
					const old_component = switch_instance;

					transition_out(old_component.$$.fragment, 1, 0, () => {
						destroy_component(old_component, 1);
					});

					check_outros();
				}

				if (switch_value) {
					switch_instance = new switch_value(switch_props(ctx));
					create_component(switch_instance.$$.fragment);
					transition_in(switch_instance.$$.fragment, 1);
					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
				} else {
					switch_instance = null;
				}
			} else if (switch_value) {
				switch_instance.$set(switch_instance_changes);
			}
		},
		i(local) {
			if (current) return;
			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
			current = true;
		},
		o(local) {
			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(switch_instance_anchor);
			if (switch_instance) destroy_component(switch_instance, detaching);
		}
	};
}

// (22:2) <Link {href}>
function create_default_slot(ctx) {
	let t;
	let current;
	let if_block = /*route*/ ctx[2].linkComponent && create_if_block_1(ctx);
	const default_slot_template = /*#slots*/ ctx[4].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[5], null);

	return {
		c() {
			if (if_block) if_block.c();
			t = space();
			if (default_slot) default_slot.c();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, t, anchor);

			if (default_slot) {
				default_slot.m(target, anchor);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (/*route*/ ctx[2].linkComponent) if_block.p(ctx, dirty);

			if (default_slot) {
				if (default_slot.p && dirty & /*$$scope*/ 32) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[5], dirty, null, null);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (if_block) if_block.d(detaching);
			if (detaching) detach(t);
			if (default_slot) default_slot.d(detaching);
		}
	};
}

function create_fragment$2(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block, create_else_block];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*href*/ ctx[1]) return 0;
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

function instance$2($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let { object } = $$props;
	let { suffix = "" } = $$props;
	const router = getContext(ROUTER);
	const route = router.routeFor(object);
	let href;

	if (route !== undefined) {
		const properties = route.propertiesFor(object);
		href = route.path.replace(/:(\w+)/g, (m, name) => properties[name]) + suffix;
	}

	$$self.$$set = $$props => {
		if ("object" in $$props) $$invalidate(0, object = $$props.object);
		if ("suffix" in $$props) $$invalidate(3, suffix = $$props.suffix);
		if ("$$scope" in $$props) $$invalidate(5, $$scope = $$props.$$scope);
	};

	return [object, href, route, suffix, slots, $$scope];
}

class ObjectLink extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$2, create_fragment$2, safe_not_equal, { object: 0, suffix: 3 });
	}
}

function asArray(value) {
  return Array.isArray(value) ? value : [value];
}

/**
 * Create properties from options and default options
 * Already present properties (direct) are skipped
 * @see Object.definedProperties()
 * @see Object.hasOwnProperty()
 * @param {Object} object target object
 * @param {Object} options as passed to object constructor
 * @param {Object} properties object properties
 */
function definePropertiesFromOptions(
  object,
  options = {},
  properties = {}
) {
  const after = {};
  const attributes = object.constructor.attributes;
  if (attributes !== undefined) {
    Object.entries(attributes).forEach(([name, attribute]) => {
      if (properties[name] !== undefined && properties[name].value) {
        return;
      }

      let value = options[name];
      if (value === undefined) {
        value = attribute.default;
      }

      if (value === undefined) {
        return;
      }

      if (attribute.set) {
        value = attribute.set(value);
      } else {
        switch (attribute.type) {
          case "boolean":
            value =
              value === 0 || value === "0" || value === false ? false : true;
            break;
        }
      }

      if (
        object.hasOwnProperty(name) ||
        name === "merged" // TODO hack
        /*|| object.constructor.prototype[name] !== undefined*/
      ) {
        after[name] = value;
        return;
      }

      const path = name.split(/\./);
      let key = path[0];

      if (properties[key] === undefined) {
        if (path.length === 1) {
          properties[key] = { value };
          return;
        }
        properties[key] = { value: {} };
      } else {
        if (path.length === 1) {
          after[name] = value;
          return;
        }
      }

      // TODO only 2 levels for now
      properties[key].value[path[1]] = value;

      /*
      for (let n = 0; n < path.length; n++) {
        key = path[n];

        if (parent[key] === undefined) {
          parent[key] = {};
        }
        parent = parent[key];
      }
     parent[key] = value;
*/
    });
  }

  Object.defineProperties(object, properties);
  Object.assign(object, after);
}

/**
 * Create json based on present options.
 * In other words only produce key value pairs if value is defined.
 * @param {Object} object
 * @param {Object} initial
 * @param {string[]} skip keys not to put in the result
 * @return {Object} initial + defined values
 */
function optionJSON(object, initial = {}, skip = []) {
  return Object.keys(object.constructor.attributes || {})
    .filter(key => skip.indexOf(key) < 0)
    .reduce((a, c) => {
      const value = object[c];
      if (value !== undefined && !(value instanceof Function)) {
        a[c] = value;
      }
      return a;
    }, initial);
}

/**
 * Rename attributes.
 * Filters out null, undefined and empty strings
 * @param {Object} object
 * @param {Object} mapping
 * @return {Object} keys renamed after mapping
 */
function mapAttributes(object, mapping) {
  return object === undefined
    ? undefined
    : Object.fromEntries(
        Object.entries(object)
          .filter(
            ([name, value]) =>
              value !== undefined && value !== null && value !== ""
          )
          .map(([name, value]) => [mapping[name] ? mapping[name] : name, value])
      );
}

/**
 * @param {Object} options
 */
class BaseObject {
  /**
   * options
   */
  static get attributes() {
    return {
      /**
       * The description of the repository content.
       * @return {string}
       */
      description: {
        type: "string",
        description: "human readable description"
      },

      /**
       * Unique id within the provider.
       * @return {string}
       */
      id: { type: "string" },

      /**
       * Unique id.
       * @return {string}
       */
      uuid: { type: "string" },

      /**
       * Avatar.
       * @return {string}
       */
      avatarURL: { type: "url" },

      homePageURL: { type: "url" }
    };
  }

  /**
   * Map attributes between external and internal representation
   * @return {Object}
   */
  static get attributeMapping() {
    return {};
  }

  constructor(options, additionalProperties) {
    definePropertiesFromOptions(
      this,
      mapAttributes(options, this.constructor.attributeMapping),
      additionalProperties
    );
  }

  /**
   * Check for equality
   * @param {BaseObject} other
   * @return {boolean} true if other is present
   */
  equals(other) {
    return other !== undefined;
  }
}

/**
 * @param {string} name
 * @param {Object} options
 *
 * @property {string} name
 */
class NamedObject extends BaseObject {
  constructor(name, options, additionalProperties) {
    super(options, {
      name: { value: name },
      ...additionalProperties
    });
  }

  /**
   * Check for equality
   * @param {NamedObject} other
   * @return {boolean} true if names are equal
   */
  equals(other) {
    return super.equals(other) && this.name === other.name;
  }

  get displayName() {
    return this.name;
  }

  toString() {
    return this.mame;
  }

  /**
   * Provide name and all defined attributes
   */
  toJSON() {
    return optionJSON(this, {
      name: this.name
    });
  }
}

/**
 * Abstract pull request
 * {@link Repository#addPullRequest}
 * @param {Branch} source merge source
 * @param {Branch} destination merge target
 * @param {string} name
 * @param {Object} options
 * @param {string} [options.title]
 * @param {string} [options.state]
 * @param {boolean} [options.merged]
 * @param {boolean} [options.locked]

 * @property {string} name
 * @property {Branch} source
 * @property {Branch} destination
 * @property {string} [title]
 * @property {string} [state]
 * @property {boolean} [merged]
 * @property {boolean} [locked]
 */
class PullRequest extends NamedObject {
  /**
   * All valid states
   * @return {Set<string>} valid states
   */
  static get validStates() {
    return new Set(["OPEN", "MERGED", "CLOSED"]);
  }

  /**
   * States to list pull request by default
   * @return {Set<string>} states to list by default
   */
  static get defaultListStates() {
    return new Set(["OPEN"]);
  }

  /**
   * All valid merge methods
   * @return {Set<string>} valid merge methods
   */
  static get validMergeMethods() {
    return new Set(/*["MERGE", "SQUASH", "REBASE"]*/);
  }

  /**
   * List all pull request for a given repo
   * result will be filtered by source branch, destination branch and states
   * @param {Repository} repository
   * @param {Object} filter
   * @param {Branch?} filter.source
   * @param {Branch?} filter.destination
   * @param {Set<string>?} filter.states
   * @return {Iterator<PullRequest>}
   */
  static async *list(repository, filter) {}

  /**
   * Open a pull request
   *
   * @param {Branch} source
   * @param {Branch} destination
   * @param {Object} options
   */
  static async open(source, destination, options) {
    return new this(source, destination, "-1", options);
  }

  static get attributes() {
    return {
      ...super.attributes,
      /**
       * the one line description of the pull request.
       * @return {string}
       */
      title: { type: "string" },

      /**
       * the description of the pull request.
       * @return {string}
       */
      body: { type: "string" },

      /**
       * state of the pull request.
       * - OPEN
       * - MERGED
       * - CLOSED
       * @return {string}
       */
      state: {
        default: "OPEN",
        type: "string"
      },

      /**
       * locked state of the pull request.
       * @return {boolean}
       */
      locked: {
        type: "boolean",
        default: false
      },

      /**
       * merged state of the pull request.
       * @return {boolean}
       */
      merged: {
        type: "boolean",
        default: false
      },

      draft: {
        type: "boolean",
        default: false
      }
    };
  }

  constructor(source, destination, name, options) {
    let state;

    super(name, options, {
      source: { value: source },
      destination: { value: destination },
      state: {
        set(value) {
          value = value.toUpperCase();
          if (this.constructor.validStates.has(value)) {
            state = value;
          } else throw new Error(`Invalid Pull Request state ${value}`);
        },
        get() {
          return state;
        }
      }
    });

    if (destination !== undefined) {
      destination._addPullRequest(this);
    }
  }

  set merged(flag) {
    if (flag) {
      this.state = "MERGED";
    }
  }

  get merged() {
    return this.state === "MERGED";
  }

  get number() {
    return this.name;
  }

  /**
   * @return {Repository} destination repository
   */
  get repository() {
    return this.destination === undefined
      ? undefined
      : this.destination.repository;
  }

  /**
   * @return {Provider}
   */
  get provider() {
    return this.destination === undefined
      ? undefined
      : this.destination.provider;
  }

  /**
   * Check for equality
   * @param {PullRequest} other
   * @return {boolean} true if number and repository are equal
   */
  equals(other) {
    return super.equals(other) && this.repository.equals(other.repository);
  }

  async write() {
    this._write();
  }

  async _write() {}

  /**
   * Delete the pull request from the {@link Repository}.
   * @see {@link Repository#deletePullRequest}
   * @return {Promise}
   */
  async delete() {
    return this.destination === undefined
      ? undefined
      : this.destination.deletePullRequest(this.number);
  }

  /**
   * Merge the pull request
   * @param {string} method
   */
  async merge(method) {
    method = method.toUpperCase();
    if (this.constructor.validMergeMethods.has(method)) {
      await this._merge(method);
      this.merged = true;
    } else {
      throw new Error(`Merging with ${method} is not supported`);
    }
  }

  /**
   * Decline the pull request
   */
  async decline() {}

  /**
   * @return {Interaor<Review>}
   */
  async * reviews() {
  }

  toString() {
    return [
      [this.name, this.title],
      ["source", this.source.identifier],
      ["destination", this.destination.identifier],
      ...Object.keys(this.constructor.attributes)
        .filter(
          k =>
            k !== "id" && k !== "title" && k !== "body" && this[k] !== undefined
        )
        .map(k => [k, this[k]])
    ]
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }

  toJSON() {
    return optionJSON(this, {
      source: this.source,
      destination: this.destination,
      name: this.name
    });
  }

  /**
   * Short human readable identifier with provider and branch.
   * @return {string}
   */
  get identifier() {
    return `${this.destination.identifier}[${this.name}]`;
  }
}

/**
 * Match entries against glob pattern
 * @param {Iterator<string|Object>} entries
 * @param {string[]|string} patterns
 * @param {Object} options
 * @param {string|Function} options.name
 * @param {boolean} options.caseSensitive defaults to true
 * @return {Iterator<string>} filtered entries
 */
function* matcher$1(entries, patterns, options = {}) {
  if (
    patterns === undefined ||
    (Array.isArray(patterns) && patterns.length === 0)
  ) {
    yield* entries;
    return;
  }

  const regex = compile$1(
    Array.isArray(patterns) ? patterns : [patterns],
    options
  );

  if (options.name) {
    const name = options.name;
    for (const entry of entries) {
      if (entry[name].match(regex)) {
        yield entry;
      }
    }
  } else {
    for (const entry of entries) {
      if (entry.match(regex)) {
        yield entry;
      }
    }
  }
}

function compileSimple(input) {
  let output = "";

  for (let i = 0; i < input.length; i++) {
    const s = input[i];
    switch (s) {
      case ".":
        output += "\\.";
        break;
      case "*":
        output += ".*";
        if (input[i + 1] === "*") {
          i += input[i + 2] === "/" ? 2 : 1;
        }
        break;
      case "/":
        output += "\\/";
        break;
      default:
        output += s;
    }
  }
  return output;
}

function compile$1(patterns, options) {
  const parts = [];

  for (const pattern of patterns) {
    if (pattern[0] === "!") {
      parts.push("((?!" + compileSimple(pattern.substring(1)) + ").)*");
    } else {
      parts.push(
        parts.length ? "|" + compileSimple(pattern) : compileSimple(pattern)
      );
    }
  }

  return new RegExp(
    "^" + parts.join("") + "$",
    options.caseSensitive === undefined || options.caseSensitive
      ? undefined
      : "i"
  );
}

function RepoositoryOwner(base) {
  return class RepoositoryOwner extends base {

    constructor(...args) {
        super(...args);

        Object.defineProperties(this,{ _repositories: { value: new Map() } });
      }
    
    /**
     * Normalizes a repository name
     * strips branch away
     * @param {string} name
     * @param {boolean} forLookup
     * @return {string} normalized name
     */
    normalizeRepositoryName(name, forLookup) {
      name = name.replace(/#.*$/, "");

      const parts = name.split(/\//);
      if (parts.length >= 2) {
        if (parts[parts.length - 2] === this.name) {
          name = parts[parts.length - 1];
        }
      }

      if (forLookup && !this.areRepositoryNamesCaseSensitive) {
        return name.toLowerCase();
      }

      return name;
    }

    /**
     * Lookup a repository
     * @param {string} name of the repository may contain a #branch
     * @return {Promise<Repository>}
     */
    async repository(name) {
      if (name === undefined) {
        return undefined;
      }

      await this.initializeRepositories();

      return this._repositories.get(this.normalizeRepositoryName(name, true));
    }

    /**
     * List repositories for the owner
     * @param {string[]|string} matchingPatterns
     * @return {Iterator<Repository>} all matching repositories of the owner
     */
    async *repositories(patterns) {
      await this.initializeRepositories();
      yield* matcher$1(this._repositories.values(), patterns, {
        caseSensitive: this.areRepositoryNamesCaseSensitive,
        name: "name"
      });
    }

    /**
     * Create a new {@link Repository} in the provider.
     * If there is already if repository for the given name it will be returned
     * @param {string} name
     * @param {Object} options
     * @return {Promise<Repository>} newly created repository (if not already present)
     */
    async createRepository(name, options) {
      return this.addRepository(name, options);
    }

    /**
     * Add a {@link Repository} to the group.
     * Only adds the repository to the in memory representation (does not execute any provider actions)
     * @param {string} name
     * @param {Object} options
     * @return {Promise<Repository>} newly created repository
     */
    addRepository(name, options) {
      const normalizedName = this.normalizeRepositoryName(name, true);
      let repository = this._repositories.get(normalizedName);
      if (repository === undefined) {
        repository = new this.repositoryClass(this, name, options);
        this._repositories.set(normalizedName, repository);
      }
      return repository;
    }

    /**
     * Delete a repository
     * @param {string} name
     * @return {Promise<undefined>}
     */
    async deleteRepository(name) {
      this._repositories.delete(this.normalizeRepositoryName(name, true));
    }

    initializeRepositories() {
    }
  };
}

/**
 * Base for Branch and Tag
 */
class Ref extends NamedObject {
  /**
   * options
   */
  static get attributes() {
    return {
      ...super.attributes,

      /**
       * Can the branch be modified.
       * @return {string}
       */
      isProtected: { type: "boolean" }
    };
  }

  constructor(repository, name, options) {
    super(name, options, { repository: { value: repository } });
  }

  /**
   * Check for equality
   * @param {Branch} other
   * @return {boolean} true if name and repository are equal
   */
  equals(other) {
    return super.equals(other) && this.repository.equals(other.repository);
  }

  get refType() {
    return "unknown";
  }

  /**
   * ref name
   * @return {string} git ref of the Ref
   */
  get ref() {
    return `refs/${this.refType}/${this.name}`;
  }

  /**
   * Get sha of a ref
   * @param {string} ref
   * @return {string} sha of the ref
   */
  async refId(ref = this.ref) {
    return this.repository.refId(ref);
  }

  /**
   * List entries of the branch
   * @param {string[]} matchingPatterns
   * @return {ConentEntry} all matching entries in the branch
   */
  async *entries(matchingPatterns) {}

  /**
   * List all entries of the branch
   * @return {asyncIterator<ConentEntry>} all entries in the branch
   */
  async *[Symbol.asyncIterator]() {
    return yield* this.entries();
  }

  /**
   * Get exactly one matching entry by name or undefine if no such entry is found
   * @param {string} name
   * @return {Promise<ConentEntry>}
   */
  async maybeEntry(name) {
    return (await this.entries(name).next()).value;
  }

  /**
   * Get exactly one matching entry by name (throws if entry is not found)
   * @param {string} name
   * @return {Promise<ConentEntry>}
   */
  async entry(name) {
    const e = (await this.entries(name).next()).value;
    if (e === undefined) {
      throw new Error(`No such entry '${name}'`);
    }
    return e;
  }

  /**
   * The provider we live in
   * @return {Provider}
   */
  get provider() {
    return this.repository.provider;
  }

  /**
   * Branch owner
   * By default we provide the repository owner
   * @see {@link Repository#owner}
   * @return {string}
   */
  get owner() {
    return this.repository.owner;
  }

  /**
   * Url of issue tracking system.
   * @see {@link Repository#issuesURL}
   * @return {string} as provided from the repository
   */
  get issuesURL() {
    return this.repository.issuesURL;
  }

  /**
   * Url of home page.
   * @see {@link Repository#homePageURL}
   * @return {string} as provided from the repository
   */
  get homePageURL() {
    return this.repository.homePageURL;
  }

  /**
   * Forwarded from the repository
   */
  get isLocked() {
    return this.repository.isLocked;
  }

  /**
   * Forwarded from the repository
   */
  get isArchived() {
    return this.repository.isArchived;
  }

  /**
   * Forwarded from the repository
   */
  get isDisabled() {
    return this.repository.isDisabled;
  }

  /**
   *
   * @return false
   */
  get isProtected() {
    return false;
  }

  /**
   *
   * @return true if not {@link isArchived} and {@link isDisabled} and {@link isLocked}
   */
  get isWritable()
  {
    return !this.isArchived && !this.isDisabled && !this.isLocked && !this.isProtected;
  }

}

/**
 * @typedef {Object} CommitResult
 * @property {string} ref
 */

/**
 * Abstract branch
 * @see {@link Repository#_addBranch}
 * @param {Repository} repository
 * @param {string} name
 * @param {Object} options
 *
 * @property {Repository} repository
 * @property {Provider} provider
 * @property {string} name
 */
class Branch extends Ref {
  constructor(repository, name = repository.defaultBranchName, options) {
    super(repository, name, options);
    repository._addBranch(this);
  }

  /**
   * Repository and branch name combined
   * @return {string} 'repo#branch'
   */
  get fullName() {
    return `${this.repository.fullName}#${this.name}`;
  }

  /**
   * Repository fullName and branch name combined.
   * But skipping the branch name if it is the default branch
   * @return {string} 'user/repo#branch'
   */
  get fullCondensedName() {
    return this.isDefault
      ? this.repository.fullName
      : `${this.repository.fullName}#${this.name}`;
  }

  /**
   * Short human readable identifier with provider and branch.
   * @return {string}
   */
  get identifier() {
    return `${this.provider.name}:${this.fullCondensedName}`;
  }

  toString() {
    return this.identifier;
  }

  get slug() {
    return this.repository.slug;
  }

  /**
   * Deliver repository and branch url combined
   * @return {string} 'repoUrl#branch'
   */
  get url() {
    return this.isDefault
      ? this.repository.url
      : `${this.repository.url}#${this.name}`;
  }

  get refType() {
    return "heads";
  }

  /**
   * Are we the default branch
   * @return {boolean} true if name is the repository default branch
   */
  get isDefault() {
    return this.name === this.repository.defaultBranchName;
  }

  /**
   * Delete the branch from the {@link Repository}.
   * @see {@link Repository#deleteBranch}
   * @return {Promise<undefined>}
   */
  async delete() {
    return this.repository.deleteBranch(this.name);
  }

  /**
   * Commit entries
   * @param {string} message commit message
   * @param {ConentEntry[]} updates content to be commited
   * @param {Object} options
   * @return {CommitResult}
   */
  async commit(message, updates, options) {}

  /**
   * Commit entries into a pull request.
   *
   * @param {string} message commit message
   * @param {ConentEntry[]} updates content to be commited
   * @param {Object} options
   * @param {Branch|string} options.pullRequestBranch
   * @param {boolean} options.dry do not create a branch and do not commit only create tmp pr
   * @return {PullRequest}
   */
  async commitIntoPullRequest(message, updates, options) {
    if (options.dry) {
      return new PullRequest(
        options.pullRequestBranch instanceof Branch
          ? options.pullRequestBranch
          : undefined,
        this,
        "DRY",
        options
      );
    }

    const prBranch =
      options.pullRequestBranch instanceof Branch
        ? options.pullRequestBranch
        : await this.createBranch(options.pullRequestBranch);

    try {
      await prBranch.commit(message, updates);
      return await prBranch.createPullRequest(this, options);
    } catch (e) {
      if (!options.pullRequestBranch instanceof Branch) {
        await prBranch.delete();
      }
      throw e;
    }
  }

  /**
   * Remove entries form the branch
   * @param {Iterator <ConentEntry>} entries
   */
  async removeEntries(entries) {}

  /**
   * By default we use the providers implementation.
   * @return {Class} as defined in the repository
   */
  get entryClass() {
    return this.repository.entryClass;
  }

  /**
   * Create a pull request
   * @param {Branch} toBranch
   * @param {Object} options
   * @return {Promise<PullRequest>}
   */
  async createPullRequest(toBranch, options) {
    return this.pullRequestClass.open(this, toBranch, options);
  }

  async _addPullRequest(pullRequest) {
    return this.repository._addPullRequest(pullRequest);
  }

  async deletePullRequest(name) {
    return this.repository.deletePullRequest(name);
  }

  /**
   * By default we use the repository implementation.
   * @return {Class} as defined in the repository
   */
  get pullRequestClass() {
    return this.repository.pullRequestClass;
  }

  /**
   * Create a new {@link Branch} by cloning a given source branch.
   * Simply calls Repository.createBranch() with the receiver as source branch
   * @param {string} name the new branch
   * @param {Object} options
   * @return {Promise<Branch>} newly created branch (or already present old one with the same name)
   */
  async createBranch(name, options) {
    return this.repository.createBranch(name, this, options);
  }
}

/**
 * Abstract repository collection
 * @param {Provider} provider
 * @param {string} name of the group
 * @param {Object} options
 * @param {string} [options.description] human readable description
 * @param {string} [options.id] internal id
 * @param {string} [options.uuid] internal id
 * @param {string} [options.url] home
 *
 * @property {Provider} provider
 * @property {string} name
 */

class RepositoryGroup extends RepoositoryOwner(NamedObject) {
  static get attributes() {
    return {
      ...super.attributes,

      /**
       * Type of the repository group either User or Organization.
       * @return {string}
       */
      type: { type: "string" },

      /**
       * api url
       */
      url: { type: "url" }
    };
  }

  /**
   * Map attributes between external and internal representation
   */
  static get attributeMapping() {
    return {};
  }

  constructor(provider, name, options) {
    super(name, options, {
      provider: { value: provider }
    });
  }

  get areRepositoryNamesCaseSensitive() {
    return this.provider.areRepositoryNamesCaseSensitive;
  }

  get areRepositoryGroupNamesCaseSensitive() {
    return this.provider.areRepositoryGroupNamesCaseSensitive;
  }

  /**
   * By default we use the providers implementation.
   * @return {Class} as defined in the provider
   */
  get repositoryClass() {
    return this.provider.repositoryClass;
  }

  /**
   * By default we use the providers implementation.
   * @return {Class} as defined in the provider
   */
  get branchClass() {
    return this.provider.branchClass;
  }

  /**
   * By default we use the providers implementation.
   * @return {Class} as defined in the provider
   */
  get contentClass() {
    return this.provider.contentClass;
  }

  /**
   * By default we use the providers implementation.
   * @return {Class} as defined in the provider
   */
  get pullRequestClass() {
    return this.provider.pullRequestClass;
  }


  /**
   * Lookup a branch
   * First lookup repository then the branch
   * If no branch was specified then the default branch will be delivered.
   * @see {@link Repository#defaultBranch}
   * @param {string} name with optional branch name as '#myBranchName'
   * @return {Promise<Branch|undefined>}
   */
  async branch(name) {
    if (name === undefined) {
      return undefined;
    }

    const [repoName, branchName] = name.split(/#/);
    const repository = await this.repository(repoName);

    if (repository === undefined) {
      return undefined;
    }

    return branchName === undefined
      ? repository.defaultBranch
      : repository.branch(branchName);
  }

  /**
   * List branches for the owner
   * @param {string[]|string} patterns
   * @return {Iterator<Branch>} all matching branches of the owner
   */
  async *branches(patterns) {
    const [repoPatterns, branchPatterns] = patterns.split(/#/);

    await this.initializeRepositories();

    for (const name of matcher$1(this._repositories.keys(), repoPatterns, {
      caseSensitive: this.areRepositoriesCaseSensitive
    })) {
      const repository = this._repositories.get(name);
      const branch =
        branchPatterns === undefined
          ? repository.defaultBranch
          : repository.branch(branchPatterns);
      if (branch !== undefined) {
        yield branch;
      }
    }
  }

  async tag(name) {}

  async *tags(patterns) {}
}

/**
 * Abstract repository
 * @param {Owner} owner
 * @param {string} name (#branch) will be removed
 * @param {Object} options
 * @param {string} [options.description] human readable description
 * @param {string} [options.id] internal id
 *
 * @property {Owner} owner
 * @property {string} name without (#branch)
 * @property {string} [description] from options.description
 * @property {string} [id] from options.id
 * @property {Map<string,Branch>} branches
 * @property {Map<string,PullRequest>} pullRequests
 */
class Repository extends NamedObject {
  /**
   * options
   */
  static get attributes() {
    return {
      ...super.attributes,

      /**
       * The name of the default branch
       * @return {string}
       */
      defaultBranchName: { type: "string", default: "master" },

      /**
       * URLs of the repository
       * @return {string[]}
       */
      urls: {},

      cloneURL: { type: "url" },

      /**
       * The url of home page.
       * @return {string}
       */
      homePageURL: { type: "url" },

      /**
       * The url of issue tracking system.
       * @return {string}
       */
      issuesURL: { type: "url" },
      size: { type: "integer" },
      language: { type: "string" },
      isArchived: { type: "boolean", default: false },
      isLocked: { type: "boolean", default: false },
      isDisabled: { type: "boolean", default: false },
      isTemplate: { type: "boolean", default: false },
      isFork: { type: "boolean", default: false }
    };
  }

  constructor(owner, name, options) {
    super(owner.normalizeRepositoryName(name, false), options, {
      owner: { value: owner },
      _branches: { value: new Map() },
      _tags: { value: new Map() },
      _pullRequests: { value: new Map() },
      _hooks: { value: [] }
    });
  }

  /**
   * Full repository name within the provider
   * @return {string} full repo name
   */
  get fullName() {
    return this.owner === this.provider ||
      this.owner.name === undefined ||
      this.owner.name === ""
      ? this.name
      : [this.owner.name, this.name].join("/");
  }

  /**
   * url name of the repo
   * @return {string}
   */
  get slug() {
    return `${this.owner.name}/${this.name}`;
  }

  /**
   * The owners provider
   * @return {Provider}
   */
  get provider() {
    return this.owner.provider;
  }

  /**
   * Short human readable identifier with provider and branch.
   * @return {string}
   */
  get identifier() {
    return `${this.provider.name}:${this.fullName}`;
  }

  /**
   * Check for equality
   * @param {Repository} other
   * @return {boolean} true if name and provider are equal
   */
  equals(other) {
    if (other === undefined) {
      return false;
    }

    return (
      this.fullName === other.fullName && this.provider.equals(other.provider)
    );
  }

  /**
   * Lookup entries form the head of the default branch
   * {@link Branch#entry}
   * @return {Entry}
   */
  async entry(name) {
    return (await this.defaultBranch).entry(name);
  }

  /**
   * List entries of the default branch
   * @param {string[]} matchingPatterns
   * @return {Entry} all matching entries in the branch
   */
  async *entries(matchingPatterns) {
    yield* (await this.defaultBranch).entries(matchingPatterns);
  }

  /**
   * Get exactly one matching entry by name or undefined if no such entry is found
   * @param {string} name
   * @return {Promise<Entry>}
   */
  async maybeEntry(name) {
    return (await this.defaultBranch).maybeEntry(name);
  }

  /**
   * urls to access the repo
   * @return {string[]}
   */
  get urls() {
    return [];
  }

  /**
   * Preffered url to access the repo
   * @return {string}
   */
  get url() {
    return this.urls[0];
  }

  /**
   * The url used fro cloning the repo.
   * @return {string}
   */
  get cloneURL() {
    return this.url;
  }

  /**
   * The url of issue tracking system.
   * @return {string}
   */
  get issuesURL() {
    return undefined;
  }

  /**
   * The url of home page.
   * @return {string}
   */
  get homePageURL() {
    return undefined;
  }

  /**
   * Name without owner
   * @return {string} name
   */
  get condensedName() {
    return this.name;
  }

  /**
   * By default we are not archived
   * @return {boolean} false
   */
  get isArchived() {
    return false;
  }

  /**
   * By default we are not locked
   * @return {boolean} false
   */
  get isLocked() {
    return false;
  }

  /**
   * By default we are not disabled
   * @return {boolean} false
   */
  get isDisabled() {
    return false;
  }

  /**
   * By default we are not a template
   * @return {boolean} false
   */
  get isTemplate() {
    return false;
  }

  /**
   * Lookup branch by name
   * @param {string} name
   * @return {Promise<Branch>}
   */
  async branch(name) {
    await this.initializeBranches();
    return this._branches.get(name);
  }

  /**
   * Lookup the default branch
   * @return {Promise<Branch>} branch named after defaultBranchName
   */
  get defaultBranch() {
    return this.branch(this.defaultBranchName);
  }

  /**
   * @return {Iterator<Branch>} of all branches
   */
  async *branches(patterns) {
    await this.initializeBranches();
    yield* matcher$1(this._branches.values(), patterns, {
      name: "name"
    });
  }

  /**
   * Create a new {@link Branch} by cloning a given source branch
   * @param {string} name of the new branch
   * @param {Branch} source branch defaults to the defaultBranch
   * @param {Object} options
   * @return {Promise<Branch>} newly created branch (or already present old one with the same name)
   */
  async createBranch(name, source, options) {
    await this.initializeBranches();
    return this.addBranch(name, options);
  }

  /**
   * Add a new {@link Branch}.
   * Internal branch creation does not call repository.initialize()
   * @param {string} name of the new branch
   * @param {Object} options
   * @return {Promise<Branch>} newly created branch
   */
  addBranch(name, options) {
    let branch = this._branches.get(name);
    if (branch === undefined) {
      branch = new this.branchClass(this, name, options);
    }

    return branch;
  }

  _addBranch(branch) {
    this._branches.set(branch.name, branch);
  }

  /**
   * Delete a {@link Branch}
   * @param {string} name of the branch
   * @return {Promise<undefined>}
   */
  async deleteBranch(name) {
    this._branches.delete(name);
  }

  _addTag(tag) {
    this._tags.set(tag.name, tag);
  }

  /**
   * @param {string|string[]} patterns
   * @return {Iterator<Tag>} of all tags
   */
  async *tags(patterns) {
    await this.initializeTags();

    yield* matcher$1(this._tags.values(), patterns, {
      name: "name"
    });
  }

  /**
   * @param {string} name
   * @return {Tag}
   */
  async tag(name) {
    await this.initializeTags();
    return this._tags.get(name);
  }

  /**
   * Delete the repository from the {@link Provider}.
   * {@link Provider#deleteRepository}
   * @return {Promise<undefined>}
   */
  async delete() {
    return this.owner.deleteRepository(this.name);
  }

  /**
   * Create a pull request (or deliver an already present for thefiven name)
   * @param {string} name of the pr
   * @param {Branch} source branch
   * @param {Object} options
   * @return {PullRequest}
   */
  async createPullRequest(name, source, options) {
    await this.initializePullRequests();
    return this.addPullRequest(name, source, options);
  }

  /**
   * Add a pull request
   * @param {string} name
   * @param {Branch} source
   * @param {Object} options
   * @return {PullRequest}
   */
  addPullRequest(name, source, options) {
    let pr = this._pullRequests.get(name);
    if (pr === undefined) {
      pr = new this.pullRequestClass(name, source, this, options);
      this._pullRequests.set(pr.name, pr);
    }
    return pr;
  }

  _addPullRequest(pr) {
    this._pullRequests.set(pr.name, pr);
  }

  /**
   * Deliver all {@link PullRequest}s
   * @return {Iterator<PullRequest>} of all pull requests
   */
  async *pullRequests() {
    await this.initializePullRequests();

    for (const pr of this._pullRequests.values()) {
      yield pr;
    }
  }

  /**
   * The @{link PullRequest} for a given name
   * @param {string} name
   * @return {Promise<PullRequest>}
   */
  async pullRequest(name) {
    await this.initializePullRequests();
    return this._pullRequests.get(name);
  }

  /**
   * Delete a {@link PullRequest}
   * @param {string} name
   * @return {Promise}
   */
  async deletePullRequest(name) {
    this._pullRequests.delete(name);
  }

  /**
   * Add a hook
   * @param {Hook} hook
   */
  addHook(hook) {
    this._hooks.push(hook);
  }

  _addHook(hook) {
    this._hooks.push(hook);
  }

  /**
   * Add a hook
   * @param {Hook} hook
   */
  async createHook(hook) {
    this.addHook(hook);
  }

  /**
   * List hooks
   * @return {Hook} all hooks of the repository
   */
  async *hooks() {
    await this.initializeHooks();
    for (const hook of this._hooks) {
      yield hook;
    }
  }

  /**
   * Get Hook
   * @param {string|number} id
   * @return {Hook} for the given id
   */
  async hook(id) {
    for await (const hook of this.hooks()) {
      if (hook.id == id) {
        // string of number
        return hook;
      }
    }
  }

  /**
   * @return {string} 'git'
   */
  get type() {
    return "git";
  }

  /**
   * Get sha of a ref
   * @param {string} ref
   * @return {string} sha of the ref
   */
  async refId(ref) {
    return undefined;
  }

  /**
   * By default we use the providers implementation.
   * @return {Class} as defined in the provider
   */
  get repositoryClass() {
    return this.provider.repositoryClass;
  }

  /**
   * By default we use the providers implementation.
   * @return {Class} as defined in the provider
   */
  get pullRequestClass() {
    return this.provider.pullRequestClass;
  }

  /**
   * By default we use the providers implementation.
   * @return {Class} as defined in the provider
   */
  get branchClass() {
    return this.provider.branchClass;
  }

  /**
   * By default we use the providers implementation.
   * @return {Class} as defined in the provider
   */
  get entryClass() {
    return this.provider.entryClass;
  }

  /**
   * By default we use the providers implementation.
   * @return {Class} as defined in the provider
   */
  get hookClass() {
    return this.provider.hookClass;
  }

  toString() {
    return this.fullName;
  }

  /**
   * Provide name and all defined attributes
   */
  toJSON() {
    return optionJSON(this, {
      name: this.name,
      fullName: this.fullName,
      urls: this.urls
    });
  }

  initialize() {}

  initializeHooks() {
    return this.initialize();
  }

  initializeBranches() {
    return this.initialize();
  }

  initializeTags() {
    return this.initialize();
  }

  async initializePullRequests() {
    for await (const pr of this.pullRequestClass.list(this)) {
      this._pullRequests.set(pr.name, pr);
    }
  }
}

/**
 * @property {Repository} repository
 * @property {URL} url
 * @property {Set<string>} events
 */
class Hook extends BaseObject {
  static get attributes() {
    return {
      ...super.attributes,
      name: { type: "string" },
      url: { type: "url", description: "target url" },
      secret: { type: "string", private: true },
      content_type: { type: "string", default: "json" },
      insecure_ssl: { type: "boolean", default: false },
      active: { type: "boolean", default: true }
    };
  }

  constructor(repository, id, events = new Set(["*"]), options) {
    super(options, {
      id: { value: id },
      repository: { value: repository },
      events: { value: events }
    });

    repository._addHook(this);
  }

  get displayName() {
    return this.id;
  }
  
  /**
   * Check for equality
   * @param {Hook} other
   * @return {boolean} true if name and repository are equal
   */
  equals(other) {
    return super.equals(other) && this.repository.equals(other.repository);
  }

  /**
   * provide name, events and all defined attributes
   */
  toJSON() {
    return optionJSON(this, { id: this.id, events: [...this.events] });
  }
}

/**
 *
 */
class BaseProvider {
  /**
   * Extract options suitable for the constructor
   * form the given set of environment variables
   * @param {Object} env taken from process.env
   * @return {Object} undefined if no suitable environment variables have been found
   */
  static optionsFromEnvironment(env) {
    if (env === undefined) {
      return undefined;
    }

    const attributes = this.attributes;
    let options;

    for (let [envName, value] of Object.entries(env)) {
      for (const [name, attribute] of Object.entries(attributes)) {
        if (asArray(attribute.env).find(e => e === envName)) {
          if (options === undefined) {
            options = {};
          }
          options[name] = value;
          Object.assign(options, attribute.additionalAttributes);
          break;
        }
      }
    }

    return options;
  }

  /**
   * Check if given options are sufficient to create a provider
   * @param {Object} options
   * @return {boolean} true if options ar sufficient to construct a provider
   */
  static areOptionsSufficcient(options) {
    for (const [name, attribute] of Object.entries(this.attributes).filter(
      ([name, attribute]) => attribute.mandatory
    )) {
      if (options[name] === undefined) {
        return false;
      }
    }

    return true;
  }

  static get attributes() {
    return {
      /**
       * In case there are several provider able to support a given source which one sould be used ?
       * this defines the order
       */
      priority: {
        default: 0
      }
    };
  }

  /**
   * Creates a new provider for a given set of options
   * @param {Object} options additional options
   * @param {Object} env taken from process.env
   * @return {Provider} newly created provider or undefined if options are not sufficient to construct a provider
   */
  static initialize(options, env) {
    options = { ...options, ...this.optionsFromEnvironment(env) };
    return this.areOptionsSufficcient(options) ? new this(options) : undefined;
  }

  constructor(options, properties) {
    definePropertiesFromOptions(this, options, properties);
  }

  /**
   * @return {boolean} true if other provider is the same as the receiver
   */
  equals(other) {
    return this === other;
  }

  /**
   * All possible base urls
   * For github something like
   * - git@github.com
   * - git://github.com
   * - git+ssh://github.com
   * - https://github.com
   * - git+https://github.com
   * @return {string[]} common base urls of all repositories
   */
  get repositoryBases() {
    return ["/"];
  }

  /**
   * Bring a repository name into its normal form by removing any clutter
   * like .git suffix or #branch names
   * @param {string} name
   * @param {boolean} forLookup
   * @return {string} normalized name
   */
  normalizeRepositoryName(name, forLookup) {
    const { repository } = this.parseName(name);
    return forLookup && !this.areRepositoryNamesCaseSensitive
      ? repository.toLowerCase()
      : repository;
  }

  normalizeGroupName(name, forLookup) {
    return name && forLookup && !this.areGroupNamesCaseSensitive
      ? name.toLowerCase()
      : name;
  }

  /**
   * Are repositroy names case sensitive.
   * Overwrite and return false if you want to have case insensitive repository lookup
   * @return {boolean} true
   */
  get areRepositoryNamesCaseSensitive() {
    return true;
  }

  /**
   * Are repositroy group names case sensitive.
   * Overwrite and return false if you want to have case insensitive group lookup
   * @return {boolean} true
   */
  get areGroupNamesCaseSensitive() {
    return true;
  }

  /**
   * Does the provider support the base name
   * @param {string} base
   * @return {boolean} true if base is supported or base is undefined
   */
  supportsBase(base) {
    if (base === undefined) {
      return true;
    }

    for (const b of this.repositoryBases) {
      if (b === base) {
        return true;
      }
    }

    return false;
  }

  /**
   * Parses repository name and tries to split it into
   * base, group, repository and branch
   * @param {string} name
   * @return {Object}
   */
  parseName(name) {
    const result = {};

    if (name === undefined) {
      return result;
    }

    name = name.replace(
      /^\s*(git\+)?(([\w\-\+]+:\/\/)[^\@]+@)?/,
      (m, a, b, r) => r || ""
    );

    for (const b of this.repositoryBases) {
      if (name.startsWith(b)) {
        result.base = b;
        name = name.slice(b.length);
        break;
      }
    }
    name = name.replace(
      /^(git@[^:\/]+[:\/]|[\w\-^+]+:\/\/[^\/]+\/)/,
      (m, base) => {
        result.base = base;
        return "";
      }
    );

    let rightAligned;

    name = name.replace(/((\.git)?(#([^\s]*))?)\s*$/, (m, a, b, c, branch) => {
      if (branch) {
        result.branch = branch;
      }
      rightAligned = a.length > 0;
      return "";
    });

    const parts = name.split(/\//);

    if (parts.length >= 2) {
      const i = rightAligned ? parts.length - 2 : 0;
      result.group = parts[i];
      result.repository = parts[i + 1];
    } else {
      result.repository = name;
    }

    return result;
  }

  async createRepository(name, options) {
    const rg = await this.repositoryGroup(name);
    return rg.createRepository(name, options);
  }

  async *listGroups(patterns) {
    if (patterns === undefined) {
      for await (const group of this.repositoryGroups()) {
        yield group;
      }
    } else {
      for (const pattern of asArray(patterns)) {
        const [groupPattern, repoPattern] = pattern.split(/\//);

        for await (const group of this.repositoryGroups(groupPattern)) {
          yield group;
        }
      }
    }
  }

  /**
   * List provider objects of a given type
   *
   * @param {string} type name of the method to deliver typed iterator
   * @param {string|string[]} patterns group / repository filter
   */
  async *list(type, patterns) {
    if (patterns === undefined) {
      for await (const group of this.repositoryGroups()) {
        yield* group[type]();
      }
    } else {
      for (const pattern of asArray(patterns)) {
        const [groupPattern, repoPattern] = pattern.split(/\//);

        for await (const group of this.repositoryGroups(groupPattern)) {
          yield* group[type](repoPattern);
        }
      }
    }
  }

  /**
   * List repositories
   * @param {string[]|string} patterns
   * @return {Iterator<Repository>} all matching repos of the provider
   */
  async *repositories(patterns) {
    yield* this.list("repositories", patterns);
  }

  /**
   * List branches
   * @param {string[]|string} patterns
   * @return {Iterator<Branch>} all matching branches of the provider
   */
  async *branches(patterns) {
    yield* this.list("branches", patterns);
  }

  /**
   * List tags
   * @param {string[]|string} patterns
   * @return {Iterator<Branch>} all matching tags of the provider
   */
  async *tags(patterns) {
    yield* this.list("tags", patterns);
  }

  /**
   * @return {Class} repository group class used by the Provider
   */
  get repositoryGroupClass() {
    return RepositoryGroup;
  }

  /**
   * @return {Class} hook class used by the Provider
   */
  get hookClass() {
    return Hook;
  }

  /**
   * Deliver the provider name
   * @return {string} class name by default
   */
  get name() {
    return this.constructor.name;
  }

  /**
   * We are our own provider
   * @return {Provider} this
   */
  get provider() {
    return this;
  }

  toString() {
    return this.name;
  }

  /**
   * List all defined entries from attributes
   *
   */
  toJSON() {
    const json = { name: this.name };

    Object.keys(this.constructor.attributes).forEach(k => {
      if (this[k] !== undefined && typeof this[k] !== "function") {
        json[k] = this[k];
      }
    });

    return json;
  }

  /**
   * @return {Class} repository class used by the Provider
   */
  get repositoryClass() {
    return Repository;
  }

  /**
   * @return {Class} branch class used by the Provider
   */
  get branchClass() {
    return Branch;
  }

  /**
   * @return {Class} entry class used by the Provider
   */
  get entryClass() {
    return undefined;
  }

  /**
   * @return {Class} pull request class used by the Provider
   */
  get pullRequestClass() {
    return PullRequest;
  }

  initializeRepositories() {}
}

/**
 * Provider supporting serveral repository groups
 *
 */
class MultiGroupProvider extends BaseProvider {
  constructor(options) {
    super(options, {
      _repositoryGroups: { value: new Map() }
    });
  }

  /**
   * Lookup a repository in the provider and all of its repository groups
   * @param {string} name of the repository
   * @return {Repository}
   */
  async repository(name) {
    const { base, group, repository } = this.parseName(name);

    if (this.supportsBase(base)) {
      if (group !== undefined) {
        const rg = await this.repositoryGroup(group);

        if (rg !== undefined) {
          return await rg.repository(repository);
        }
      }
    }
  }

  async branch(name) {
    const { base, group, repository, branch } = this.parseName(name);

    if (this.supportsBase(base)) {
      if (group !== undefined) {
        const rg = await this.repositoryGroup(group);

        if (rg !== undefined) {
          const r = await rg.repository(repository);
          if (r !== undefined) {
            return r.branch(
              branch === undefined ? r.defaultBranchName : branch
            );
          }
        }
      }
    }
  }

  /**
   * Lookup a repository group
   * @param {string} name of the group
   * @return {RepositoryGroup}
   */
  async repositoryGroup(name) {
    const { base } = this.parseName(name);
    if (this.supportsBase(base)) {
      await this.initializeRepositories();
      return this._repositoryGroups.get(this.normalizeGroupName(name, true));
    }
  }

  /**
   * List groups
   * @param {string[]|string} patterns
   * @return {Iterator<RepositoryGroup>} all matching repositories groups of the provider
   */
  async *repositoryGroups(patterns) {
    await this.initializeRepositories();
    yield* matcher$1(this._repositoryGroups.values(), patterns, {
      caseSensitive: this.areGroupNamesCaseSensitive,
      name: "name"
    });
  }

  /**
   * Create a new repository group
   * If there is already a group for the given name it will be returend instead
   * @param {string} name of the group
   * @param {Object} options
   * @return {RepositoryGroup}
   */
  async createRepositoryGroup(name, options) {
    return this.addRepositoryGroup(name, options);
  }

  /**
   * Add a new repository group (not provider specific actions are executed)
   * @param {string} name of the group
   * @param {Object} options
   * @return {RepositoryGroup}
   */
  addRepositoryGroup(name, options) {
    const normalizedName = this.normalizeGroupName(name, true);

    let repositoryGroup = this._repositoryGroups.get(normalizedName);
    if (repositoryGroup === undefined) {
      repositoryGroup = new this.repositoryGroupClass(this, name, options);
      this._repositoryGroups.set(normalizedName, repositoryGroup);
    }
    return repositoryGroup;
  }
}

/* src/Attributes.svelte generated by Svelte v3.29.4 */

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[3] = list[i];
	return child_ctx;
}

// (13:4) {#each attributes as attribute (attribute[0])}
function create_each_block(key_1, ctx) {
	let tr;
	let td0;
	let t0_value = /*attribute*/ ctx[3][0] + "";
	let t0;
	let t1;
	let td1;

	let t2_value = (/*ads*/ ctx[0][/*attribute*/ ctx[3][0]].private
	? "***"
	: /*attribute*/ ctx[3][1]) + "";

	let t2;
	let t3;

	return {
		key: key_1,
		first: null,
		c() {
			tr = element("tr");
			td0 = element("td");
			t0 = text(t0_value);
			t1 = space();
			td1 = element("td");
			t2 = text(t2_value);
			t3 = space();
			this.first = tr;
		},
		m(target, anchor) {
			insert(target, tr, anchor);
			append(tr, td0);
			append(td0, t0);
			append(tr, t1);
			append(tr, td1);
			append(td1, t2);
			append(tr, t3);
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(tr);
		}
	};
}

function create_fragment$3(ctx) {
	let table;
	let tbody;
	let each_blocks = [];
	let each_1_lookup = new Map();
	let each_value = /*attributes*/ ctx[1];
	const get_key = ctx => /*attribute*/ ctx[3][0];

	for (let i = 0; i < each_value.length; i += 1) {
		let child_ctx = get_each_context(ctx, each_value, i);
		let key = get_key(child_ctx);
		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
	}

	return {
		c() {
			table = element("table");
			tbody = element("tbody");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(table, "class", "striped hoverable");
		},
		m(target, anchor) {
			insert(target, table, anchor);
			append(table, tbody);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(tbody, null);
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*ads, attributes*/ 3) {
				const each_value = /*attributes*/ ctx[1];
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, tbody, destroy_block, create_each_block, null, get_each_context);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(table);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].d();
			}
		}
	};
}

function instance$3($$self, $$props, $$invalidate) {
	let { object } = $$props;
	const ads = object.constructor.attributes;
	const attributes = Object.keys(ads).filter(k => object[k] !== undefined).map(key => [key, object[key]]);

	$$self.$$set = $$props => {
		if ("object" in $$props) $$invalidate(2, object = $$props.object);
	};

	return [ads, attributes, object];
}

class Attributes extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$3, create_fragment$3, safe_not_equal, { object: 2 });
	}
}

/* src/HookCard.svelte generated by Svelte v3.29.4 */

function get_each_context$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[1] = list[i];
	return child_ctx;
}

// (11:6) {#each [...hook.events] as event}
function create_each_block$1(ctx) {
	let li;
	let t_value = /*event*/ ctx[1] + "";
	let t;

	return {
		c() {
			li = element("li");
			t = text(t_value);
		},
		m(target, anchor) {
			insert(target, li, anchor);
			append(li, t);
		},
		p(ctx, dirty) {
			if (dirty & /*hook*/ 1 && t_value !== (t_value = /*event*/ ctx[1] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(li);
		}
	};
}

function create_fragment$4(ctx) {
	let div1;
	let div0;
	let h5;
	let t0_value = /*hook*/ ctx[0].displayName + "";
	let t0;
	let t1;
	let ul;
	let t2;
	let attributes;
	let current;
	let each_value = [.../*hook*/ ctx[0].events];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
	}

	attributes = new Attributes({ props: { object: /*hook*/ ctx[0] } });

	return {
		c() {
			div1 = element("div");
			div0 = element("div");
			h5 = element("h5");
			t0 = text(t0_value);
			t1 = space();
			ul = element("ul");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t2 = space();
			create_component(attributes.$$.fragment);
			attr(h5, "class", "card-title");
			attr(div0, "class", "card-content");
			attr(div1, "class", "card");
		},
		m(target, anchor) {
			insert(target, div1, anchor);
			append(div1, div0);
			append(div0, h5);
			append(h5, t0);
			append(div0, t1);
			append(div0, ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(ul, null);
			}

			append(div0, t2);
			mount_component(attributes, div0, null);
			current = true;
		},
		p(ctx, [dirty]) {
			if ((!current || dirty & /*hook*/ 1) && t0_value !== (t0_value = /*hook*/ ctx[0].displayName + "")) set_data(t0, t0_value);

			if (dirty & /*hook*/ 1) {
				each_value = [.../*hook*/ ctx[0].events];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$1(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(ul, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}

			const attributes_changes = {};
			if (dirty & /*hook*/ 1) attributes_changes.object = /*hook*/ ctx[0];
			attributes.$set(attributes_changes);
		},
		i(local) {
			if (current) return;
			transition_in(attributes.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(attributes.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div1);
			destroy_each(each_blocks, detaching);
			destroy_component(attributes);
		}
	};
}

function instance$4($$self, $$props, $$invalidate) {
	let { hook } = $$props;

	$$self.$$set = $$props => {
		if ("hook" in $$props) $$invalidate(0, hook = $$props.hook);
	};

	return [hook];
}

class HookCard extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$4, create_fragment$4, safe_not_equal, { hook: 0 });
	}
}

/* src/RepositoryGroupCard.svelte generated by Svelte v3.29.4 */

function create_if_block$1(ctx) {
	let a;
	let t;
	let a_href_value;

	return {
		c() {
			a = element("a");
			t = text("Home");
			attr(a, "href", a_href_value = /*repositoryGroup*/ ctx[0].homePageURL);
		},
		m(target, anchor) {
			insert(target, a, anchor);
			append(a, t);
		},
		p(ctx, dirty) {
			if (dirty & /*repositoryGroup*/ 1 && a_href_value !== (a_href_value = /*repositoryGroup*/ ctx[0].homePageURL)) {
				attr(a, "href", a_href_value);
			}
		},
		d(detaching) {
			if (detaching) detach(a);
		}
	};
}

function create_fragment$5(ctx) {
	let div2;
	let div1;
	let div0;
	let t0_value = /*repositoryGroup*/ ctx[0].displayName + "";
	let t0;
	let t1;
	let t2;
	let attributes;
	let t3;
	let objectlink;
	let current;
	let if_block = /*repositoryGroup*/ ctx[0].homePageURL && create_if_block$1(ctx);

	attributes = new Attributes({
			props: { object: /*repositoryGroup*/ ctx[0] }
		});

	objectlink = new ObjectLink({
			props: {
				object: /*repositoryGroup*/ ctx[0].provider
			}
		});

	return {
		c() {
			div2 = element("div");
			div1 = element("div");
			div0 = element("div");
			t0 = text(t0_value);
			t1 = space();
			if (if_block) if_block.c();
			t2 = space();
			create_component(attributes.$$.fragment);
			t3 = space();
			create_component(objectlink.$$.fragment);
			attr(div0, "class", "card-title");
			attr(div1, "class", "card-content");
			attr(div2, "class", "card");
		},
		m(target, anchor) {
			insert(target, div2, anchor);
			append(div2, div1);
			append(div1, div0);
			append(div0, t0);
			append(div1, t1);
			if (if_block) if_block.m(div1, null);
			append(div1, t2);
			mount_component(attributes, div1, null);
			append(div1, t3);
			mount_component(objectlink, div1, null);
			current = true;
		},
		p(ctx, [dirty]) {
			if ((!current || dirty & /*repositoryGroup*/ 1) && t0_value !== (t0_value = /*repositoryGroup*/ ctx[0].displayName + "")) set_data(t0, t0_value);

			if (/*repositoryGroup*/ ctx[0].homePageURL) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block$1(ctx);
					if_block.c();
					if_block.m(div1, t2);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			const attributes_changes = {};
			if (dirty & /*repositoryGroup*/ 1) attributes_changes.object = /*repositoryGroup*/ ctx[0];
			attributes.$set(attributes_changes);
			const objectlink_changes = {};
			if (dirty & /*repositoryGroup*/ 1) objectlink_changes.object = /*repositoryGroup*/ ctx[0].provider;
			objectlink.$set(objectlink_changes);
		},
		i(local) {
			if (current) return;
			transition_in(attributes.$$.fragment, local);
			transition_in(objectlink.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(attributes.$$.fragment, local);
			transition_out(objectlink.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div2);
			if (if_block) if_block.d();
			destroy_component(attributes);
			destroy_component(objectlink);
		}
	};
}

function instance$5($$self, $$props, $$invalidate) {
	let { repositoryGroup } = $$props;

	$$self.$$set = $$props => {
		if ("repositoryGroup" in $$props) $$invalidate(0, repositoryGroup = $$props.repositoryGroup);
	};

	return [repositoryGroup];
}

class RepositoryGroupCard extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$5, create_fragment$5, safe_not_equal, { repositoryGroup: 0 });
	}
}

/* src/PullRequestCard.svelte generated by Svelte v3.29.4 */

function create_fragment$6(ctx) {
	let div3;
	let div2;
	let h5;
	let t0_value = /*pullRequest*/ ctx[0].displayName + "";
	let t0;
	let t1;
	let div0;
	let t2;
	let objectlink0;
	let t3;
	let div1;
	let t4;
	let objectlink1;
	let t5;
	let attributes;
	let current;

	objectlink0 = new ObjectLink({
			props: { object: /*pullRequest*/ ctx[0].source }
		});

	objectlink1 = new ObjectLink({
			props: {
				object: /*pullRequest*/ ctx[0].destination
			}
		});

	attributes = new Attributes({
			props: { object: /*pullRequest*/ ctx[0] }
		});

	return {
		c() {
			div3 = element("div");
			div2 = element("div");
			h5 = element("h5");
			t0 = text(t0_value);
			t1 = space();
			div0 = element("div");
			t2 = text("Source:\n      ");
			create_component(objectlink0.$$.fragment);
			t3 = space();
			div1 = element("div");
			t4 = text("Destination:\n      ");
			create_component(objectlink1.$$.fragment);
			t5 = space();
			create_component(attributes.$$.fragment);
			attr(h5, "class", "card-title");
			attr(div2, "class", "card-content");
			attr(div3, "class", "card");
		},
		m(target, anchor) {
			insert(target, div3, anchor);
			append(div3, div2);
			append(div2, h5);
			append(h5, t0);
			append(div2, t1);
			append(div2, div0);
			append(div0, t2);
			mount_component(objectlink0, div0, null);
			append(div2, t3);
			append(div2, div1);
			append(div1, t4);
			mount_component(objectlink1, div1, null);
			append(div2, t5);
			mount_component(attributes, div2, null);
			current = true;
		},
		p(ctx, [dirty]) {
			if ((!current || dirty & /*pullRequest*/ 1) && t0_value !== (t0_value = /*pullRequest*/ ctx[0].displayName + "")) set_data(t0, t0_value);
			const objectlink0_changes = {};
			if (dirty & /*pullRequest*/ 1) objectlink0_changes.object = /*pullRequest*/ ctx[0].source;
			objectlink0.$set(objectlink0_changes);
			const objectlink1_changes = {};
			if (dirty & /*pullRequest*/ 1) objectlink1_changes.object = /*pullRequest*/ ctx[0].destination;
			objectlink1.$set(objectlink1_changes);
			const attributes_changes = {};
			if (dirty & /*pullRequest*/ 1) attributes_changes.object = /*pullRequest*/ ctx[0];
			attributes.$set(attributes_changes);
		},
		i(local) {
			if (current) return;
			transition_in(objectlink0.$$.fragment, local);
			transition_in(objectlink1.$$.fragment, local);
			transition_in(attributes.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(objectlink0.$$.fragment, local);
			transition_out(objectlink1.$$.fragment, local);
			transition_out(attributes.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div3);
			destroy_component(objectlink0);
			destroy_component(objectlink1);
			destroy_component(attributes);
		}
	};
}

function instance$6($$self, $$props, $$invalidate) {
	let { pullRequest } = $$props;

	$$self.$$set = $$props => {
		if ("pullRequest" in $$props) $$invalidate(0, pullRequest = $$props.pullRequest);
	};

	return [pullRequest];
}

class PullRequestCard extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$6, create_fragment$6, safe_not_equal, { pullRequest: 0 });
	}
}

/* src/SecureAttributeField.svelte generated by Svelte v3.29.4 */

function create_fragment$7(ctx) {
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

function instance$7($$self, $$props, $$invalidate) {
	let { attribute } = $$props;

	function input_input_handler() {
		attribute.value = this.value;
		$$invalidate(0, attribute);
	}

	$$self.$$set = $$props => {
		if ("attribute" in $$props) $$invalidate(0, attribute = $$props.attribute);
	};

	return [attribute, input_input_handler];
}

class SecureAttributeField extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$7, create_fragment$7, safe_not_equal, { attribute: 0 });
	}
}

/* src/AttributeField.svelte generated by Svelte v3.29.4 */

function create_fragment$8(ctx) {
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

function instance$8($$self, $$props, $$invalidate) {
	let { attribute } = $$props;

	function input_input_handler() {
		attribute.value = this.value;
		$$invalidate(0, attribute);
	}

	$$self.$$set = $$props => {
		if ("attribute" in $$props) $$invalidate(0, attribute = $$props.attribute);
	};

	return [attribute, input_input_handler];
}

class AttributeField extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$8, create_fragment$8, safe_not_equal, { attribute: 0 });
	}
}

/* tests/app/src/App.svelte generated by Svelte v3.29.4 */

function create_default_slot$1(ctx) {
	let pullrequestcard;
	let t0;
	let repositorygroupcard;
	let t1;
	let hookcard;
	let current;

	pullrequestcard = new PullRequestCard({
			props: { pullRequest: /*pullRequest*/ ctx[1] }
		});

	repositorygroupcard = new RepositoryGroupCard({
			props: {
				repositoryGroup: /*repositoryGroup*/ ctx[0]
			}
		});

	hookcard = new HookCard({ props: { hook: /*hook*/ ctx[2] } });

	return {
		c() {
			create_component(pullrequestcard.$$.fragment);
			t0 = space();
			create_component(repositorygroupcard.$$.fragment);
			t1 = space();
			create_component(hookcard.$$.fragment);
		},
		m(target, anchor) {
			mount_component(pullrequestcard, target, anchor);
			insert(target, t0, anchor);
			mount_component(repositorygroupcard, target, anchor);
			insert(target, t1, anchor);
			mount_component(hookcard, target, anchor);
			current = true;
		},
		p: noop,
		i(local) {
			if (current) return;
			transition_in(pullrequestcard.$$.fragment, local);
			transition_in(repositorygroupcard.$$.fragment, local);
			transition_in(hookcard.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(pullrequestcard.$$.fragment, local);
			transition_out(repositorygroupcard.$$.fragment, local);
			transition_out(hookcard.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(pullrequestcard, detaching);
			if (detaching) detach(t0);
			destroy_component(repositorygroupcard, detaching);
			if (detaching) detach(t1);
			destroy_component(hookcard, detaching);
		}
	};
}

function create_fragment$9(ctx) {
	let router;
	let t0;
	let attributefield;
	let t1;
	let secureattributefield;
	let current;

	router = new Router({
			props: {
				$$slots: { default: [create_default_slot$1] },
				$$scope: { ctx }
			}
		});

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
			create_component(router.$$.fragment);
			t0 = space();
			create_component(attributefield.$$.fragment);
			t1 = space();
			create_component(secureattributefield.$$.fragment);
		},
		m(target, anchor) {
			mount_component(router, target, anchor);
			insert(target, t0, anchor);
			mount_component(attributefield, target, anchor);
			insert(target, t1, anchor);
			mount_component(secureattributefield, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const router_changes = {};

			if (dirty & /*$$scope*/ 128) {
				router_changes.$$scope = { dirty, ctx };
			}

			router.$set(router_changes);
		},
		i(local) {
			if (current) return;
			transition_in(router.$$.fragment, local);
			transition_in(attributefield.$$.fragment, local);
			transition_in(secureattributefield.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(router.$$.fragment, local);
			transition_out(attributefield.$$.fragment, local);
			transition_out(secureattributefield.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(router, detaching);
			if (detaching) detach(t0);
			destroy_component(attributefield, detaching);
			if (detaching) detach(t1);
			destroy_component(secureattributefield, detaching);
		}
	};
}

function instance$9($$self) {
	const provider = new MultiGroupProvider();
	const repositoryGroup = provider.addRepositoryGroup("rg1");
	const repository = repositoryGroup.addRepository("r1");
	const b1 = repository.addBranch("b1");
	const b2 = repository.addBranch("b2");
	const pullRequest = new PullRequest(b1, b2, 4711);
	const hook = new Hook(repository, "h1");
	return [repositoryGroup, pullRequest, hook];
}

class App extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});
	}
}

var index = new App({
  target: document.body
});

export default index;
//# sourceMappingURL=bundle.main.mjs.map
