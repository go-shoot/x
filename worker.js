self.addEventListener('install', ev => {
    self.skipWaiting();
    caches.delete('BBX');
    caches.delete('json');
    ev.waitUntil(Head.cache());
});
self.addEventListener('activate', ev => ev.waitUntil(clients.claim()));
self.addEventListener('fetch', ev => ev.respondWith((() => {
    if (/sw\/$/.test(new URL(ev.request.url).pathname)) {
        let [[field, value]] = new URLSearchParams(new URL(ev.request.url).search);
        return (actions[field]?.[value] ?? actions[field]?._)?.(value)
            .then(() => new Response('', {status: 200}))
            .catch(er => console.error(er) ?? new Response('', {status: 400})) ?? new Response('', {status: 404});
    }
    return (is.internal(ev.request.url) ? caches.match(ev.request.url, {ignoreSearch: true}) : Promise.resolve())
        .then(cached => {
            if (cached && (is.part(ev.request.url) || is.stable(ev.request.url)))
                return cached;
            let fetching = fetch.net(ev.request);
            return cached ? is.html(ev.request.url) ? Head.add(cached) : cached : fetching;
        }).catch(console.error);
})()));

const actions = {
    delete: {
        parts: () => fetch('db/-update.json').then(() => caches.delete('X/parts')),
        head: () => caches.open('X').then(cache => cache.add(Head.url)),
        _: extension => fetch('db/-update.json')
            .then(() => caches.open('X'))
            .then(cache => cache.keys().then(reqs => reqs.forEach(req => new RegExp(`\\.${extension}$`).test(req.url) && cache.delete(req))))
    }
}

const is = {
    internal: url => ['aeoq.github.io', new URL(location.href).host].includes(new URL(url).host),
    cacheable: url => (is.internal(url) || /cdn\.?js/.test(url)) && !/\.json$/.test(new URL(url).pathname),
    stable: url => /bg.mp4$/.test(new URL(url).pathname),
    volatile: url => /\.(?:css|js|json)$|head\.html$/.test(new URL(url).pathname),
    image: url => /\.(?:ico|svg|jpeg|jpg|png)$/.test(new URL(url).pathname),
    part: url => /img\/.+?\/.+?\.png$/.test(new URL(url).pathname),
    html: url => /(?:\/|\.html)$/.test(new URL(url).pathname),
    opaque: url => /takaratomy/.test(url) ? {mode: 'no-cors'} : 
        /aeoq\.github\.io.+\.css/.test(url) ? {mode: 'cors', credentials: 'omit'} : null
}
fetch.net = req => {
    is.internal(req.url) && is.volatile(req.url) && (req = new Request(`${req.url}?${Math.random()}`, req));
    return fetch(req, is.opaque(req.url)).then(res => 
        (res.status < 400 && is.cacheable(req.url) ? fetch.cache(res) : Promise.resolve(res))
        .then(res => is.html(req.url) ? Head.add(res) : res)
    ).catch(er => {
        if (`${er}`.includes('Failed to fetch') || req.url.includes('mp4')) return;
        console.error(req.url);
        console.error(er);
        new URL(req.url).pathname == '/' && self.registration.unregister();
    });
}
fetch.cache = res => res.url ? caches.open(is.part(res.url) ? 'X/parts' : 'X')
    .then(cache => cache.put(res.url.replace(/[?#].*$/, ''), res.clone()))
    .then(() => res) : Promise.resolve(res);

const Head = {
    url: '/x/include/head.html',
    manifest: {
        name: "非官方資訊站",
        display: "standalone",
        start_url: `https://${location.host}/x/`,
        theme_color: "%23b0ff50",
        icons: [{src: `https://${location.host}/x/img/blade/CX/motif/VL.png`, type: "image/png", sizes: "512x512"}]
    },
    code: () => `
<link rel="icon" href="https://${location.host}/x/img/blade/CX/motif/VL.png" type="image/png">
<link rel="manifest" href='data:application/manifest+json,${JSON.stringify(Head.manifest)}'>`,

    cache: () => caches.open('X').then(cache => Promise.all([
        cache.add(Head.url), cache.add('/x/parts/bg.svg'), cache.add('/x/bg.mp4')
    ])),

    fetch: () => caches.match(Head.url).then(resp => resp.text()),

    add: async resp => new Response(await Head.fetch() + Head.code() + await resp.text(), Head.response(resp)),
            
    response: ({status, statusText, headers}) => ({status, statusText, headers})
}
