// Tarayıcı demo sürümü için Express'in sunucu kodunda kullanılan küçük alt kümesi:
// Router (get/post/put/patch/delete/use), express.json(). Tüm işleyiciler eşzamanlıdır.

function compilePath(path) {
  const parts = path.split('/').filter(Boolean);
  return (url) => {
    const segs = url.split('/').filter(Boolean);
    if (segs.length !== parts.length) return null;
    const params = {};
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(':')) params[parts[i].slice(1)] = decodeURIComponent(segs[i]);
      else if (parts[i] !== segs[i]) return null;
    }
    return params;
  };
}

export function Router() {
  const stack = [];

  function router(req, res, done) {
    let index = 0;
    const next = (err) => {
      if (res.finished) return;
      const layer = stack[index++];
      if (!layer) return done(err);
      try {
        if (layer.use) {
          if (layer.paths && !layer.paths.some((p) => req.path === p || req.path.startsWith(`${p}/`))) return next(err);
          const fn = layer.handler;
          if (err) return fn.length === 4 ? fn(err, req, res, next) : next(err);
          if (fn.length === 4) return next();
          return fn(req, res, next);
        }
        if (err || layer.method !== req.method) return next(err);
        const params = layer.match(req.path);
        if (!params) return next();
        req.params = params;
        let h = 0;
        const step = (e) => {
          if (e) return next(e);
          const fn = layer.handlers[h++];
          if (!fn) return next();
          try {
            fn(req, res, step);
          } catch (ex) {
            next(ex);
          }
        };
        step();
      } catch (ex) {
        next(ex);
      }
    };
    next();
  }

  const route = (method) => (path, ...handlers) => {
    stack.push({ method, match: compilePath(path), handlers: handlers.flat() });
    return router;
  };
  router.get = route('GET');
  router.post = route('POST');
  router.put = route('PUT');
  router.patch = route('PATCH');
  router.delete = route('DELETE');
  router.use = (...args) => {
    const paths = typeof args[0] === 'string' || Array.isArray(args[0]) ? [].concat(args.shift()) : null;
    for (const handler of args.flat()) stack.push({ use: true, paths, handler });
    return router;
  };
  return router;
}

function express() {
  throw new Error('Demo sürümünde yalnızca Router kullanılabilir.');
}
express.Router = Router;
express.json = () => (_req, _res, next) => next();

export default express;
