import DB from './include/DB.js'
import {Preview} from './parts/bey.js'
import {Part} from './parts/part.js'
import {Markup} from './include/utilities.js'
import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js@7.1.0/dist/fuse.min.mjs'
Q('search').prepend(...Menu.links().map((a, i) => (a.innerText += ` ${['產品', '部件', '景品'][i]}`) && a));

let CACHE;
class Cache {
    constructor() {
        return Promise.all([DB.get.essentials(true), DB.get('meta', 'search')])
        .then(([[meta, PARTS], links]) => {
            Part.import(meta.general, PARTS);
            CACHE = {links: Cache.prepare.links(links, meta)};
            return Promise.all(Cache.flatten(PARTS).map(p => p.revise('tile')));
        }).then(parts => ({...CACHE,
            parts: parts.map(p => p.push({all: [...new Set([...p].flat()), Cache.types[p.attr[0]]].join(' ')}))
        }))
    }
    static link = ([comp, line, group], title, label) => ({                        
        keywords: ['零件','部件','組件','圖鑑', ...title.split(/[【⬧】]/)],
        href: `/x/parts/?${comp}${line ? `=${line}` : ''}${group ? `#${group}` : ''}`, 
        text: (label || title).match(/[一-龥]+⬧?[一-龥]+/)?.[0] || label || title
    })
    static flatten = parts => parts instanceof O ? [...parts.values()].map(Cache.flatten).flat() : parts
    static types = {att: '攻擊', def: '防禦', sta: '持久', bal: '平衡'}
}
Cache.prepare = {
    links: (links, {general, ...meta}) => links.concat(
        ...[...new O(meta)].map(([comp, obj]) => [
            Cache.link([comp], (obj.所有 ?? obj.一體).title),
            [...obj].filter(([, obj]) => obj.group).map(([line, {title, group}]) => line.endsWith('X') ? 
                [...title].map(([sub, title]) => Cache.link([comp, line, sub], title)) : 
                [...group].map(([group, {label}]) => Cache.link([comp, , group], title, label))
            )
        ]).flat(9)
    ),
}
class Input {
    constructor() {
        this.value = Search.query = Markup.reverse(Input.field.value.trim());
        this.targets = {};
        this.match();
        this.postprocess();
    }
    match (targets = this.targets) {
        let matching = (item, text, matched = {_: ''}) => {
            let match = Input.regexp[item].exec(text)?.[0];
            match && (matched._ ||= true) && (targets[item] ??= new Set()).add(match);
        }
        this.value.split(/[ ,]/).forEach(text => {
            if (!text) return;
            let matched = {_: false}; //pass by reference
            text = text.toUpperCase();
            (targets.free ??= new Set()).add(text);
            ['ratchet', 'bit', 'subblade'].forEach(item => matching(item, text, matched));
            !matched._ && matching('abbr', text);
            text.replace(new RegExp([...Input.regexp.values()].map(r => r.source).join('|'), 'g'), '')
                .split(/([一-龢]+)/).forEach(t => t && t != '⬧' && targets.free.add(t));
        });
    }
    postprocess (targets = this.targets) {
        targets.ratchet &&= new Set(
            [...targets.ratchet].map(r => r.replace(/(?<!-)(?=\d{2}$)/, '-'))
        );
        targets.free &&= new Set([...targets.free,
            [...targets.free].map(n => /^[一-龥]{4,}$/.test(n) ? 
                [/^(.{2})(.+)$/.exec(n).slice(1, 3), /^(.+)(.{2})$/.exec(n).slice(1, 3)] : n
            )
        ].flat(9));
        (targets.abbr || []).forEach(a => {
            (targets.subblade ??= new Set()).add(a);
            (targets.bit ??= new Set()).add(a);
        });
        (targets.subblade || []).forEach(a => {
            (targets.assist ??= new Set()).add(a.at(-1));
            a.at(-2) && (targets.over ??= new Set()).add(a.at(-2));
        });
    }
    static field = Q('[type=search]')
    static regexp = new O({
        ratchet: /\w-?\d{2}(?!\d)/,
        bit: /(?<=\d{2})[A-z]+$/,
        subblade: /[A-z]{1,2}(?=\w-?\d{2})|(?<=[一-龥])[A-z]{1,2}/,
        abbr: /(?<![A-z])[A-z]{1,2}(?![A-z\-])/
    })
    static events () {
        Input.field.onfocus = async () => CACHE ??= await new Cache();
        Input.field.oninput = () => Input.field.value.trim() && new Search();
    }
}
Input.events();
class Search {
    constructor(query) {
        (CACHE ? Promise.resolve() : new Cache()).then(cache => {
            CACHE ??= cache;
            query && (Input.field.value = decodeURI(query));
            this.targets = new Input().targets;
            let parts = this.find('parts');
            this.targets = [...this.targets.free].join('');
            Q('#search .preview').replaceChildren(...this.find('products'), ...parts);
            Q('#search .links').replaceChildren(...this.find('links'));
        });
    }
    static for = {
        specific: (targets) => CACHE.parts.filter(({path, names}) =>
            ['ratchet', 'bit', 'assist', 'over'].some(comp => 
                comp == (path[2] || path[0]) && Search.match.abbr(path.at(-1), targets[comp])
            ) ||
            ['blade', 'chip', 'main', 'metal'].some(comp => 
                comp == (path[2] || path[0]) && Search.match.name(names, targets.free)
            )
        ),
        general: (targets, amount) => 
            new Fuse(CACHE.parts, {keys: ['abbr', 'all'], threshold: .35})
            .search({$or: [...targets.free].map(text => ({
                $or: [{abbr: text}, {$and: text.split(/(?=\W)/).map(t => ({all: t}))}]
            }) )}) 
            .slice(0, amount)
            .map(r => r.item)
    }
    static match = {
        abbr: (abbr, set) => set?.has(abbr),
        name: (names, set) => names?.chi.split(' ').some(n => set?.has(Markup.remove(n)))
    }
    find = what => Search.find[what](this.targets)
    static find = {
        parts: query => {
            let parts = Search.for.specific(query);
            return [...new Set([...parts, ...Search.for.general(query, parts.length ? 5 : 50)])]
            .map(item => new Result('part', item))
        },
        links: query => new Fuse(CACHE.links, {keys: ['keywords', 'text'], threshold: .4})
            .search(query).slice(0, 5).map(({item}) => new Result('link', item))
        ,
        products: query => /^[a-z]xg?-?\d{2,3}$/i.test(query) ?
            [new Result('code', {code: query.toUpperCase().replace(/(?<![\d-])(?=\d+)/, '-')})] : []
    }
    static history = {
        show: items => Q('#search .history').replaceChildren(...items.map(item => 
            E('button', item, {onclick: () => new Search(item)})
        )),
        add: item => {
            let history = [...new Set([item, ...Storage('history') || []])].slice(0, 10);
            Search.history.show(history);
            Storage('history', history);
            gtag('event', item.toLowerCase());
        }
    }
    static events () {
        Search.history.show(Storage('history') || []);
        Q('#search').onclick = ev => {
            ev.target.matches('ol:not(.history) *') && Search.history.add(Search.query);
            ev.target.matches('ol.preview button') && (ev.target.dataset.path ?
                new Preview(['tile', 'cell'], {path: ev.target.dataset.path.split(',')}, ev) : 
                new Preview(['cell', 'image'], {code: ev.target.innerText}, ev)
            );
            ev.target.matches('ol.links a[href^="//"]') && 
                gtag('event', `LINK-${ev.target.href.substring(2,18)}`);
        }
        document.onclick = ev => {
            if (!ev.target.matches('a[href^="?"]')) return;
            ev.preventDefault();
            window.history.pushState({}, '', ev.target.href);
            new Search(location.search.substring(1));
            Q('#search').scrollIntoView();
        };
    }
}
Search.events();
class Result {
    constructor(type, item) {return this[type](item);}
    code = ({code}) => E('li>button', code)
    part = ({path, group, abbr, names}) => 
        E(`li>button.${path[0]}.${path[2] ? path[1] : group}`, {dataset: {path}},
            [path[2] == 'over' ? '↑' : path[2] == 'assist' ? '↓' : '', ...Markup('cell', names?.chi || abbr)],
        )
    link = ({text, href}) =>
        E('li>a', text, {
            classList: /(?<=parts\/\?).+?(?=[=#])/.exec(href)?.[0] || '',
            href, target: href.startsWith('//') ? '_blank' : ''
        })
}

import {Shohin} from './include/utilities.js'
const plugins = {
    announce: news => new O(news).each(([date, beys]) => 
        Q('#products').append(E('time', {title: date}), ...beys.map(bey => new Shohin(bey)))
    ),
    followup: async () => {
        CACHE ??= await new Cache();
        Shohin.after();
        location.search && new Search(location.search.substring(1));
    }
};
Q('header').after(DB(plugins).then(() => {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => 
        entry.target.classList.toggle('seeing', entry.isIntersecting)
    ));
    Q('header,section,time,.scroller', el => observer.observe(el));
    new O({cache: 30, parts: 60}).each(([cache, days]) =>
        Date.now() > Storage(`no-update-${cache}`) 
        && fetch(`sw/?delete=${cache}`) 
        && Storage(`no-update-${cache}`, Date.now() + days*24*60*60*1000)
    );

    const reset = message => Promise.all([
        DB.discard(ev => message.innerText = ev.type == 'blocked' ? '請先關閉所有本網的分頁' : ev.type),
        caches.delete('X'), caches.delete('X/parts'), caches.delete('X/fonts'),
        localStorage.clear(), sessionStorage.clear(),
        navigator.serviceWorker.getRegistrations().then(([reg]) => reg.unregister())
    ]).then(() => {
        gtag('event', 'RESET');
        onbeforeunload = () => scrollTo(0, 0);
        location.reload();
    }).catch(er => {
        message.innerText = er;
        console.error(er)
    });
    import('https://aeoq.github.io/pointer-interaction/script.js')
    .then(({default: PI}) => PI.events({
        '.scroller,#search ol': {scroll: {x: true}},
        '#reset': {
            drop: {onto: 'i:last-child'},
            drag: PI => PI.drag.to.translate({x: {
                min: 0, max: Q('#reboot div').clientWidth - Q('#reset').clientWidth
            }, y: false}),
            lift: PI => PI.onto && reset(PI.target.nextElementSibling),
        }
    }))
    .catch(() => caches.open('X')
        .then(cache => cache.delete('https://aeoq.github.io/pointer-interaction/script.js'))
    );
}));

Q('#reboot input', input => input.checked = Storage('pref')?.[input.name]);
Q('#reboot form').onchange = ev => Storage('pref', {[ev.target.name]: ev.target.checked});

let swapped, sec = 1;
Q('video', video => E(video).set({
    '--crossfade': sec,
    ontimeupdate: ev => {
        if (swapped || ev.target.duration - ev.target.currentTime > sec) return;
        let next = ev.target.autoplay ? ev.target.nextElementSibling : ev.target.previousElementSibling;
        next.play();
        next.style.opacity = 1;
        ev.target.style.opacity = 0;
        swapped = true;
        setTimeout(() => swapped = false, 1000 * sec);
    }
}));
