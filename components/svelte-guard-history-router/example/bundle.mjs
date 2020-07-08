const articles = Object.fromEntries(
  [
    {
      id: "01",
      name: "Peanutbutter",
      category: "staple",
      price: 1.98
    },
    {
      id: "02",
      name: "cracked wheat",
      category: "staple",
      price: 1.29
    },
    { id: "03", name: "Milk", category: "staple", price: 1.05 },
    { id: "10", name: "Pizza Quattro Stagioni", price: 8.0, category: "pizza" },
    { id: "11", name: "Pizza Salami", price: 7.0, category: "pizza" },
    { id: "12", name: "Pizza Hawaii", price: 7.0, category: "pizza" },
    { id: "13", name: "Pizza Margherita", price: 5.0, category: "pizza" },
    { id: "14", name: "Pizza Funghi", price: 7.0, category: "pizza" },
    { id: "15", name: "Pizza Calzone", price: 7.0, category: "pizza" },
    { id: "16", name: "Pizza Tonno", price: 7.0, category: "pizza" },
    { id: "17", name: "Pizza Frutti di Mare", price: 7.0, category: "pizza" },
    { id: "18", name: "Pizza Prosciutto", price: 7.0, category: "pizza" },
    { id: "19", name: "Pizza Peperoni", price: 7.0, category: "pizza" },
    { id: "20", name: "Pizza Chef", price: 7.5, category: "pizza" },
    { id: "21", name: "Pizza Speciale", price: 8.5, category: "pizza" },
    { id: "23", name: "Hot Dog", price: 2.0, category: "to go" },
    { id: "32", name: "Cheesecake", price: 2.0, category: "dessert" }
  ].map(a => [a.id, a])
);

const categories = Object.values(articles).reduce((all, c) => {
  if (!all[c.category]) all[c.category] = { name: c.category, articles: [] };
  all[c.category].articles.push(c);
  c.category = all[c.category];
  return all;
}, {});

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
function null_to_empty(value) {
    return value == null ? '' : value;
}
function action_destroyer(action_result) {
    return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
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
        throw new Error(`Function called outside component initialization`);
    return current_component;
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

function findClosestAttribute(element, attributeName) {
    let attribute;
  while ((attribute = element.getAttribute(attributeName)) === null) {
    element = element.parentElement;
    if (element === null) {
      return undefined;
    }
  }

  return attribute;
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


const ROUTER = "@@private@@-ROUTER";

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
 * - :param       -> 0
 * - match * or ? -> 1
 * - plain        -> 2
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
      return "([^\/#\?]*)";
    }

    const mod = part.replace(/(\*|\?)/, ".$1", "g");

    priority += mod === part ? 2 : 1;

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
   * - find matching target route @see Router.replace()
   * - leave old route
   * - set params
   * - set current route
   * - enter new route
   */
  async start() {
    const router = this.router;

    try {
      if (this.saved.route !== undefined) {
        await this.saved.route.leave(this);
      }

      router.replace(this.path);

      if (router.route !== undefined) {
        await router.route.enter(this);
      }
    } catch (e) {
      await this.rollback(e);
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
   * To proceed with the original route by calling continue()
   * @param {string} path new route to enter temporary
   */
  async redirect(path) {
    this.redirected = this.router.replace(path);
  }

  /**
   * Continue a redirected route to its original destination
   */
  async continue() {
    if (this.redirected !== undefined) {
      try {
        this.router.state = this.redirected;

        // try entering 2nd. time
        if (this.router.route !== undefined) {
          await this.router.route.enter(this);
        }
      } catch (e) {
        await this.rollback(e);
      } finally {
        this.redirected = undefined;
        this.end();
      }
    }
  }

  /**
   * Bring back the router into the state before the transition has started
   * @param {Exception} e
   */
  async rollback(e) {
    if (e) {
      console.error(e);
    }

    this.router.state = this.saved;
    window.history.back();
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
  static get navigationEventType() {
    return "routerLink";
  }

  constructor(routes = [], base = "") {
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

    setTimeout(() => this._start(), 0);
  }

  compile() {
    this.routes = compile(this.routes);

    for (const route of this.routes) {
      route.keys.forEach(key => {
        if (this.keys[key]) {
          return;
        }
        this.keys[key] = nameValueStore(key);
      });
    }
  }

  _start() {
    window.addEventListener(BaseRouter.navigationEventType, event =>
      this.push(event.detail.path)
    );

    window.addEventListener("popstate", event => {
      if (event.state) {
        this.replace(event.state.path);
      }
    });

    this.push(window.location.pathname.slice(this.base.length));
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
   * Leave current route and enter route for given path
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
    const c = this.component;
    this.transition = undefined;

    // transition had its own tmp component (waiting... or so)
    if (c !== this.component) {
      this.notifySubscriptions();
    }

    if (path !== undefined) {
      history.pushState({path}, undefined, this.base + path);
    }

    this.linkNodes.forEach(n => this.updateActive(n));
  }

  /**
   * Continue transition to its original destination.
   * Shortcut for this.transition.continue()
   * Does nothing if there is no transition.
   */
  async continue() {
    if (this.transition) {
      return this.transition.continue();
    }
  }

  /**
   * Router subscription
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
   * Add a new route.
   * @param {Route} route
   */
  addRoute(route) {
    this.routes.push(route);
    this.compile();
  }

  /**
   * Find Route for a given object(s)
   * @param {Object} objects
   * @return {Route} able to support given object
   */
  routeFor(...objects) {
    for (const r of this.routes) {
      if (r.propertiesFor(...objects)) {
        return r;
      }
    }
  }
}

/* src/components/Router.svelte generated by Svelte v3.24.0 */

function create_fragment(ctx) {
	let current;
	const default_slot_template = /*$$slots*/ ctx[4].default;
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
	let { router } = $$props;
	let { routes = [] } = $$props;
	let { base = "" } = $$props;

	if (router === undefined) {
		router = new BaseRouter(routes, base);
	}

	setContext(ROUTER, router);
	let { $$slots = {}, $$scope } = $$props;

	$$self.$set = $$props => {
		if ("router" in $$props) $$invalidate(0, router = $$props.router);
		if ("routes" in $$props) $$invalidate(1, routes = $$props.routes);
		if ("base" in $$props) $$invalidate(2, base = $$props.base);
		if ("$$scope" in $$props) $$invalidate(3, $$scope = $$props.$$scope);
	};

	return [router, routes, base, $$scope, $$slots];
}

class Router extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { router: 0, routes: 1, base: 2 });
	}
}

function link(node, router) {
  node.addEventListener("click", event => {
    event.preventDefault();

    const href = findClosestAttribute(event.target, "href");

    if (href === null) {
      throw Error("Could not find corresponding href value");
    }

    router.push(href);
    return false;
  });
}

function active(node, router) {
  router.linkNodes.add(node);
  router.updateActive(node);

  return {
    destroy() {
      router.linkNodes.delete(node);
    }
  };
}

/**
 * Enforces conditions of routes
 * Like the presents of values in the context
 */
class Guard {
  /**
   * Called while entering a route (current outlet is not yet set)
   * @param {Transition} transition
   */
  async enter(transition) {}

  /**
   * Called before leaving a route
   * @param {Transition} transition
   */
  async leave(transition) {}

  toString() {
    return this.constructor.name;
  }
}

/**
 * Execute guards in a sequence
 * @param {Iterable<Guard>} children
 */
function sequenceGuard(children) {
  return {
    toString: () => {
      return "[" + children + "]";
    },
    enter: async transition => {
      for (const child of children) {
        await child.enter(transition);
      }
    },
    leave: async transition => {
      for (const child of children) {
        await child.leave(transition);
      }
    }
  };
}

/**
 * Base route without guard
 * @property {string} localPath
 * @property {SvelteComponent} component target to show
 * @property {number} priority
 * @property {string[]} keys as found in the path
 * @property {RegEx} regex
 * @property {any} value
 * @property {any} defaultValue
 */
class SkeletonRoute {
  static get isRoute() {
    return true;
  }

  /**
   * Enter the route from a former one.
   * @param {Transition} transition
   */
  async enter(transition) {
    if (this.parent && this.parent.guard) {
      await this.parent.guard.enter(transition);
    }

    if (this.guard) {
      return this.guard.enter(transition);
    }
  }

  /**
   * Leave the route to a new one.
   * @param {Transition} transition
   */
  async leave(transition) {
    if (this.guard) {
      await this.guard.leave(transition);
    }

    if (this.parent && this.parent.guard) {
      await this.parent.guard.leave(transition);
    }
  }

  /**
   * Extract properties from object.
   * @param {Object} object
   * @return {Object} properties extracted from given objects
   */
  propertiesFor(object) {
    const pp = this.parent ? this.parent.propertiesFor(object) : undefined;
 
    if(this.keys.length === 0) {
      return pp;
    }

    return Object.assign(Object.fromEntries(this.keys.map(key => [key, object[key]])), pp);
  }

  /**
   * Deliver object for a given set of properties
   * @param {Object} properties
   * @return {Object} for matching properties
   */
  objectFor(properties) {
    return this.parent ? this.parent.objectFor(properties) : undefined;
  }

  /**
   * Default value used for store.
   * @return {any}
   */
  get defaultValue()
  {
    return undefined;
  }

  /**
   * Value used for store.
   * @return {any}
   */
  get value()
  {
    return this.defaultValue;
  }
  
  /**
   * Full path of the Route including all parents
   * @return {string} path
   */
  get path() {
    return this.parent ? this.parent.path + this.localPath : this.localPath;
  }
}

/**
 * Helper function to create routes with optional guards
 * @param {Route?} parent
 * @param {string?} path
 * @param {Route?} factory
 * @param {Guard|SvelteComponent[]} args last one must be a SvelteComponent
 */
function route(...args) {
  let route, path, parent;

  if (typeof args[0] !== "string") {
    parent = args.shift();
  }

  path = args.shift();

  if (args[0].isRoute) {
    const factory = args.shift();
    route = new factory();
  } else {
    route = new SkeletonRoute();
  }

  route.component = args.pop();
  route.localPath = path;
  if (parent) {
    route.parent = parent;
  }

  switch (args.length) {
    case 0:
      break;
    case 1:
      route.guard = args[0];
      break;
    default:
      route.guard = sequenceGuard(args);
  }

  return route;
}

/* src/components/Route.svelte generated by Svelte v3.24.0 */

function create_if_block(ctx) {
	let a;
	let link_action;
	let active_action;
	let current;
	let mounted;
	let dispose;
	const default_slot_template = /*$$slots*/ ctx[8].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[7], null);

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
				dispose = [
					action_destroyer(link_action = link.call(null, a, /*router*/ ctx[2])),
					action_destroyer(active_action = active.call(null, a, /*router*/ ctx[2]))
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (default_slot) {
				if (default_slot.p && dirty & /*$$scope*/ 128) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[7], dirty, null, null);
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
			run_all(dispose);
		}
	};
}

function create_fragment$1(ctx) {
	let if_block_anchor;
	let current;
	let if_block = /*route*/ ctx[1].keys.length === 0 && create_if_block(ctx);

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			if (/*route*/ ctx[1].keys.length === 0) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty & /*route*/ 2) {
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
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (if_block) if_block.d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

const ROUTE = "@@private@@-ROUTE";

function instance$1($$self, $$props, $$invalidate) {
	let { path } = $$props;
	let { href = path } = $$props;
	let { guards } = $$props;
	let { component } = $$props;
	let { factory = SkeletonRoute } = $$props;
	const parent = getContext(ROUTE);
	const router = getContext(ROUTER);
	const route = new factory();
	setContext(ROUTE, route);
	route.localPath = path;
	route.component = component;

	if (parent) {
		route.parent = parent;
	}

	if (guards) {
		if (Array.isArray(guards)) {
			switch (guards.length) {
				case 1:
					route.guard = guards[0];
					break;
				default:
					route.guard = sequenceGuard(guards);
			}
		} else {
			route.guard = guards;
		}
	}

	router.addRoute(route);
	let { $$slots = {}, $$scope } = $$props;

	$$self.$set = $$props => {
		if ("path" in $$props) $$invalidate(3, path = $$props.path);
		if ("href" in $$props) $$invalidate(0, href = $$props.href);
		if ("guards" in $$props) $$invalidate(4, guards = $$props.guards);
		if ("component" in $$props) $$invalidate(5, component = $$props.component);
		if ("factory" in $$props) $$invalidate(6, factory = $$props.factory);
		if ("$$scope" in $$props) $$invalidate(7, $$scope = $$props.$$scope);
	};

	return [href, route, router, path, guards, component, factory, $$scope, $$slots];
}

class Route extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
			path: 3,
			href: 0,
			guards: 4,
			component: 5,
			factory: 6
		});
	}
}

/* src/components/Link.svelte generated by Svelte v3.24.0 */

function create_fragment$2(ctx) {
	let a;
	let current;
	let mounted;
	let dispose;
	const default_slot_template = /*$$slots*/ ctx[3].default;
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

function instance$2($$self, $$props, $$invalidate) {
	let { href } = $$props;

	function click(e) {
		window.dispatchEvent(new CustomEvent(BaseRouter.navigationEventType,
		{
				detail: { path: e.currentTarget.pathname }
			}));
	}

	let { $$slots = {}, $$scope } = $$props;

	$$self.$set = $$props => {
		if ("href" in $$props) $$invalidate(0, href = $$props.href);
		if ("$$scope" in $$props) $$invalidate(2, $$scope = $$props.$$scope);
	};

	return [href, click, $$scope, $$slots];
}

class Link extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$2, create_fragment$2, safe_not_equal, { href: 0 });
	}
}

/* src/components/ObjectLink.svelte generated by Svelte v3.24.0 */
const get_noFound_slot_changes = dirty => ({});
const get_noFound_slot_context = ctx => ({});

// (27:0) {:else}
function create_else_block_1(ctx) {
	let current;
	const noFound_slot_template = /*$$slots*/ ctx[3].noFound;
	const noFound_slot = create_slot(noFound_slot_template, ctx, /*$$scope*/ ctx[4], get_noFound_slot_context);

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
				if (noFound_slot.p && dirty & /*$$scope*/ 16) {
					update_slot(noFound_slot, noFound_slot_template, ctx, /*$$scope*/ ctx[4], dirty, get_noFound_slot_changes, get_noFound_slot_context);
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

// (19:0) {#if href}
function create_if_block$1(ctx) {
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

			if (dirty & /*$$scope, object*/ 17) {
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

// (23:4) {:else}
function create_else_block(ctx) {
	let current;
	const default_slot_template = /*$$slots*/ ctx[3].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[4], null);

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
		p(ctx, dirty) {
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
			if (default_slot) default_slot.d(detaching);
		}
	};
}

// (21:4) {#if route.linkComponent}
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

// (20:2) <Link {href}>
function create_default_slot(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block_1, create_else_block];
	const if_blocks = [];

	function select_block_type_1(ctx, dirty) {
		if (/*route*/ ctx[2].linkComponent) return 0;
		return 1;
	}

	current_block_type_index = select_block_type_1(ctx);
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
		p(ctx, dirty) {
			if_block.p(ctx, dirty);
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

function create_fragment$3(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block$1, create_else_block_1];
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

function instance$3($$self, $$props, $$invalidate) {
	let { object } = $$props;
	const router = getContext(ROUTER);
	const route = router.routeFor(object);
	let href;

	if (route !== undefined) {
		const properties = route.propertiesFor(object);
		href = route.path.replace(/:(\w+)/g, (m, name) => properties[name]);
	}

	let { $$slots = {}, $$scope } = $$props;

	$$self.$set = $$props => {
		if ("object" in $$props) $$invalidate(0, object = $$props.object);
		if ("$$scope" in $$props) $$invalidate(4, $$scope = $$props.$$scope);
	};

	return [object, href, route, $$slots, $$scope];
}

class ObjectLink extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$3, create_fragment$3, safe_not_equal, { object: 0 });
	}
}

/* src/components/Outlet.svelte generated by Svelte v3.24.0 */

function create_else_block$1(ctx) {
	let current;
	const default_slot_template = /*$$slots*/ ctx[3].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);

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
		p(ctx, dirty) {
			if (default_slot) {
				if (default_slot.p && dirty & /*$$scope*/ 4) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[2], dirty, null, null);
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

// (7:0) {#if $router.component}
function create_if_block$2(ctx) {
	let switch_instance;
	let switch_instance_anchor;
	let current;
	var switch_value = /*$router*/ ctx[0].component;

	function switch_props(ctx) {
		return {};
	}

	if (switch_value) {
		switch_instance = new switch_value(switch_props());
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
			if (switch_value !== (switch_value = /*$router*/ ctx[0].component)) {
				if (switch_instance) {
					group_outros();
					const old_component = switch_instance;

					transition_out(old_component.$$.fragment, 1, 0, () => {
						destroy_component(old_component, 1);
					});

					check_outros();
				}

				if (switch_value) {
					switch_instance = new switch_value(switch_props());
					create_component(switch_instance.$$.fragment);
					transition_in(switch_instance.$$.fragment, 1);
					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
				} else {
					switch_instance = null;
				}
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

function create_fragment$4(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block$2, create_else_block$1];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*$router*/ ctx[0].component) return 0;
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

function instance$4($$self, $$props, $$invalidate) {
	let $router;
	const router = getContext(ROUTER);
	component_subscribe($$self, router, value => $$invalidate(0, $router = value));
	let { $$slots = {}, $$scope } = $$props;

	$$self.$set = $$props => {
		if ("$$scope" in $$props) $$invalidate(2, $$scope = $$props.$$scope);
	};

	return [$router, router, $$scope, $$slots];
}

class Outlet extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});
	}
}

class StoreRoute extends SkeletonRoute {
  constructor() {
    super();
    let value = this.defaultValue;

    const properties = {
      value: { get: () => value, set: v => (value = v) },
      subscriptions: { value: new Set() }
    };

    Object.defineProperties(this, properties);
  }

  subscribe(subscription) {
    this.subscriptions.add(subscription);
    subscription(this.value);
    return () => this.subscriptions.delete(subscription);
  }
}

class ObjectStoreRoute extends StoreRoute {
  async enter(transition) {
    await super.enter(transition);

    const properties = transition.router.params;
    const object = await this.objectFor(properties);

    this.value = object;
    this.subscriptions.forEach(subscription => subscription(object));
  }
}

class IteratorStoreRoute extends StoreRoute {

  get defaultValue()
  {
    return [];
  }  

  async enter(transition) {
    await super.enter(transition);
    this.subscriptions.forEach(subscription => subscription([]));

    const properties = transition.router.params;
    const entries = this.defaultValue;

    for await (const e of await this.iteratorFor(properties)) {
      entries.push(e);
    }

    this.value = entries;

    this.subscriptions.forEach(subscription => subscription(entries));
  }
}

/**
 * Shows a component during transition
 * @param {SvelteComponent} component to show up during th transition
 * @param {number} rampUpTime initial delay for the componnt to show up
 */
class WaitingGuard extends Guard {
  constructor(component, rampUpTime = 300) {
    super();
    Object.defineProperties(this, {
      component: { value: component },
      rampUpTime: { value: rampUpTime }
    });
  }

  async enter(transition) {
    transition.timeoutID = setTimeout(() => {
      transition.timeoutID = undefined;
      transition.component = this.component;
    }, this.rampUpTime);
  }

  async leave(transition) {
    if (transition.timeoutID) {
      clearTimeout(transition.timeoutID);
    }
  }
}

/* example/src/RouterState.svelte generated by Svelte v3.24.0 */

function add_css() {
	var style = element("style");
	style.id = "svelte-oi8cjc-style";
	style.textContent = "table.svelte-oi8cjc.svelte-oi8cjc{margin-bottom:1rem;color:#212529;border:1px solid #dee2e6}thead.svelte-oi8cjc.svelte-oi8cjc{vertical-align:middle;border-top-color:inherit;border-right-color:inherit;border-bottom-color:inherit;border-left-color:inherit}tbody.svelte-oi8cjc.svelte-oi8cjc{vertical-align:middle;border-top-color:inherit;border-right-color:inherit;border-bottom-color:inherit;border-left-color:inherit}tr.svelte-oi8cjc.svelte-oi8cjc{vertical-align:inherit;border-top-color:inherit;border-right-color:inherit;border-bottom-color:inherit;border-left-color:inherit}th.svelte-oi8cjc.svelte-oi8cjc{text-align:inherit;font-weight:bold}table.svelte-oi8cjc thead th.svelte-oi8cjc{vertical-align:bottom;border-bottom:1px solid #dee2e6}th.svelte-oi8cjc.svelte-oi8cjc,td.svelte-oi8cjc.svelte-oi8cjc{padding:0.2rem;vertical-align:top;border-top:1px solid #dee2e6}.current.svelte-oi8cjc.svelte-oi8cjc{background-color:bisque}.background.svelte-oi8cjc.svelte-oi8cjc{background-color:rgba(165, 181, 190, 0.05)}";
	append(document.head, style);
}

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[2] = list[i];
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[5] = list[i];
	return child_ctx;
}

function get_each_context_2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[8] = list[i];
	child_ctx[10] = i;
	return child_ctx;
}

// (71:6) {#if $router.transition !== undefined}
function create_if_block$3(ctx) {
	let tr;
	let td;
	let t_value = /*$router*/ ctx[0].transition.path + "";
	let t;

	return {
		c() {
			tr = element("tr");
			td = element("td");
			t = text(t_value);
			attr(td, "id", "route.path");
			attr(td, "class", "svelte-oi8cjc");
			attr(tr, "class", "svelte-oi8cjc");
		},
		m(target, anchor) {
			insert(target, tr, anchor);
			append(tr, td);
			append(td, t);
		},
		p(ctx, dirty) {
			if (dirty & /*$router*/ 1 && t_value !== (t_value = /*$router*/ ctx[0].transition.path + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(tr);
		}
	};
}

// (84:6) {#each router.routes as r, i (i)}
function create_each_block_2(key_1, ctx) {
	let tr;
	let td0;
	let t0_value = /*r*/ ctx[8].path + "";
	let t0;
	let t1;
	let td1;
	let t2_value = (/*r*/ ctx[8].guard ? /*r*/ ctx[8].guard : "") + "";
	let t2;
	let t3;
	let td2;
	let t4_value = /*r*/ ctx[8].keys.join(" ") + "";
	let t4;
	let t5;
	let td3;
	let t6_value = /*r*/ ctx[8].component.name + "";
	let t6;
	let t7;
	let tr_class_value;

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
			td2 = element("td");
			t4 = text(t4_value);
			t5 = space();
			td3 = element("td");
			t6 = text(t6_value);
			t7 = space();
			attr(td0, "id", "route.path");
			attr(td0, "class", "svelte-oi8cjc");
			attr(td1, "id", "route.guard");
			attr(td1, "class", "svelte-oi8cjc");
			attr(td2, "id", "route.key");
			attr(td2, "class", "svelte-oi8cjc");
			attr(td3, "id", "route.component");
			attr(td3, "class", "svelte-oi8cjc");

			attr(tr, "class", tr_class_value = "" + (null_to_empty(/*r*/ ctx[8] === /*$router*/ ctx[0].route
			? "current"
			: "") + " svelte-oi8cjc"));

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
			append(tr, td2);
			append(td2, t4);
			append(tr, t5);
			append(tr, td3);
			append(td3, t6);
			append(tr, t7);
		},
		p(ctx, dirty) {
			if (dirty & /*$router*/ 1 && tr_class_value !== (tr_class_value = "" + (null_to_empty(/*r*/ ctx[8] === /*$router*/ ctx[0].route
			? "current"
			: "") + " svelte-oi8cjc"))) {
				attr(tr, "class", tr_class_value);
			}
		},
		d(detaching) {
			if (detaching) detach(tr);
		}
	};
}

// (101:6) {#each Object.entries($router.params) as e (e[0])}
function create_each_block_1(key_1, ctx) {
	let tr;
	let td0;
	let t0_value = /*e*/ ctx[5][0] + "";
	let t0;
	let t1;
	let td1;
	let t2_value = /*e*/ ctx[5][1] + "";
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
			attr(td0, "class", "svelte-oi8cjc");
			attr(td1, "class", "svelte-oi8cjc");
			attr(tr, "class", "svelte-oi8cjc");
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
		p(ctx, dirty) {
			if (dirty & /*$router*/ 1 && t0_value !== (t0_value = /*e*/ ctx[5][0] + "")) set_data(t0, t0_value);
			if (dirty & /*$router*/ 1 && t2_value !== (t2_value = /*e*/ ctx[5][1] + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) detach(tr);
		}
	};
}

// (117:6) {#each Object.values($router.keys) as key}
function create_each_block(ctx) {
	let tr;
	let td0;
	let t0_value = /*key*/ ctx[2].name + "";
	let t0;
	let td0_id_value;
	let t1;
	let td1;

	let t2_value = (/*key*/ ctx[2].value !== undefined
	? /*key*/ ctx[2].value
	: "") + "";

	let t2;
	let td1_id_value;
	let t3;
	let td2;
	let t4_value = /*key*/ ctx[2].subscriptions.size + "";
	let t4;
	let td2_id_value;
	let t5;

	return {
		c() {
			tr = element("tr");
			td0 = element("td");
			t0 = text(t0_value);
			t1 = space();
			td1 = element("td");
			t2 = text(t2_value);
			t3 = space();
			td2 = element("td");
			t4 = text(t4_value);
			t5 = space();
			attr(td0, "id", td0_id_value = "state.key." + /*key*/ ctx[2].name);
			attr(td0, "class", "svelte-oi8cjc");
			attr(td1, "id", td1_id_value = "state.key." + /*key*/ ctx[2].name + ".value");
			attr(td1, "class", "svelte-oi8cjc");
			attr(td2, "id", td2_id_value = "state.key." + /*key*/ ctx[2].name + ".subscriptions");
			attr(td2, "class", "svelte-oi8cjc");
			attr(tr, "class", "svelte-oi8cjc");
		},
		m(target, anchor) {
			insert(target, tr, anchor);
			append(tr, td0);
			append(td0, t0);
			append(tr, t1);
			append(tr, td1);
			append(td1, t2);
			append(tr, t3);
			append(tr, td2);
			append(td2, t4);
			append(tr, t5);
		},
		p(ctx, dirty) {
			if (dirty & /*$router*/ 1 && t0_value !== (t0_value = /*key*/ ctx[2].name + "")) set_data(t0, t0_value);

			if (dirty & /*$router*/ 1 && td0_id_value !== (td0_id_value = "state.key." + /*key*/ ctx[2].name)) {
				attr(td0, "id", td0_id_value);
			}

			if (dirty & /*$router*/ 1 && t2_value !== (t2_value = (/*key*/ ctx[2].value !== undefined
			? /*key*/ ctx[2].value
			: "") + "")) set_data(t2, t2_value);

			if (dirty & /*$router*/ 1 && td1_id_value !== (td1_id_value = "state.key." + /*key*/ ctx[2].name + ".value")) {
				attr(td1, "id", td1_id_value);
			}

			if (dirty & /*$router*/ 1 && t4_value !== (t4_value = /*key*/ ctx[2].subscriptions.size + "")) set_data(t4, t4_value);

			if (dirty & /*$router*/ 1 && td2_id_value !== (td2_id_value = "state.key." + /*key*/ ctx[2].name + ".subscriptions")) {
				attr(td2, "id", td2_id_value);
			}
		},
		d(detaching) {
			if (detaching) detach(tr);
		}
	};
}

function create_fragment$5(ctx) {
	let div;
	let table0;
	let thead0;
	let t1;
	let tbody0;
	let t2;
	let table1;
	let thead1;
	let t4;
	let tbody1;
	let each_blocks_2 = [];
	let each0_lookup = new Map();
	let t5;
	let table2;
	let thead2;
	let t7;
	let tbody2;
	let each_blocks_1 = [];
	let each1_lookup = new Map();
	let t8;
	let table3;
	let thead3;
	let t14;
	let tbody3;
	let if_block = /*$router*/ ctx[0].transition !== undefined && create_if_block$3(ctx);
	let each_value_2 = /*router*/ ctx[1].routes;
	const get_key = ctx => /*i*/ ctx[10];

	for (let i = 0; i < each_value_2.length; i += 1) {
		let child_ctx = get_each_context_2(ctx, each_value_2, i);
		let key = get_key(child_ctx);
		each0_lookup.set(key, each_blocks_2[i] = create_each_block_2(key, child_ctx));
	}

	let each_value_1 = Object.entries(/*$router*/ ctx[0].params);
	const get_key_1 = ctx => /*e*/ ctx[5][0];

	for (let i = 0; i < each_value_1.length; i += 1) {
		let child_ctx = get_each_context_1(ctx, each_value_1, i);
		let key = get_key_1(child_ctx);
		each1_lookup.set(key, each_blocks_1[i] = create_each_block_1(key, child_ctx));
	}

	let each_value = Object.values(/*$router*/ ctx[0].keys);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			div = element("div");
			table0 = element("table");
			thead0 = element("thead");
			thead0.innerHTML = `<th colspan="2" class="svelte-oi8cjc">Transition</th>`;
			t1 = space();
			tbody0 = element("tbody");
			if (if_block) if_block.c();
			t2 = space();
			table1 = element("table");
			thead1 = element("thead");
			thead1.innerHTML = `<th colspan="4" class="svelte-oi8cjc">Routes</th>`;
			t4 = space();
			tbody1 = element("tbody");

			for (let i = 0; i < each_blocks_2.length; i += 1) {
				each_blocks_2[i].c();
			}

			t5 = space();
			table2 = element("table");
			thead2 = element("thead");
			thead2.innerHTML = `<th colspan="2" class="svelte-oi8cjc">Properties</th>`;
			t7 = space();
			tbody2 = element("tbody");

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].c();
			}

			t8 = space();
			table3 = element("table");
			thead3 = element("thead");

			thead3.innerHTML = `<th class="svelte-oi8cjc">Key</th> 
      <th class="svelte-oi8cjc">Value</th> 
      <th class="svelte-oi8cjc">Subscriptions</th>`;

			t14 = space();
			tbody3 = element("tbody");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(thead0, "class", "svelte-oi8cjc");
			attr(tbody0, "class", "svelte-oi8cjc");
			attr(table0, "class", "svelte-oi8cjc");
			attr(thead1, "class", "svelte-oi8cjc");
			attr(tbody1, "class", "svelte-oi8cjc");
			attr(table1, "class", "svelte-oi8cjc");
			attr(thead2, "class", "svelte-oi8cjc");
			attr(tbody2, "class", "svelte-oi8cjc");
			attr(table2, "class", "svelte-oi8cjc");
			attr(thead3, "class", "svelte-oi8cjc");
			attr(tbody3, "class", "svelte-oi8cjc");
			attr(table3, "class", "svelte-oi8cjc");
			attr(div, "class", "background svelte-oi8cjc");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, table0);
			append(table0, thead0);
			append(table0, t1);
			append(table0, tbody0);
			if (if_block) if_block.m(tbody0, null);
			append(div, t2);
			append(div, table1);
			append(table1, thead1);
			append(table1, t4);
			append(table1, tbody1);

			for (let i = 0; i < each_blocks_2.length; i += 1) {
				each_blocks_2[i].m(tbody1, null);
			}

			append(div, t5);
			append(div, table2);
			append(table2, thead2);
			append(table2, t7);
			append(table2, tbody2);

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].m(tbody2, null);
			}

			append(div, t8);
			append(div, table3);
			append(table3, thead3);
			append(table3, t14);
			append(table3, tbody3);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(tbody3, null);
			}
		},
		p(ctx, [dirty]) {
			if (/*$router*/ ctx[0].transition !== undefined) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block$3(ctx);
					if_block.c();
					if_block.m(tbody0, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			if (dirty & /*router, $router*/ 3) {
				const each_value_2 = /*router*/ ctx[1].routes;
				each_blocks_2 = update_keyed_each(each_blocks_2, dirty, get_key, 1, ctx, each_value_2, each0_lookup, tbody1, destroy_block, create_each_block_2, null, get_each_context_2);
			}

			if (dirty & /*Object, $router*/ 1) {
				const each_value_1 = Object.entries(/*$router*/ ctx[0].params);
				each_blocks_1 = update_keyed_each(each_blocks_1, dirty, get_key_1, 1, ctx, each_value_1, each1_lookup, tbody2, destroy_block, create_each_block_1, null, get_each_context_1);
			}

			if (dirty & /*Object, $router, undefined*/ 1) {
				each_value = Object.values(/*$router*/ ctx[0].keys);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(tbody3, null);
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
			if (detaching) detach(div);
			if (if_block) if_block.d();

			for (let i = 0; i < each_blocks_2.length; i += 1) {
				each_blocks_2[i].d();
			}

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].d();
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

function instance$5($$self, $$props, $$invalidate) {
	let $router;
	let router = getContext(ROUTER);
	component_subscribe($$self, router, value => $$invalidate(0, $router = value));
	return [$router, router];
}

class RouterState extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-oi8cjc-style")) add_css();
		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});
	}
}

/* example/src/About.svelte generated by Svelte v3.24.0 */

function create_fragment$6(ctx) {
	let h2;
	let t1;
	let a;

	return {
		c() {
			h2 = element("h2");
			h2.textContent = "About";
			t1 = text("\nExample to show all features of ");
			a = element("a");
			a.innerHTML = `<b>svelte-guard-histroy-router</b>`;
			attr(h2, "class", "routetitle");
			attr(a, "href", "https://github.com/arlac77/svelte-guard-history-router");
		},
		m(target, anchor) {
			insert(target, h2, anchor);
			insert(target, t1, anchor);
			insert(target, a, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(h2);
			if (detaching) detach(t1);
			if (detaching) detach(a);
		}
	};
}

class About extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, null, create_fragment$6, safe_not_equal, {});
	}
}

/* example/src/Articles.svelte generated by Svelte v3.24.0 */

function get_each_context$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[1] = list[i];
	return child_ctx;
}

// (9:2) {#each $articlesRoute as article}
function create_each_block$1(ctx) {
	let li;
	let objectlink;
	let t;
	let current;
	objectlink = new ObjectLink({ props: { object: /*article*/ ctx[1] } });

	return {
		c() {
			li = element("li");
			create_component(objectlink.$$.fragment);
			t = space();
		},
		m(target, anchor) {
			insert(target, li, anchor);
			mount_component(objectlink, li, null);
			append(li, t);
			current = true;
		},
		p(ctx, dirty) {
			const objectlink_changes = {};
			if (dirty & /*$articlesRoute*/ 1) objectlink_changes.object = /*article*/ ctx[1];
			objectlink.$set(objectlink_changes);
		},
		i(local) {
			if (current) return;
			transition_in(objectlink.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(objectlink.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(li);
			destroy_component(objectlink);
		}
	};
}

function create_fragment$7(ctx) {
	let h2;
	let t1;
	let ul;
	let current;
	let each_value = /*$articlesRoute*/ ctx[0];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			h2 = element("h2");
			h2.textContent = "Articles";
			t1 = space();
			ul = element("ul");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(h2, "class", "routetitle");
		},
		m(target, anchor) {
			insert(target, h2, anchor);
			insert(target, t1, anchor);
			insert(target, ul, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(ul, null);
			}

			current = true;
		},
		p(ctx, [dirty]) {
			if (dirty & /*$articlesRoute*/ 1) {
				each_value = /*$articlesRoute*/ ctx[0];
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
						each_blocks[i].m(ul, null);
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
			if (detaching) detach(h2);
			if (detaching) detach(t1);
			if (detaching) detach(ul);
			destroy_each(each_blocks, detaching);
		}
	};
}

function instance$6($$self, $$props, $$invalidate) {
	let $articlesRoute;
	component_subscribe($$self, articlesRoute, $$value => $$invalidate(0, $articlesRoute = $$value));
	return [$articlesRoute];
}

class Articles extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$6, create_fragment$7, safe_not_equal, {});
	}
}

/* example/src/Categories.svelte generated by Svelte v3.24.0 */

function get_each_context$2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[1] = list[i];
	return child_ctx;
}

// (9:2) {#each $categoriesRoute as category}
function create_each_block$2(ctx) {
	let li;
	let objectlink;
	let t;
	let current;
	objectlink = new ObjectLink({ props: { object: /*category*/ ctx[1] } });

	return {
		c() {
			li = element("li");
			create_component(objectlink.$$.fragment);
			t = space();
		},
		m(target, anchor) {
			insert(target, li, anchor);
			mount_component(objectlink, li, null);
			append(li, t);
			current = true;
		},
		p(ctx, dirty) {
			const objectlink_changes = {};
			if (dirty & /*$categoriesRoute*/ 1) objectlink_changes.object = /*category*/ ctx[1];
			objectlink.$set(objectlink_changes);
		},
		i(local) {
			if (current) return;
			transition_in(objectlink.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(objectlink.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(li);
			destroy_component(objectlink);
		}
	};
}

function create_fragment$8(ctx) {
	let h2;
	let t1;
	let ul;
	let current;
	let each_value = /*$categoriesRoute*/ ctx[0];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			h2 = element("h2");
			h2.textContent = "Categories";
			t1 = space();
			ul = element("ul");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(h2, "class", "routetitle");
		},
		m(target, anchor) {
			insert(target, h2, anchor);
			insert(target, t1, anchor);
			insert(target, ul, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(ul, null);
			}

			current = true;
		},
		p(ctx, [dirty]) {
			if (dirty & /*$categoriesRoute*/ 1) {
				each_value = /*$categoriesRoute*/ ctx[0];
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
						each_blocks[i].m(ul, null);
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
			if (detaching) detach(h2);
			if (detaching) detach(t1);
			if (detaching) detach(ul);
			destroy_each(each_blocks, detaching);
		}
	};
}

function instance$7($$self, $$props, $$invalidate) {
	let $categoriesRoute;
	component_subscribe($$self, categoriesRoute, $$value => $$invalidate(0, $categoriesRoute = $$value));
	return [$categoriesRoute];
}

class Categories extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$7, create_fragment$8, safe_not_equal, {});
	}
}

/* example/src/Login.svelte generated by Svelte v3.24.0 */

function create_if_block$4(ctx) {
	let div;
	let t;

	return {
		c() {
			div = element("div");
			t = text(/*message*/ ctx[2]);
			attr(div, "id", "message");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, t);
		},
		p(ctx, dirty) {
			if (dirty & /*message*/ 4) set_data(t, /*message*/ ctx[2]);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

function create_fragment$9(ctx) {
	let div;
	let form;
	let t0;
	let label0;
	let t1;
	let input0;
	let t2;
	let label1;
	let t3;
	let input1;
	let t4;
	let button;
	let t5;
	let button_disabled_value;
	let mounted;
	let dispose;
	let if_block = /*message*/ ctx[2] && create_if_block$4(ctx);

	return {
		c() {
			div = element("div");
			form = element("form");
			if (if_block) if_block.c();
			t0 = space();
			label0 = element("label");
			t1 = text("Username\n      ");
			input0 = element("input");
			t2 = space();
			label1 = element("label");
			t3 = text("Password\n      ");
			input1 = element("input");
			t4 = space();
			button = element("button");
			t5 = text("Login");
			attr(input0, "id", "username");
			attr(input0, "type", "text");
			attr(input0, "placeholder", "Username");
			attr(input0, "name", "username");
			attr(input0, "size", "20");
			input0.required = true;
			attr(label0, "for", "username");
			attr(input1, "id", "password");
			attr(input1, "type", "password");
			attr(input1, "placeholder", "Password");
			attr(input1, "name", "password");
			attr(input1, "size", "20");
			input1.required = true;
			attr(label1, "for", "password");
			attr(button, "id", "submit");
			attr(button, "type", "submit");
			button.disabled = button_disabled_value = !/*username*/ ctx[0] || !/*password*/ ctx[1];
			attr(div, "class", "center");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, form);
			if (if_block) if_block.m(form, null);
			append(form, t0);
			append(form, label0);
			append(label0, t1);
			append(label0, input0);
			set_input_value(input0, /*username*/ ctx[0]);
			append(form, t2);
			append(form, label1);
			append(label1, t3);
			append(label1, input1);
			set_input_value(input1, /*password*/ ctx[1]);
			append(form, t4);
			append(form, button);
			append(button, t5);

			if (!mounted) {
				dispose = [
					listen(input0, "input", /*input0_input_handler*/ ctx[4]),
					listen(input1, "input", /*input1_input_handler*/ ctx[5]),
					listen(form, "submit", prevent_default(/*submit*/ ctx[3]))
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (/*message*/ ctx[2]) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block$4(ctx);
					if_block.c();
					if_block.m(form, t0);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			if (dirty & /*username*/ 1 && input0.value !== /*username*/ ctx[0]) {
				set_input_value(input0, /*username*/ ctx[0]);
			}

			if (dirty & /*password*/ 2 && input1.value !== /*password*/ ctx[1]) {
				set_input_value(input1, /*password*/ ctx[1]);
			}

			if (dirty & /*username, password*/ 3 && button_disabled_value !== (button_disabled_value = !/*username*/ ctx[0] || !/*password*/ ctx[1])) {
				button.disabled = button_disabled_value;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
			if (if_block) if_block.d();
			mounted = false;
			run_all(dispose);
		}
	};
}

async function login(username, password) {
	return new Promise((resolve, reject) => {
			setTimeout(
				() => {
					if (username === "user" && password === "secret") {
						sessionStorage.session = { username, password };
						resolve();
					} else {
						reject(new Error("invalid credentials"));
					}
				},
				500
			);
		});
}

function instance$8($$self, $$props, $$invalidate) {
	const router = getContext(ROUTER);
	let username = "user";
	let password = "secret";
	let message;

	async function submit() {
		try {
			await login(username, password);
			setSession({ username });
			await router.continue();
		} catch(e) {
			console.log(e);
			$$invalidate(2, message = e);
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

	return [
		username,
		password,
		message,
		submit,
		input0_input_handler,
		input1_input_handler
	];
}

class Login extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$8, create_fragment$9, safe_not_equal, {});
	}
}

/* example/src/Home.svelte generated by Svelte v3.24.0 */

function create_fragment$a(ctx) {
	let h2;
	let t1;
	let p0;
	let t3;
	let p1;
	let t5;
	let ul;

	return {
		c() {
			h2 = element("h2");
			h2.textContent = "Home";
			t1 = space();
			p0 = element("p");
			p0.textContent = "Welcome to the router example code!";
			t3 = space();
			p1 = element("p");
			p1.textContent = "Things to try:";
			t5 = space();
			ul = element("ul");

			ul.innerHTML = `<li>Navigate around with the links and buttons (notice how certain links become active depending on the path</li> 
    <li>Try pressing the browsers&#39; back and forward buttons</li> 
    <li>Manually change the URL&#39;s path</li> 
    <li>Try refreshing the page</li> 
    <li>check router state</li>`;

			attr(h2, "class", "routetitle");
		},
		m(target, anchor) {
			insert(target, h2, anchor);
			insert(target, t1, anchor);
			insert(target, p0, anchor);
			insert(target, t3, anchor);
			insert(target, p1, anchor);
			insert(target, t5, anchor);
			insert(target, ul, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(h2);
			if (detaching) detach(t1);
			if (detaching) detach(p0);
			if (detaching) detach(t3);
			if (detaching) detach(p1);
			if (detaching) detach(t5);
			if (detaching) detach(ul);
		}
	};
}

class Home extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, null, create_fragment$a, safe_not_equal, {});
	}
}

/* example/src/NoWay.svelte generated by Svelte v3.24.0 */

function create_fragment$b(ctx) {
	let h2;
	let t1;

	return {
		c() {
			h2 = element("h2");
			h2.textContent = "NoWay";
			t1 = text("\nthis page should no be reachable");
			attr(h2, "class", "routetitle");
		},
		m(target, anchor) {
			insert(target, h2, anchor);
			insert(target, t1, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(h2);
			if (detaching) detach(t1);
		}
	};
}

class NoWay extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, null, create_fragment$b, safe_not_equal, {});
	}
}

/* example/src/App.svelte generated by Svelte v3.24.0 */

function create_default_slot_6(ctx) {
	let t;

	return {
		c() {
			t = text("Router Example");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (30:8) <Route path="/about" component={About}>
function create_default_slot_5(ctx) {
	let t;

	return {
		c() {
			t = text("About");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (33:8) <Link href="/article">
function create_default_slot_4(ctx) {
	let t;

	return {
		c() {
			t = text("Articles");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (36:8) <Link href="/category">
function create_default_slot_3(ctx) {
	let t;

	return {
		c() {
			t = text("Categories");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (48:8) <Route path="/noway" guards={new AlwaysThrowGuard()} component={NoWay}>
function create_default_slot_2(ctx) {
	let t;

	return {
		c() {
			t = text("Does Not Work");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (63:4) <Outlet>
function create_default_slot_1(ctx) {
	let t;

	return {
		c() {
			t = text("nothing there");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (66:2) {#if showState}
function create_if_block$5(ctx) {
	let routerstate;
	let current;
	routerstate = new RouterState({});

	return {
		c() {
			create_component(routerstate.$$.fragment);
		},
		m(target, anchor) {
			mount_component(routerstate, target, anchor);
			current = true;
		},
		i(local) {
			if (current) return;
			transition_in(routerstate.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(routerstate.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(routerstate, detaching);
		}
	};
}

// (23:0) <Router   routes={[categoriesRoute, categoryRoute, articlesRoute, articleRoute]}   base="/components/svelte-guard-history-router/example">
function create_default_slot$1(ctx) {
	let nav;
	let route0;
	let t0;
	let ul0;
	let li0;
	let route1;
	let t1;
	let li1;
	let link0;
	let t2;
	let li2;
	let link1;
	let t3;
	let li3;
	let route2;
	let t4;
	let ul1;
	let li4;
	let t5;
	let input;
	let t6;
	let route3;
	let t7;
	let main;
	let outlet;
	let t8;
	let if_block_anchor;
	let current;
	let mounted;
	let dispose;

	route0 = new Route({
			props: {
				href: "/",
				path: "*",
				component: Home,
				$$slots: { default: [create_default_slot_6] },
				$$scope: { ctx }
			}
		});

	route1 = new Route({
			props: {
				path: "/about",
				component: About,
				$$slots: { default: [create_default_slot_5] },
				$$scope: { ctx }
			}
		});

	link0 = new Link({
			props: {
				href: "/article",
				$$slots: { default: [create_default_slot_4] },
				$$scope: { ctx }
			}
		});

	link1 = new Link({
			props: {
				href: "/category",
				$$slots: { default: [create_default_slot_3] },
				$$scope: { ctx }
			}
		});

	route2 = new Route({
			props: {
				path: "/noway",
				guards: new AlwaysThrowGuard(),
				component: NoWay,
				$$slots: { default: [create_default_slot_2] },
				$$scope: { ctx }
			}
		});

	route3 = new Route({
			props: { path: "/login", component: Login }
		});

	outlet = new Outlet({
			props: {
				$$slots: { default: [create_default_slot_1] },
				$$scope: { ctx }
			}
		});

	let if_block = /*showState*/ ctx[0] && create_if_block$5();

	return {
		c() {
			nav = element("nav");
			create_component(route0.$$.fragment);
			t0 = space();
			ul0 = element("ul");
			li0 = element("li");
			create_component(route1.$$.fragment);
			t1 = space();
			li1 = element("li");
			create_component(link0.$$.fragment);
			t2 = space();
			li2 = element("li");
			create_component(link1.$$.fragment);
			t3 = space();
			li3 = element("li");
			create_component(route2.$$.fragment);
			t4 = space();
			ul1 = element("ul");
			li4 = element("li");
			t5 = text("Router\n        ");
			input = element("input");
			t6 = space();
			create_component(route3.$$.fragment);
			t7 = space();
			main = element("main");
			create_component(outlet.$$.fragment);
			t8 = space();
			if (if_block) if_block.c();
			if_block_anchor = empty();
			attr(ul0, "class", "left");
			attr(input, "type", "checkbox");
			attr(input, "id", "state");
		},
		m(target, anchor) {
			insert(target, nav, anchor);
			mount_component(route0, nav, null);
			append(nav, t0);
			append(nav, ul0);
			append(ul0, li0);
			mount_component(route1, li0, null);
			append(ul0, t1);
			append(ul0, li1);
			mount_component(link0, li1, null);
			append(ul0, t2);
			append(ul0, li2);
			mount_component(link1, li2, null);
			append(ul0, t3);
			append(ul0, li3);
			mount_component(route2, li3, null);
			append(nav, t4);
			append(nav, ul1);
			append(ul1, li4);
			append(li4, t5);
			append(li4, input);
			input.checked = /*showState*/ ctx[0];
			insert(target, t6, anchor);
			mount_component(route3, target, anchor);
			insert(target, t7, anchor);
			insert(target, main, anchor);
			mount_component(outlet, main, null);
			insert(target, t8, anchor);
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;

			if (!mounted) {
				dispose = listen(input, "change", /*input_change_handler*/ ctx[1]);
				mounted = true;
			}
		},
		p(ctx, dirty) {
			const route0_changes = {};

			if (dirty & /*$$scope*/ 4) {
				route0_changes.$$scope = { dirty, ctx };
			}

			route0.$set(route0_changes);
			const route1_changes = {};

			if (dirty & /*$$scope*/ 4) {
				route1_changes.$$scope = { dirty, ctx };
			}

			route1.$set(route1_changes);
			const link0_changes = {};

			if (dirty & /*$$scope*/ 4) {
				link0_changes.$$scope = { dirty, ctx };
			}

			link0.$set(link0_changes);
			const link1_changes = {};

			if (dirty & /*$$scope*/ 4) {
				link1_changes.$$scope = { dirty, ctx };
			}

			link1.$set(link1_changes);
			const route2_changes = {};

			if (dirty & /*$$scope*/ 4) {
				route2_changes.$$scope = { dirty, ctx };
			}

			route2.$set(route2_changes);

			if (dirty & /*showState*/ 1) {
				input.checked = /*showState*/ ctx[0];
			}

			const outlet_changes = {};

			if (dirty & /*$$scope*/ 4) {
				outlet_changes.$$scope = { dirty, ctx };
			}

			outlet.$set(outlet_changes);

			if (/*showState*/ ctx[0]) {
				if (if_block) {
					if (dirty & /*showState*/ 1) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block$5();
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
			transition_in(route0.$$.fragment, local);
			transition_in(route1.$$.fragment, local);
			transition_in(link0.$$.fragment, local);
			transition_in(link1.$$.fragment, local);
			transition_in(route2.$$.fragment, local);
			transition_in(route3.$$.fragment, local);
			transition_in(outlet.$$.fragment, local);
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(route0.$$.fragment, local);
			transition_out(route1.$$.fragment, local);
			transition_out(link0.$$.fragment, local);
			transition_out(link1.$$.fragment, local);
			transition_out(route2.$$.fragment, local);
			transition_out(route3.$$.fragment, local);
			transition_out(outlet.$$.fragment, local);
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(nav);
			destroy_component(route0);
			destroy_component(route1);
			destroy_component(link0);
			destroy_component(link1);
			destroy_component(route2);
			if (detaching) detach(t6);
			destroy_component(route3, detaching);
			if (detaching) detach(t7);
			if (detaching) detach(main);
			destroy_component(outlet);
			if (detaching) detach(t8);
			if (if_block) if_block.d(detaching);
			if (detaching) detach(if_block_anchor);
			mounted = false;
			dispose();
		}
	};
}

function create_fragment$c(ctx) {
	let router;
	let current;

	router = new Router({
			props: {
				routes: [categoriesRoute, categoryRoute, articlesRoute, articleRoute],
				base: "/components/svelte-guard-history-router/example",
				$$slots: { default: [create_default_slot$1] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(router.$$.fragment);
		},
		m(target, anchor) {
			mount_component(router, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const router_changes = {};

			if (dirty & /*$$scope, showState*/ 5) {
				router_changes.$$scope = { dirty, ctx };
			}

			router.$set(router_changes);
		},
		i(local) {
			if (current) return;
			transition_in(router.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(router.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(router, detaching);
		}
	};
}

function instance$9($$self, $$props, $$invalidate) {
	let showState = true;

	function input_change_handler() {
		showState = this.checked;
		$$invalidate(0, showState);
	}

	return [showState, input_change_handler];
}

class App extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$9, create_fragment$c, safe_not_equal, {});
	}
}

/* example/src/Waiting.svelte generated by Svelte v3.24.0 */

function create_fragment$d(ctx) {
	let h1;

	return {
		c() {
			h1 = element("h1");
			h1.textContent = "Waiting...";
			attr(h1, "class", "routetitle");
		},
		m(target, anchor) {
			insert(target, h1, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(h1);
		}
	};
}

class Waiting extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, null, create_fragment$d, safe_not_equal, {});
	}
}

/* example/src/Category.svelte generated by Svelte v3.24.0 */

function get_each_context$3(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[1] = list[i];
	return child_ctx;
}

// (14:0) {:else}
function create_else_block$2(ctx) {
	let t;

	return {
		c() {
			t = text("No such category");
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

// (6:0) {#if $categoryRoute}
function create_if_block$6(ctx) {
	let h2;
	let t0;
	let t1_value = /*$categoryRoute*/ ctx[0].name + "";
	let t1;
	let t2;
	let each_1_anchor;
	let current;
	let each_value = /*$categoryRoute*/ ctx[0].articles;
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			h2 = element("h2");
			t0 = text("Category ");
			t1 = text(t1_value);
			t2 = space();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
			attr(h2, "class", "routetitle");
		},
		m(target, anchor) {
			insert(target, h2, anchor);
			append(h2, t0);
			append(h2, t1);
			insert(target, t2, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(target, anchor);
			}

			insert(target, each_1_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if ((!current || dirty & /*$categoryRoute*/ 1) && t1_value !== (t1_value = /*$categoryRoute*/ ctx[0].name + "")) set_data(t1, t1_value);

			if (dirty & /*$categoryRoute*/ 1) {
				each_value = /*$categoryRoute*/ ctx[0].articles;
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$3(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block$3(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
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
			if (detaching) detach(h2);
			if (detaching) detach(t2);
			destroy_each(each_blocks, detaching);
			if (detaching) detach(each_1_anchor);
		}
	};
}

// (9:2) {#each $categoryRoute.articles as article}
function create_each_block$3(ctx) {
	let li;
	let objectlink;
	let t;
	let current;
	objectlink = new ObjectLink({ props: { object: /*article*/ ctx[1] } });

	return {
		c() {
			li = element("li");
			create_component(objectlink.$$.fragment);
			t = space();
		},
		m(target, anchor) {
			insert(target, li, anchor);
			mount_component(objectlink, li, null);
			append(li, t);
			current = true;
		},
		p(ctx, dirty) {
			const objectlink_changes = {};
			if (dirty & /*$categoryRoute*/ 1) objectlink_changes.object = /*article*/ ctx[1];
			objectlink.$set(objectlink_changes);
		},
		i(local) {
			if (current) return;
			transition_in(objectlink.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(objectlink.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(li);
			destroy_component(objectlink);
		}
	};
}

function create_fragment$e(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block$6, create_else_block$2];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*$categoryRoute*/ ctx[0]) return 0;
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

function instance$a($$self, $$props, $$invalidate) {
	let $categoryRoute;
	component_subscribe($$self, categoryRoute, $$value => $$invalidate(0, $categoryRoute = $$value));
	return [$categoryRoute];
}

class Category extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$a, create_fragment$e, safe_not_equal, {});
	}
}

/* example/src/CategoryLink.svelte generated by Svelte v3.24.0 */

function create_fragment$f(ctx) {
	let t_value = /*object*/ ctx[0].name + "";
	let t;

	return {
		c() {
			t = text(t_value);
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p(ctx, [dirty]) {
			if (dirty & /*object*/ 1 && t_value !== (t_value = /*object*/ ctx[0].name + "")) set_data(t, t_value);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

function instance$b($$self, $$props, $$invalidate) {
	let { object } = $$props;

	$$self.$set = $$props => {
		if ("object" in $$props) $$invalidate(0, object = $$props.object);
	};

	return [object];
}

class CategoryLink extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$b, create_fragment$f, safe_not_equal, { object: 0 });
	}
}

/* example/src/Article.svelte generated by Svelte v3.24.0 */

function add_css$1() {
	var style = element("style");
	style.id = "svelte-q1ek6l-style";
	style.textContent = ".price.svelte-q1ek6l{font-weight:bold\n}";
	append(document.head, style);
}

// (27:0) {:else}
function create_else_block$3(ctx) {
	let t;

	return {
		c() {
			t = text("No such article");
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

// (11:0) {#if $articleRoute}
function create_if_block$7(ctx) {
	let h2;
	let t0;
	let t1_value = /*$articleRoute*/ ctx[0].name + "";
	let t1;
	let t2;
	let div0;
	let t3;
	let t4_value = /*$articleRoute*/ ctx[0].id + "";
	let t4;
	let t5;
	let div1;
	let t6_value = /*$articleRoute*/ ctx[0].price + "";
	let t6;
	let t7;
	let t8;
	let objectlink;
	let t9;
	let div2;
	let link0;
	let t10;
	let link1;
	let current;

	objectlink = new ObjectLink({
			props: {
				object: /*$articleRoute*/ ctx[0].category
			}
		});

	link0 = new Link({
			props: {
				href: "/article/" + ("00" + (parseInt(/*$articleRoute*/ ctx[0].id) + 1)).replace(/.*(\d\d)$/, "$1"),
				$$slots: { default: [create_default_slot_1$1] },
				$$scope: { ctx }
			}
		});

	link1 = new Link({
			props: {
				href: "/article/" + ("00" + (parseInt(/*$articleRoute*/ ctx[0].id) - 1)).replace(/.*(\d\d)$/, "$1"),
				$$slots: { default: [create_default_slot$2] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			h2 = element("h2");
			t0 = text("Article ");
			t1 = text(t1_value);
			t2 = space();
			div0 = element("div");
			t3 = text("Id: ");
			t4 = text(t4_value);
			t5 = space();
			div1 = element("div");
			t6 = text(t6_value);
			t7 = text(" $");
			t8 = space();
			create_component(objectlink.$$.fragment);
			t9 = space();
			div2 = element("div");
			create_component(link0.$$.fragment);
			t10 = space();
			create_component(link1.$$.fragment);
			attr(h2, "class", "routetitle");
			attr(div1, "class", "price svelte-q1ek6l");
		},
		m(target, anchor) {
			insert(target, h2, anchor);
			append(h2, t0);
			append(h2, t1);
			insert(target, t2, anchor);
			insert(target, div0, anchor);
			append(div0, t3);
			append(div0, t4);
			insert(target, t5, anchor);
			insert(target, div1, anchor);
			append(div1, t6);
			append(div1, t7);
			insert(target, t8, anchor);
			mount_component(objectlink, target, anchor);
			insert(target, t9, anchor);
			insert(target, div2, anchor);
			mount_component(link0, div2, null);
			append(div2, t10);
			mount_component(link1, div2, null);
			current = true;
		},
		p(ctx, dirty) {
			if ((!current || dirty & /*$articleRoute*/ 1) && t1_value !== (t1_value = /*$articleRoute*/ ctx[0].name + "")) set_data(t1, t1_value);
			if ((!current || dirty & /*$articleRoute*/ 1) && t4_value !== (t4_value = /*$articleRoute*/ ctx[0].id + "")) set_data(t4, t4_value);
			if ((!current || dirty & /*$articleRoute*/ 1) && t6_value !== (t6_value = /*$articleRoute*/ ctx[0].price + "")) set_data(t6, t6_value);
			const objectlink_changes = {};
			if (dirty & /*$articleRoute*/ 1) objectlink_changes.object = /*$articleRoute*/ ctx[0].category;
			objectlink.$set(objectlink_changes);
			const link0_changes = {};
			if (dirty & /*$articleRoute*/ 1) link0_changes.href = "/article/" + ("00" + (parseInt(/*$articleRoute*/ ctx[0].id) + 1)).replace(/.*(\d\d)$/, "$1");

			if (dirty & /*$$scope*/ 2) {
				link0_changes.$$scope = { dirty, ctx };
			}

			link0.$set(link0_changes);
			const link1_changes = {};
			if (dirty & /*$articleRoute*/ 1) link1_changes.href = "/article/" + ("00" + (parseInt(/*$articleRoute*/ ctx[0].id) - 1)).replace(/.*(\d\d)$/, "$1");

			if (dirty & /*$$scope*/ 2) {
				link1_changes.$$scope = { dirty, ctx };
			}

			link1.$set(link1_changes);
		},
		i(local) {
			if (current) return;
			transition_in(objectlink.$$.fragment, local);
			transition_in(link0.$$.fragment, local);
			transition_in(link1.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(objectlink.$$.fragment, local);
			transition_out(link0.$$.fragment, local);
			transition_out(link1.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(h2);
			if (detaching) detach(t2);
			if (detaching) detach(div0);
			if (detaching) detach(t5);
			if (detaching) detach(div1);
			if (detaching) detach(t8);
			destroy_component(objectlink, detaching);
			if (detaching) detach(t9);
			if (detaching) detach(div2);
			destroy_component(link0);
			destroy_component(link1);
		}
	};
}

// (18:4) <Link       href="/article/{('00' + (parseInt($articleRoute.id) + 1)).replace(/.*(\d\d)$/, '$1')}">
function create_default_slot_1$1(ctx) {
	let t;

	return {
		c() {
			t = text("Next");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (22:4) <Link       href="/article/{('00' + (parseInt($articleRoute.id) - 1)).replace(/.*(\d\d)$/, '$1')}">
function create_default_slot$2(ctx) {
	let t;

	return {
		c() {
			t = text("Prev");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

function create_fragment$g(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block$7, create_else_block$3];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*$articleRoute*/ ctx[0]) return 0;
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

function instance$c($$self, $$props, $$invalidate) {
	let $articleRoute;
	component_subscribe($$self, articleRoute, $$value => $$invalidate(0, $articleRoute = $$value));
	return [$articleRoute];
}

class Article extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-q1ek6l-style")) add_css$1();
		init(this, options, instance$c, create_fragment$g, safe_not_equal, {});
	}
}

/* example/src/ArticleLink.svelte generated by Svelte v3.24.0 */

function create_fragment$h(ctx) {
	let t0_value = /*object*/ ctx[0].name + "";
	let t0;
	let t1;
	let t2_value = /*object*/ ctx[0].id + "";
	let t2;
	let t3;

	return {
		c() {
			t0 = text(t0_value);
			t1 = text(" (");
			t2 = text(t2_value);
			t3 = text(")");
		},
		m(target, anchor) {
			insert(target, t0, anchor);
			insert(target, t1, anchor);
			insert(target, t2, anchor);
			insert(target, t3, anchor);
		},
		p(ctx, [dirty]) {
			if (dirty & /*object*/ 1 && t0_value !== (t0_value = /*object*/ ctx[0].name + "")) set_data(t0, t0_value);
			if (dirty & /*object*/ 1 && t2_value !== (t2_value = /*object*/ ctx[0].id + "")) set_data(t2, t2_value);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(t0);
			if (detaching) detach(t1);
			if (detaching) detach(t2);
			if (detaching) detach(t3);
		}
	};
}

function instance$d($$self, $$props, $$invalidate) {
	let { object } = $$props;

	$$self.$set = $$props => {
		if ("object" in $$props) $$invalidate(0, object = $$props.object);
	};

	return [object];
}

class ArticleLink extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$d, create_fragment$h, safe_not_equal, { object: 0 });
	}
}

class AlwaysThrowGuard extends Guard {
  async enter(transition) {
    throw new Error("never go there");
  }
}

let session;

function setSession(s) {
  session = s;
}

if (sessionStorage.session) {
  setSession(sessionStorage.session);
}

class SessionGuard extends Guard {
  async enter(transition) {
    if (!session) {
      return transition.redirect("/login");
    }
  }
}

const sessionGuard = new SessionGuard();
const waitingGuard = new WaitingGuard(Waiting);

async function delay(msecs=1000)
{
  return new Promise(r => setTimeout(r, msecs));
}

class ArticlesRoute extends IteratorStoreRoute {
  async *iteratorFor() {
    await delay(2000);

    for (const a of Object.values(articles)) {
      yield a;
    }
  }
}

class ArticleRoute extends ObjectStoreRoute {
  async objectFor(properties) {
    return articles[properties.article];
  }

  propertiesFor(article) {
    return article.id ? { article: article.id } : undefined;
  }
}

class CategoriesRoute extends IteratorStoreRoute {
  async *iteratorFor() {
    await delay(2000);

    for (const c of Object.values(categories)) {
      yield c;
    }
  }
}

class CategoryRoute extends ObjectStoreRoute {
  async objectFor(properties) {
    return categories[properties.category];
  }

  propertiesFor(category) {
    return category.name && category.articles ? { category: category.name } : undefined;
  }
}

const categoriesRoute = route(
  "/category",
  CategoriesRoute,
  sessionGuard,
  waitingGuard,
  Categories
);

const categoryRoute = route(
  categoriesRoute,
  "/:category",
  CategoryRoute,
  Category
);
categoryRoute.linkComponent = CategoryLink;

const articlesRoute = route(
  "/article",
  ArticlesRoute,
  sessionGuard,
  waitingGuard,
  Articles
);

const articleRoute = route(
  articlesRoute,
  "/:article",
  ArticleRoute,
  Article
);
articleRoute.linkComponent = ArticleLink;

var index = new App({
  target: document.body
});

export default index;
export { AlwaysThrowGuard, articleRoute, articlesRoute, categoriesRoute, categoryRoute, sessionGuard, setSession, waitingGuard };
//# sourceMappingURL=bundle.mjs.map
