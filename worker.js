self.addEventListener('install', ev => {
    self.skipWaiting();
    ev.waitUntil(Head.cache());
});
self.addEventListener('activate', ev => ev.waitUntil(clients.claim()));
self.addEventListener('fetch', ev => ev.respondWith((() => {
    let req = ev.request;
    let action = new URLPattern({pathname: '/x/sw/'}).exec(req.url);
    if (action)
        return actions(action.search.groups[0].split('='));

    return caches.match(req.url, {ignoreSearch: true})
        .then(async cached => {
            if (cached && is.part(req.url))
                return cached;
            let fetched = fetch.net(req);
            cached || (fetched = await fetched);
            return is.html(req.url) ? Head.add(cached || fetched) : cached || fetched;
        })
        .catch(er => {
            if (`${er}`.includes('Failed to fetch')) return;
            console.error(req.url);
            console.error(er);
            new URLPattern({hostname: location.host, pathname: '/x/'}).test(req.url) && self.registration.unregister();
        });
})()));

const actions = ([key, value]) => (actions[key]?.[value] ?? actions[key]?._)?.(value)
    .then(() => new Response('', {status: 200}))
    .catch(er => console.error(er) ?? new Response('', {status: 400})) 
    ?? new Response('', {status: 404});

Object.assign(actions, {
    delete: {
        parts: () => fetch('db/-update.json').then(() => caches.delete('X/parts')),
        head: () => caches.open('X').then(cache => cache.add(Head.url)),
        _: file => fetch('db/-update.json')
            .then(() => caches.open('X'))
            .then(cache => cache.keys().then(reqs => reqs.forEach(req => new RegExp(`\\.${file}$`).test(req.url) && cache.delete(req))))
    }
});

const is = {
    internal: url => location.host == new URL(url).host,
    cacheable: url => is.internal(url) && !/\.json$/.test(new URL(url).pathname) 
        || ['fonts.googleapis.com', 'aeoq.github.io'].includes(new URL(url).host) 
        || [/cdn\.?js/, /firacode/].some(r => r.test(url)),
    volatile: url => is.internal(url) && /\.(?:js|css|json)$/.test(new URL(url).pathname),
    part: url => is.internal(url) && new URLPattern({pathname: '/x/img/*/*.png'}).test(url),
    html: url => new URLPattern({pathname: '*(/|.html)'}).test(url),
}
const to = {
    random: req => new Request(`${req.url}?${Math.random()}`, req),
    stripped: res => res.url.replace(/[?#].*$/, ''),
    opaque: req => /takaratomy/.test(req.url) ? {mode: 'no-cors'} : 
        new URLPattern({hostname: 'aeoq.github.io', pathname: '*.css'}).test(req.url) ? {mode: 'cors', credentials: 'omit'} : null
}
fetch.net = req => fetch(is.volatile(req.url) ? to.random(req) : req, to.opaque(req))
    .then(res => {
        if (!res.url || !res.ok || res.status == 206 || !is.cacheable(req.url))
            return res;
        let cloned = res.clone();
        caches.open(is.part(res.url) ? 'X/parts' : 'X').then(cache => cache.put(to.stripped(res), cloned)); 
        return res;
    });

const Head = {
    url: '/x/include/head.html',
    manifest: {
        name: "非官方資訊站",
        display: "standalone",
        start_url: `https://${location.host}/x/`,
        theme_color: "%23b0ff50",
        icons: [{src: `https://${location.host}/x/img/blade/CX/chip/Vl.png`, type: "image/png", sizes: "512x512"}]
    },
    code: () => `
<link rel="icon" href="https://${location.host}/x/img/blade/CX/chip/Vl.png" type="image/png">
<link rel="manifest" href='data:application/manifest+json,${JSON.stringify(Head.manifest)}'>`,

    cache: () => caches.open('X').then(cache => Promise.all([
        cache.add(Head.url), cache.add('/x/parts/bg.svg'), cache.add('/x/bg.mp4')
    ])),

    fetch: () => caches.match(Head.url).then(resp => resp.text()),

    add: async resp => new Response(await Head.fetch() + Head.code() + await resp.text(), Head.response(resp)),
            
    response: ({status, statusText, headers}) => ({status, statusText, headers})
}
