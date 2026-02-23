import DB from './include/DB.js'
import {Bey, Preview} from './parts/bey.js'
import {Part} from './parts/part.js'
import {Markup, Keihin} from './include/utilities.js'
import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js@7.1.0/dist/fuse.min.mjs'
Q('search').prepend(...Menu.links().map((a, i) => (a.innerText += ` ${['商品', '部件', '景品'][i]}`) && a));

let CACHE;
class Cache {
    constructor() {
        return Promise.all([
            DB.get.essentials(false), 
            DB.get('meta', 'search'), 
            DB.get('product', 'keihins')
        ]).then(([[meta, parts], links, prizes]) => Promise.all([
            Cache.prepare.links(links, meta), 
            Cache.prepare.prizes(prizes),
            ...parts.flatMap(([, parts]) => parts.map(p => new Part(p).revise()))
        ])).then(([links, prizes, ...parts]) => ({
            links, prizes,
            parts: parts.map(p => p
                    .push({all: [...new Set([...p].flat()), Cache.types[p.attr[0]]]})
                    .keep('abbr', 'path', 'group', 'names', 'all'))
        }))
    }
    static link = ([comp, line, group], title, label) => ({                        
        keywords: ['零件','部件','組件','圖鑑', ...title.split(/[【⬧】]/)],
        href: `/x/parts/?${comp}${line ? `=${line}` : ''}${group ? `#${group}` : ''}`, 
        text: (label || title).match(/[一-龥]+⬧?[一-龥]+/)?.[0] || label || title
    })
    static types = {att: '攻擊', def: '防禦', sta: '持久', bal: '平衡'}
}
Cache.prepare = {
    links: (links, meta) => links.concat(
        ...[...meta.grouped].map(([comp, obj]) => [
            Cache.link([comp], (obj.所有 ?? obj.一體).title),
            [...obj].filter(([, obj]) => obj.group).map(([line, {title, group}]) => line.endsWith('X') ? 
                [...title].map(([sub, title]) => Cache.link([comp, line, sub], title)) : 
                [...group].map(([group, {label}]) => Cache.link([comp, , group], title, label))
            )
        ]).flat(9)
    ),
    prizes: prizes => prizes.map(({bey, ver, code}) => ({
        id: Keihin.id(bey, ver), 
        name: (code ? `${code} ` : '') + Keihin.id(new Bey(bey, {for: 'prize'}).chi.replaceAll(/[^⬧一-龢]/g, ''), ver)
    })).filter(({name}) => name && /[一-龢]/.test(name))
}
class Input {
    constructor() {
        this.value = Input.field.value;
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
            text = text.replace(new RegExp([...Input.regexp.values()].map(r => r.source).join('|'), 'g'), '');
            text && (targets.free ??= new Set()).add(text);
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
        Input.field.onfocus = async () => CACHE = await new Cache();
        Input.field.oninput = () => {
            clearTimeout(Search.timer);
            Input.field.value.trim() && (Search.timer = setTimeout(new Search, 500));
            Preview.reset();
        }
    }
}
Input.events();
class Search {
    constructor(query) {
        (CACHE ? Promise.resolve() : new Cache()).then(cache => {
            CACHE ??= cache;
            query && (Input.field.value = query);
            let results = this.find.parts(new Input().targets);
            this.show('parts', results);
            results = results.filter(r => typeof r == 'string').join('');
            this.show('links', results);
            this.show('products', results);
        });
    }
    find = {parts: targets => 
        [...CACHE.parts.filter(({path, names}) => 
            ['ratchet', 'bit'].some(comp => comp == path[0] && targets[comp]?.has(path.at(-1))) ||
            ['assist', 'over'].some(sub => sub == path[2] && targets[sub]?.has(path.at(-1))) ||
            'blade' == path[0] && names.chi?.split('⬧').some(n => targets.free?.has(n))
        ), ...targets.free || []]
    }
    show = Search.show
    static show = (what, query) => Q(`#search .${what}`).replaceChildren(...Search.results[what](query))
    static results = {
        parts: results => [...new Set(results
            .sort((p1, p2) => (p2 instanceof Part) - (p1 instanceof Part))
            .flatMap(r => r instanceof Part ? r :
                new Fuse(CACHE.parts, {keys: ['abbr', 'all'], threshold: .35})
                .search({$or: [{abbr: r}, {$and: r.split(/(?=\W)/).map(t => ({all: t}))}] })
                .slice(0, results.length > 1 ? 5 : Infinity)
                .map(r => r.item)
            ))].map(item => new Result('part', item))
        ,
        links: query => [
            new Fuse(CACHE.links, {keys: ['keywords', 'text'], threshold: .4}).search(query)
                .slice(0, 5).map(({item}) => new Result('link', item)
            ),
            new Fuse(CACHE.prizes, {keys: ['name'], threshold: .51}).search(query)
                .map(({item}) => new Result('link', {text: item.name, href: `/x/prizes/#${item.id}`})
            )
        ].flat(),
        products: query => /^[a-z]xg?-?\d{2,3}$/i.test(query) ?
            [new Result('code', {code: query.toUpperCase().replace(/(?<![\d-])(?=\d+)/, '-')})] : []
        ,
        history: results => results.map(item => E('button', item, {onclick: () => new Search(item)}))
    }
    static events () {
        Search.show('history', Storage('history') || []);
        Q('#search').onclick = ev => ev.target.matches('ol:not(.history) *') ? Search.add.history() : '';
    }
    static add = {history: () => {
        let history = Storage('history') || [];
        history = [...new Set(history.toSpliced(0, 0, Input.field.value.trim()))].slice(0, 10);
        Search.show('history', history);
        Storage('history', history);
    }}
}
Search.events();
class Result {
    constructor(type, item) {return this[type](item);}
    part = ({path, group, abbr, names}) => 
        E(`li>button.${path[0]}.${path[2] ? path[1] : group}`, 
            Markup('cell', names?.chi || abbr),
            {onclick: ev => new Preview(['tile', 'cell'], {path}, ev)}
        )
    link = ({text, href}) =>
        E('li>a', text, {
            classList: /(?<=parts\/\?).+?(?=[=#])/.exec(href)?.[0] || '',
            href, target: href.startsWith('//') ? '_blank' : ''
        })
    code = ({code}) =>
        E('li>button', code, 
            {onclick: ev => new Preview(['cell', 'image'], {code}, ev)}
        )
}

import {Shohin} from './include/utilities.js'
import PointerInteraction from 'https://aeoq.github.io/pointer-interaction/script.js';
const plugins = {
    announce: news => new O(news).each(([date, beys]) => 
        Q('#products').append(E('time', {title: date}), ...beys.map(bey => new Shohin(bey)))
    ),
    followup: () => DB.get.essentials()
        .then(([meta, parts]) => Part.import(meta.general, parts)) //parts for search use
        .then(() => Shohin.after())
};
Q('header').after(DB(plugins).then(() => {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => 
        entry.target.classList.toggle('seeing', entry.isIntersecting)
    ));
    Q('header,section,time,.scroller', el => observer.observe(el));

    const reset = message => Promise.all([
        DB.discard(ev => message.innerText = ev.type == 'blocked' ? '請先關閉所有本網的分頁' : ev.type),
        caches.delete('X'), caches.delete('X/parts'),
        localStorage.clear(), sessionStorage.clear(),
        navigator.serviceWorker.getRegistrations().then(([reg]) => reg.unregister())
    ]).then(() => {
        onbeforeunload = () => scrollTo(0, 0);
        location.reload();
    }).catch(er => {
        message.innerText = er;
        console.error(er)
    });
    PointerInteraction.events({
        '.scroller,#search ol': {scroll: {x: true}},
        '#reset': {
            drop: {onto: 'i:last-child'},
            drag: PI => PI.drag.to.translate({x: {
                min: 0, max: Q('#reboot div').clientWidth - Q('#reset').clientWidth
            }, y: false}),
            lift: PI => PI.onto && reset(PI.target.nextElementSibling),
        }
    });

    new O({cache: 30, parts: 60}).each(([cache, days]) => 
        cookieStore.get(`no-update-${cache}`).then(cookie => cookie || 
            fetch(`sw/?delete=${cache}`) && cookieStore.set({
                name: `no-update-${cache}`, value: '', 
                expires: Date.now() + days*24*60*60*1000
            })
        )
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
