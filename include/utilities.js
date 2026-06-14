import DB from "./DB.js";
import { Bey, Preview } from "../parts/bey.js";
import { Part } from "../parts/part.js";
class Shohin {
    constructor({code: header, name, bey, ver, imgs, desc, type}) {
        bey && (this.abbr = bey);
        Shohin.beys.push(this);
        let content = Shohin.zip([desc ?? []].flat(), imgs ?? [])
            .map(srcORtext => srcORtext.startsWith('http') ? 
                Shohin.figure(srcORtext) : E('p', {innerHTML: Markup.upgrade(srcORtext, 'nobreak')})
            );
        return this.div = E('div', [
            E('h5', [type ? Shohin.ruby(type) : '', header]),
            E('h4', [0,1].flatMap(i => [
                E('strong', Markup.upgrade(name?.[i], 'nobreak')), 
                E('small', ver?.[i] ?? '')
            ])),
            ...content
        ], {classList: [`scroller`, Shohin.classes.find(header, {default: 'Lm'})]});
    }
    static zip = (texts, images) => texts.reduce((arr, n, i) => arr.toSpliced(2 * i + 1, 0, n), images)
    static figure = imgORsrc => E('figure', [
        E('a', '🖼️', {href: typeof imgORsrc == 'string' ? imgORsrc : imgORsrc.src}), 
        typeof imgORsrc == 'string' ? E('img', {src: imgORsrc, loading: 'lazy'}) : imgORsrc
    ])
    static ruby = type => E(`ruby.below.${type}`, [
        E('img', {src: `img/types.svg#${type}`}), 
        E('rt', Part.types.eng[type])
    ])
    static classes = new O([
        [/(stadium|entry) set/i, 'SS'],
        [/組合|Set/i, 'St'],
        [/Starter/i, 'S'],
        [/Random/i, 'RB'],
        [/Booster/i, 'B'],
        [/.XG?-/, 'others'],
    ])
    attrs () {
        let {bit, names: {chi, jap}} = new Bey(this.abbr);
        let h4 = this.div.Q('h4');
        h4.Q('strong:nth-of-type(1)').innerText = jap;
        h4.Q('strong:nth-of-type(2)').replaceChildren(E('a', {href: `?${chi}`}, chi));
        this.div.Q('h5').prepend(Shohin.ruby([...bit.attr][0]));
    }
    images () {
        let [code, type] = this.div.Q('h5').innerText.match(/(?<=\n?).+$/)[0].split(/(?<=\d) /);
        let figures = [
            ...this.div.Q('figure', []),
            ...new Preview('news', {code: code.replace('-', ''), type}).map(Shohin.figure)
        ];
        this.div.replaceChildren(
            this.div.Q('h5'), this.div.Q('h4'), 
            ...Shohin.zip(this.div.Q('p', []), figures)
        );
    }
    static beys = [];
    static after = () => Shohin.beys.forEach(bey => {
        bey.abbr && bey.attrs();
        bey.div.Q('strong:not(:empty)') && /XG?-\d+/.test(bey.div.Q('h5').innerText) && bey.images();
    });
}
class Keihin {
    constructor({type, note, link, date, code, bey, ver, img: [src, style]}) {
        if (!note) return '';
        let {line, names: {jap, chi}} = new Bey(bey);   
        return E(`article.keihin-${type}.${line}`, [
            E('em', Keihin.type[type]), 
            E('a', link || parseInt(style?.width) > 300 ? {href: link ?? src} : {}, note), //DMM
            E('div', [
                E('figure>img', {src, loading: 'lazy', style: typeof style == 'object' ? style : {width: style + '%'}}), 
                E('h4', {lang: 'ja'}, [
                    E('code', code.includes('?') ? '' : Markup.upgrade(code, 'figureDash').replace(/_.+$/, '')), 
                    E('a', /^\w+$/.test(jap) ? {} : {href: `//google.com/search?q="${jap}" ${ver?.[0] ?? ''}`, target: '_blank'}, jap), 
                    E('small', ver?.[0] ? {
                        classList: ver[0].length > 12 && !ver[0].includes('<br>') ? 'tight' : '',
                        innerHTML: ver[0]
                    } : '')
                ]),
            ]),
            E('h4', {lang: 'zh'}, [chi || '　', E('small', ver?.[1] ?? '')]),
            E('time', Markup.upgrade(date, 'figureDash'))
        ], {title: bey});
    }
    static type = new O({t: '比賽', d: '抽獎', m: '限定商品', g: '贈品'})
}

const FilterForm = {
    items: {
        positive: form => [...new FormData(form)],
        negative: form => form.Q('input:not(:checked)', []).map(input => [input.name, input.value])
    },
    filter (query, action, ev) {
        [...this.targets].forEach(el => 
            el.hidden = query.some(classes => el.matches(classes) ^ (this.type == 'positive'))
        );
        this.form.count && this.count();
        action?.[ev?.target.name]?.(ev);
    },
    count () {this.form.count.value = [...this.targets].filter(el => !el.matches('[hidden],.hidden')).length;},
    event (targets, {type, legend, single, action} = {}, form = document.forms[0]) {
        this.targets = targets;
        this.form = Object.assign(form, {
            onchange: ev => {
                ev && (single === true || single?.[ev.target.name]) && 
                    form[ev.target.name]?.forEach(i => i.checked = i == ev.target);
                this.type = type ??= 'positive';
                let query = this.items[type](form).reduce((obj, [n, v]) => ({...obj, 
                    [n]: [...obj[n] || [], v == '¬' ? `:not(${Q(`[name=${n}]`).slice(1).map(i => i.value)})` : v]
                }), {});
                query = [...new O(query).map(([n, v]) => [n, v.join()]).values()];
                ev ? Transition.allow.for(() => this.filter(query, action, ev)) : this.filter(query, action, ev);
            },
            onreset: () => {
                [...form.elements].forEach(input => input.checked = true);
                [...targets].forEach(tr => tr.hidden = false);
                form.count && this.count();
            },
            onclick: ev => {
                if (ev.target.tagName != 'LEGEND' || legend?.[ev.target.parentElement.id]?.click === false) return;
                [...ev.target.parentElement.elements].forEach(input => input.checked = true);
                form.onchange(ev);
            }
        })
    },
    fieldset: class {
        constructor(inputs, ...attr) {
            let {legend, negate, name, ...rest} = attr.reduce((obj, a) => ({...obj, ...a}), {});
            return E(`fieldset.${legend == '排序' ? 'sorter' : 'filter'}#${name ?? ''}`, [
                legend ? this.legend(legend) : '', 
                ...legend == '排序' ? this.radios(inputs) : this.checkboxes(inputs, name, negate)
            ], rest)
        }
        legend = el => E('legend', location.pathname.includes('parts') ? {title: el} : el)
        radios = inputs => E.radios(inputs.flatMap(([id, label]) => ({label, name: 'sort', id})))
        checkboxes = (inputs, name, negate) => [
            negate ? E('input', {type: 'hidden', name, value: '¬'}) : '',
            ...E.checkboxes(inputs.flatMap(([value, label]) => ({
                label: label.label ?? label, 
                name,
                value: value.replace(/^(?=\w)|(?<=[(,])|\s/g, '.'), 
                checked: label.label?.checked != null || name == 'group' ? label.checked : true, 
            })))
        ]
    },
}

const Transition = {
    root: Q('html'),
    page: {
        pause: (popover = false) => Q('html').classList.add('pause-page', popover ? 'prepare-popover' : null),
        resume: () => Q('html').classList.remove('pause-page', 'prepare-popover')
    },
    allow: {for: action => {
        Transition.page.pause();
        document.startViewTransition(action).finished.then(Transition.page.resume);
    }},
    popover: (action, ev, popover) => {
        let [x, y] = [ev.clientX, ev.clientY];
        if (x == null) {
            let {left, width, top, height} = ev.target.getBoundingClientRect();
            [x, y] = [left + width/2, top + height/2];
        };
        let r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        Transition.page.pause(true);
        let tr = document.startViewTransition();
        tr.ready.then(() => {
            action == 'show' ? popover.showPopover() : popover.hidePopover();
            let frames = [`circle(0 at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`];
            action == 'hide' && frames.reverse();
            Transition.root.animate({clipPath: frames}, {
                duration: 300,
                easing: 'ease-in-out',
                pseudoElement: `::view-transition-${action == 'show' ? 'new' : 'old'}(root)`,
            });
        });
        tr.finished.then(Transition.page.resume);
    }
}

const Glossary = async (where = document) => {
    let p = [where.Q('p'), where.Q('x-part', []).map(tile => tile.sQ('p'))].flat(9).filter(el => el);
    if (!p.length) return;
    if (!Q('#glossary')) {
        addEventListener('click', ev => {
            let clicked = ev.composedPath()[0];
            clicked.tagName == 'U' && Glossary.lookup(ev, clicked.innerText);
        }, {capture: true});
        Q('body').append(E('aside#glossary', {popover: 'hint'}));
    }
    Glossary.defs ??= await DB.get('meta', 'glossary').catch(() => '');
    setTimeout(() => Glossary.search(p));
}
Object.assign(Glossary, {
    search: texts => texts.forEach(p => {
        const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, 
            node => NodeFilter[node.parentElement.tagName == 'U' ? 'FILTER_REJECT' : 'FILTER_ACCEPT']);
        let node;
        while (node = walker.nextNode()) {
            const texts = node.nodeValue.split(/(\w[\w ]*\w)/);
            if (texts.length <= 1) continue;
            const fragment = new DocumentFragment;
            fragment.append(...texts.map(text => text in Glossary.defs ? E('u', text) : new Text(text)));
            node.replaceWith(fragment);
        }
    }),    
    lookup: (ev, term) => {
        ev.stopPropagation();
        clearTimeout(Glossary.timer);
        let aside = Q('#glossary');
        aside.innerHTML = '';
        let [jap, def] = Glossary.defs[term];  //ev.target changes after await
        E(aside).set({
            '--left': `${ev.clientX}px`, '--top': `${ev.clientY}px`
        }, [
            E('dfn', [
                E('ruby', term, E('rt', jap.split('&')[0])),
                ' ', jap.split('&')[1] ?? ''
            ]), def
        ]);
        aside.showPopover();
        Glossary.timer = setTimeout(() => {
            aside.innerHTML = '';
            aside.hidePopover();
        }, 3000);
    },
});

const Markup = (text, items, values = false) => {
    if (values === true) return text?.split(/(?<=.+?) (?=[一-龢].+)/).map(t => Markup(t, items, false)) ?? [];
    let results = [items].flat().reduce((children, item) => children.flatMap(text => {
        if (!text || text instanceof Node) return text;
        let replacer = typeof item == 'string' ? Markup.replacer[item] : item;
        let [before, after] = Array.isArray(replacer) ? replacer : replacer.find(([r]) => r.test(text)) ?? [];
        return typeof after == 'string' ? text.replace(before, after) : after?.(before.exec(text), values) ?? text;
    }), [text ?? '']);
    return results.length === 1 ? results[0] : results;
}
Object.assign(Markup, {
    clear: text => Markup(text, ['clear']),
    tile: (text, divide = true) => Markup(text, divide ? ['mode', 'tile'] : ['mode'], true),
    cell (text) {
        let children = Markup(text ?? '', ['cell', 'mode', 'clear'], true);
        children.length == 2 && children.splice(1, 0, '⬧');
        return children.flat();
    },
    hktw: (lang, name) => ['hk','tw'].includes(lang) && name?.split(' ')[['hk','tw'].indexOf(lang)] || name,
    image: (url, values) => Markup(url, Markup.replacer.image, values),
    upgrade: (text, item) => Markup(text, Markup.upgrades[item]),
    downgrade: (text, item) => Markup(text, Markup.upgrades[item].map(item => item.reverse())),
});
Markup.upgrades = {
    figureDash: [['-', '‒']],
    nobreak: [['-', '‑']]
};
Markup.replacer = {
    clear: [/[_\/\\]/g, ''],
    cell: [/(?<=[a-z]{2,})(?=\\?[A-Z])/, ' '],
    mode: new O([
        [/(.+)_([一-龢]{4,})/, ([, $1, $2]) => [$1, E('sub.long', $2)]],
        [/(.+)_(.+)/, ([, $1, $2]) => [$1, E('sub', $2)]]
    ]),
    tile: new O([
        [/(.+)\\(.+)/, ([, $1, $2]) => [$1, E('span', $2)]],
        [/(.+)\/(.+)/, ([, $1, $2]) => [E('span', $1), $2]],
        [/(.+?) ?([A-Z].+)/, ([, $1, $2]) => [E('span', $1), $2]],
        [/^([一-龢]{2})([一-龢]{2,})/, ([, $1, $2]) => [E('span', $1), $2]],
    ]),
    stat: new O([
        [/^(.*?)([一-龢]{2})$/, ([, $1, $2]) => [$1, String.fromCharCode(10), $2]],
        [/(.+)([+=-])/, ([, $1, $2]) => [$1, E('sup', {'+':'+','=':'≈','-':'−'}[$2])]],
        [/(.+?)(<>|>)(.+)/, ([, $1, $2, $3]) => [$1, E('small', {'<>': '↔', '>': '→'}[$2]), $3]],
    ]),
    image: [
        [/(.*)\$\{(.+)\}(.*)/, ([, $1, $2, $3], values) => [$1, values[$2], $3].join('')],
        [/(.*)\((.+)\)(.*)/, ([, $1, $2, $3]) => $2.split('|').map(s => [$1, s, $3].join(''))],
    ],
};
export {FilterForm, Transition, Shohin, Keihin, Glossary, Markup}
