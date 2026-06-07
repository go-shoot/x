import DB from './include/DB.js'
import { Bey, Preview } from './parts/bey.js'
import { Part } from './parts/part.js'
import { Markup } from './include/utilities.js'
import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js@7.1.0/dist/fuse.min.mjs'
Q('#search').prepend(...Menu.links().map((a, i) => (a.innerText += ` ${['產品', '部件', '景品'][i]}`) && a));
Q('search ul').append(...LINES.flatMap(([l]) => E('li>img', {src: `img/lines.svg#${l}`})));

let CACHE;
class Cache {
    constructor() {
        return DB.get.essentials({drop: false, flat: true})
        .then(Parts => Promise.all([DB.get('meta', 'search'), ...Parts.map(P => P.revise('tile'))]))
        .then(([links, ...Parts]) => CACHE = {
            links: [
                ...links,
                ...LINES.flatMap(([line, {divided}]) => 
                    Cache.link(['blade', ...divided ? [line] : ['', line]], line)
                ),
                Cache.link(['ratchet'], '核輪⬧固鎖輪盤'), Cache.link(['bit'], '軸心')
            ],
            parts: Parts.map(P => P.push({all: [...new Set([...P].flat(9)), Part.types.chi[[...P.attr][0]]].filter(p => p)}))
        });
    }
    static link = ([comp, line, group], text) => ({text,
        keywords: ['零件','部件','組件','圖鑑', comp, text],
        href: `/x/parts/?${comp}${line ? `=${line}` : ''}${group ? `#${group}` : ''}`
    })
}
class Input {
    constructor() {
        this.value = Search.query = Markup.downgrade(Input.field.value.trim(), 'nobreak');
        this.targets = {};
        this.match();
        this.extend();
    }
    match (targets = this.targets) {
        let matching = (item, text) => {
            let match = Input.regexp[item].exec(text)?.[0];
            match && (targets[item] ??= new Set()).add(match);
        }
        this.value.split(/[ ,]/).forEach(text => {
            if (!text) return;
            text = text.toUpperCase();
            (targets.free ??= new Set()).add(text);
            [...Input.regexp.keys()].forEach(item => matching(item, text));
            text.replace(new RegExp([...Input.regexp.values()].map(r => r.source).join('|'), 'g'), '')
                .split(/([一-龢]+)/).forEach(t => t && t != '⬧' && targets.free.add(t));
        });
    }
    extend (targets = this.targets) {
        targets.ratchet &&= new Set(
            [...targets.ratchet].map(r => r.replace(/(?<!-)(?=\d{2}$)/, '-'))
        );
        targets.free &&= new Set([...targets.free,
            [...targets.free].map(n => /^[一-龥]{4,}$/.test(n) ? 
                [/^(.{2})(.+)$/.exec(n).slice(1, 3), /^(.+)(.{2})$/.exec(n).slice(1, 3)] : n
            )
        ].flat(9));
        let comp = ['over', 'assist', 'bit'];
        targets.complex ?
            targets.complex.forEach(t =>
                /^(.)?(.)(..)$/.exec(t).slice(1).forEach((a, i) => (targets[comp[i]] ??= new Set()).add(a))
            ) :
            targets.subblade?.forEach(b => b.length > 1 ?
                [...b].forEach((a, i) => (targets[comp[i]] ??= new Set()).add(a)) :
                (targets.assist ??= new Set()).add(b)
            );
    }
    static field = Q('[type=search]')
    static regexp = new O({
        ratchet: /\w-?\d{2}(?!\d)/,
        complex: /[A-z]{3,4}$/,
        bit: /[A-z]{1,2}$/,
        subblade: /(?<![A-z])[A-z]{1,2}(?!-)/
    })
    static events () {
        Input.field.onfocus = async () => CACHE ??= await new Cache();
        Input.field.oninput = () => {
            !/^.XG?/i.test(Input.field.value) && (Input.field.inputMode = 'text');
            Input.field.value.trim() && new Search();
        }
    }
}
Input.events();
class Search {
    constructor(query) {
        return Promise.try(() => CACHE || new Cache()).then(cache => {
            CACHE ??= cache;
            query && (Input.field.value = decodeURI(query));
            this.preferred = Q('search ul').classList[0];
            this.targets = new Input().targets;
            Q('#search .preview').replaceChildren(...this.find('products'), ...this.find('parts'));
            this.targets = [...this.targets.free].join('');
            let bey = Bey.build.from(Result.parts);
            Q('#search .links').replaceChildren(bey ? new Result('weight', bey) : '', ...this.find('links'));
        });
    }
    static precisely = targets => CACHE.parts.filter(P => P.only.name() ? 
        Search.match.name(P.names, targets.free) : 
        Search.match.abbr(P.path.at(-1), targets[P.subcomp])
    )
    static generally = ({free}, amount) => 
        new Fuse(CACHE.parts, {keys: ['abbr', 'all'], threshold: .35})
        .search({$or: [...free].map(text => ({
            $or: [{abbr: text}, {$and: text.split(/(?=\W)/).map(t => ({all: t}))}]
        }) )}) 
        .slice(0, amount).map(r => r.item)
    static match = {
        abbr: (abbr, set) => set?.has(abbr.toUpperCase()),
        name: (names, set) => names?.chi?.split(' ').some(n => set?.has(Markup.clear(n)))
    }
    find = what => Search.find[what](this.targets, this.preferred)
    static find = {
        parts (query, preferred) {
            let score = P => !P.only.name() || P.comp == 'blade' && (P.line || (/^.X$/.test(P.group) ? P.group : 'BX')) == preferred;
            let precise = Search.precisely(query);
            let general = Search.generally(query, precise.length ? 5 : 50);
            general.forEach(P => P.precise = false); 
            precise.forEach(P => P.precise = true);
            Result.parts = [...new Set([...precise, ...general])].sort((P1, P2) => score(P2) - score(P1));
            return Result.parts.map(P => new Result('part', P));
        },
        links: query => new Fuse(CACHE.links, {keys: ['keywords', 'text'], threshold: .4})
            .search(query).slice(0, 5).map(({item}) => new Result('link', item))
        ,
        products: ({free}) => [...free].map(t => /^[a-z]xg?-?\d{2,3}$/i.test(t) ?
            new Result('code', {code: t.toUpperCase().replace(/(?<![\d-])(?=\d+)/, '-')}) : ''
        )
    }
    static history = {
        show: items => Q('#search .history').replaceChildren(...items.map(item => E('button', item))),
        add: item => {
            let history = [...new Set([item, ...Storage('history') || []])].slice(0, 10);
            Search.history.show(history);
            Storage('history', history);
            gtag('event', 'SEARCH', {INPUT: item.toLowerCase()});
        }
    }
    static events () {
        Search.history.show(Storage('history') || []);
        Q('#search').onclick = ev => {
            if (ev.target.matches('ul img')) {
                Input.field.value = new URL(ev.target.src).hash.substring(1);
                Input.field.inputMode = 'numeric';
                return Input.field.focus();
            }
            ev.target.matches('ol.history *') && new Search(ev.target.innerText);
            ev.target.matches('ol:not(.history) *') && Search.history.add(Search.query);
            ev.target.matches('ol.preview button') && (ev.target.dataset.path ?
                new Preview(['cell', 'tile'], {path: ev.target.dataset.path.split(',')}, ev) : 
                new Preview(['cell', 'image'], {code: ev.target.innerText}, ev)
            );
            ev.target.matches('ol.links button') && ev.target.parentElement.bey.preview(ev);
        }
        document.onclick = ev => {
            let a = ev.target.closest('a[href^="?"]');
            if (!a) return;
            ev.preventDefault();
            window.history.pushState({}, '', a.href);
            new Search(location.search.substring(1));
            window.scrollTo({top: 0, behavior: 'smooth'});
        };
    }
}
Search.events();
class Result {
    constructor(type, item) {return this[type](item);}
    code = ({code}) => E('li>button', code)
    part = ({path, line, group, abbr, names}) => 
        E(`li>button.icon-${path[0]}.${line || group}`, {dataset: {path}}, Markup.cell(names?.chi || abbr))
    link = ({text, href}) =>
        E('li>a', text, {
            classList: /(?<=parts\/\?).+?(?=[=#])/.exec(href)?.[0] || '',
            href, target: href.startsWith('//') ? '_blank' : ''
        })
    weight = bey => Object.assign(E('li>button', [` 重量估算【${bey.names.chi}】`, E('b', bey.weight)]), {bey})
}

import {Shohin} from './include/utilities.js'
const plugins = {
    announce: news => new O(news).each(([date, beys]) => 
        Q('#products').append(E('time', {title: date}), ...beys.map(bey => new Shohin(bey)))
    )
};
Q('header').after(DB(plugins).then(async () => {
    CACHE ??= await new Cache();
    Shohin.after();
    location.search && new Search(location.search.substring(1));

    const seeing = new IntersectionObserver(entries => entries.forEach(entry => 
        entry.target.classList.toggle('seeing', entry.isIntersecting)
    ));
    Q('header,section,time,.scroller', el => seeing.observe(el));
    const ul = Q('search ul'), scrolling = new IntersectionObserver(entries => 
        (ul.classList = new URL(entries.reduce((prev, entry) => 
            entry.intersectionRatio > prev.intersectionRatio ? entry : prev
        ).target.src).hash.substring(1)) && Input.field.oninput()
    , {root: ul, threshold: [1]});
    ul.Q('img', img => scrolling.observe(img));
    ul.scrollTop = ul.scrollHeight*.28;
}));

(() => {
    new O({cache: 30, parts: 60}).each(([cache, days]) =>
        Date.now() > Storage(`no-update-${cache}`) && 
        fetch(`sw/?delete=${cache}`).then(() => Storage(`no-update-${cache}`, Date.now() + days*24*60*60*1000))
    );

    const reset = () => Promise.all([
        DB.discard(ev => Q('#reboot p').innerText = ev.type == 'blocked' ? '請先關閉所有本網的分頁' : ev.type),
        caches.delete('X'), caches.delete('X/parts'), caches.delete('X/fonts'),
        localStorage.clear(), sessionStorage.clear(),
        navigator.serviceWorker.getRegistrations().then(([reg]) => reg.unregister())
    ]).then(() => {
        gtag('event', 'RESET');
        onbeforeunload = () => scrollTo(0, 0);
        location.reload();
    }).catch(er => {
        Q('#reboot p').innerText = er;
        console.error(er);
    });

    const PI = 'https://aeoq.github.io/pointer-interaction/script.js';
    const distance = (Q('#reboot div').clientWidth - Q('#reboot i').clientWidth)/2;
    import(PI).then(({default: PI}) => PI.events({
        '.scroller,#search ol': {scroll: {x: true}},
        '#reboot i': {
            drop: {onto: 'span'},
            drag: PI => PI.drag.to.translate({x: {min: distance*-1, max: distance}, y: false}),
            lift: PI => PI.onto?.id == 'image' ? fetch('sw/?delete=parts') : PI.onto?.id == 'all' ? reset() : '',
        }
    }))
    .catch(() => caches.open('X').then(cache => cache.delete(PI)));

    Q('#reboot input', input => input.checked = Storage('pref')?.[input.name]);
    Q('#reboot form').onchange = ev => Storage('pref', {[ev.target.name]: ev.target.checked});

    let swapped, sec = 1;
    Q('video', video => E(video).set({
        '--crossfade': sec,
        ontimeupdate: ev => {
            if (swapped || ev.target.duration - ev.target.currentTime > sec) return;
            let next = ev.target[`${ev.target.autoplay ? 'next' : 'previous'}ElementSibling`];
            next.play();
            next.style.opacity = 1;
            ev.target.style.opacity = 0;
            swapped = true;
            setTimeout(() => swapped = false, 1000 * sec);
        }
    }));
})();
location.host.includes('127.0.0.1') && Q('#search').after(...['長矛0-70z','長矛m-85z','長矛op','蒼龍勇氣S6‑60V','蒼龍勇氣Sm‑85V','蒼龍勇氣Sop','蒼龍勇氣wtr','獨角三變po6‑60V','獨角三變poop','龍王閃擊pom-85v'].map(a=>E('a',a,{href:'?'+a})))
