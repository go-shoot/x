import DB from './include/DB.js'
import {Bey, Preview} from './parts/bey.js'
import {Part} from './parts/part.js'
import {Markup, Keihin} from './include/utilities.js'
import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js@7.1.0/dist/fuse.min.mjs'
let CACHE;
const Search = query => (CACHE ? Promise.resolve() : 
    Promise.all([DB.get.essentials(false), DB.get('meta', 'search'), DB.get('product', 'beys'), DB.get('product', 'keihins')])
    .then(([[meta, parts], links, beys, prizes]) => {            
        beys = beys.map(([code]) => code);
        let max = new O([...new Set(beys.map(code => code.split('-')[0]))]
            .map(line => [line, beys.find(code => new RegExp(`^${line}-`).test(code))?.match(/\d+/)[0]]));
        Bey.CACHE = CACHE = {max, 
            links: Search.prepare.links(links, meta), 
            prizes: Search.prepare.prizes(prizes)
        };
        return Promise.all(parts.flatMap(([, parts]) => parts.map(p => new Part(p).revise())));
    })
    .then(parts => CACHE.parts = parts.map(p => p.push({all: [...p].flat()})) )
).then(() => {
    query && (Search.field.value = query);
    let results = new Bey(Markup.replace(Search.field.value, 'search').trim(), {for: 'index'});
    Search.show('parts', results);
    results = results.join('');
    Search.show('links', results);
    Search.show('products', results);
});
Object.assign(Search, {
    field: Q('[type=search]'),
    link: ([comp, line, group], title, label) => ({                        
        keywords: ["零件","部件","組件","圖鑑", ...title.split(/[【⬧】]/)],
        href: `parts/?${comp}${line ? `=${line}` : ''}${group ? `#${group}` : ''}`, 
        text: (label || title).match(/[一-龥]+⬧?[一-龥]+/)?.[0] || label || title
    }),
    events () {
        Search.show('history', Storage('history') || []);
        Search.field.oninput = ev => {
            clearTimeout(Search.timer);
            Search.field.value.trim() && (Search.timer = setTimeout(Search, 500));
            Preview.reset();
        }
        Q('#search').onclick = ev => {
            if (!ev.target.matches('ol:not(.history) *')) return;
            let history = Storage('history') || [];
            history = [...new Set(history.toSpliced(0, 0, Search.field.value.trim()))].slice(0, 10);
            Search.show('history', history);
            Storage('history', history);
        }
    },
    prepare: {},
    show: (what, query) => Q(`#search .${what}`).replaceChildren(...Search.show[what](query))
});
Object.assign(Search.prepare, {
    links: (links, meta) => [
        ...links, 
        ...[...meta.grouped].map(([comp, obj]) => [
            Search.link([comp], (obj.所有 ?? obj.一體).title),
            [...obj].filter(([, obj]) => obj.group).map(([line, obj]) => line.endsWith('X') ? 
                [...obj.title].map(([group, title]) => Search.link([comp, line, group], title)) : 
                [...obj.group].map(([group, {label}]) => Search.link([comp, , group], obj.title, label))
            )
        ]).flat(9)
    ],
    prizes: prizes => prizes.map(({bey, ver}) => ({
        id: Keihin.id(bey, ver), 
        name: Keihin.id(new Bey(bey, {for: 'prize'}).chi.replaceAll(/[^⬧一-龢]/g, ''), ver)
    })).filter(({name}) => name && /[一-龢]/.test(name))
})
Object.assign(Search.show, {
    parts: results => results
        .sort((p1, p2) => p1 instanceof Part && !(p2 instanceof Part) ? -1 : p2 instanceof Part && !(p1 instanceof Part) ? 1 : 0)
        .flatMap(s => s instanceof Part ? {item: s} :
            new Fuse(CACHE.parts, {keys: ['abbr', 'all'], threshold: .35})
            .search({$or: [{abbr: s}, {$and: s.split(/(?=\W)/).map(t => ({all: t}))}] })
            .slice(0, results.length > 1 ? 5 : Infinity)
        ).map(({item}) => E(`li>button.${item.comp}.${item.line || item.group}`, 
            Markup('cell', item.names?.chi || item.abbr),
            {onclick: () => new Preview(['tile', 'cell'], item.path)}
        )),
    links: query => [
        ...new Fuse(CACHE.links, {keys: ['keywords', 'text'], threshold: .4})
            .search(query).slice(0, 5)
            .map(({item}) => E('li>a', item.text, {
                classList: /(?<=parts\/\?).+?(?=[=#])/.exec(item.href)?.[0] || '',
                href: item.href, target: item.href.startsWith('//') ? '_blank' : ''
            })),
        ...new Fuse(CACHE.prizes, {keys: ['name'], threshold: .51})
            .search(query)
            .map(({item}) => E('li>a.prize', item.name, {href: `./prize/#${item.id}`}))
        ],
    products (query) {
        if (!/^[a-z]x[a-z]?-?\d{2,3}$/i.test(query)) return [];
        query = query.toUpperCase().replace(/([A-Z]+)(\d+)/, '$1-$2');
        let [line, no] = query.split('-');
        return parseInt(no) <= parseInt(CACHE.max[line]) ? 
            [E('li>button', query, {onclick: () => new Preview(['cell', 'image'], query)})] : [];
    },
    history: results => results.map(item => E('button', item, {onclick: () => Search(item)}))
})
Search.events();

import {Shohin} from './include/utilities.js'
import PointerInteraction from 'https://aeoq.github.io/pointer-interaction/script.js';
const plugins = {
    announce: news => new O(news).each(([date, beys]) => 
        Q('#products').append(E('time', {title: date}), ...beys.map(bey => new Shohin(bey)))
    ),
    followup: () => DB.get('meta', 'parts').then(meta => Part.import(new O(meta.general)) && Shohin.after())
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
            drop: {goal: 'i:last-child'},
            drag: PI => PI.drag.to.translate({x: {
                min: 0, max: Q('#reboot div').clientWidth - Q('#reset').clientWidth
            }, y: false}),
            lift: PI => PI.goal && reset(PI.target.nextElementSibling),
        }
    });
}));

(new Date/1000 - Storage('updated'))/60/60/24 > 30 && fetch('sw/?delete=parts');

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
