import DB from "./DB.js";
import { Bey, Preview } from "../parts/bey.js";

class Shohin {
    constructor({code: header, name, imgs, desc, type}) {
        imgs ??= [];
        let content = [desc ?? []].flat().reduce((arr, n, i) => arr.toSpliced(2 * i + 1, 0, n), imgs)
            .map(srcORtext => /^(https?:)?\/\//.test(srcORtext) ? 
                E('figure', [E('a', '🖼️', {href: srcORtext}), E('img', {src: srcORtext})]) : 
                E('p', {innerHTML: Markup.spacing(srcORtext)})
            );
        return E('div', [
            E('h5', [type ? E(`ruby.below.${type}`, [
                E('img', {src: `img/types.svg#${type}`}), 
                E('rt', Shohin.type[type])
            ]) : '', header]),
            name ? E('h4', {innerHTML: name?.replaceAll('-', '‑')}) : '',
            ...content
        ], {classList: [`scroller`, Shohin.classes.find(header, {default: 'Lm'})]});
    }
    static type = {att: 'ATTACK', bal: 'BALANCE', sta: 'STAMINA', def: 'DEFENSE'};
    static classes = new O([
        [/(stadium|entry) set/i, 'SS'],
        [/組合|Set/i, 'St'],
        [/Starter/i, 'S'],
        [/Random/i, 'RB'],
        [/Booster/i, 'B'],
        [/.XG?-/, 'others'],
    ]);
    static after = () => Q('.scroller:has(h4)', []).forEach(div => {
        let header = div.Q('h5').innerText;
        if (!/XG?-\d+/.test(header)) return;
        let [code, type] = header.match(/(?<=\n?).+$/)[0].split(/(?<=\d) /);
        let figures = div.Q('figure', []);
        figures.push(...new Preview('index', {code: code.replace('-', ''), type}).map(img => 
            E('figure', [E('a', '🖼️', {href: img.src}), img])
        ));
        div.replaceChildren(
            div.Q('h5'), div.Q('h4'), 
            ...div.Q('p', []).reduce((arr, n, i) => arr.toSpliced(2 * i + 1, 0, n), figures)
        );
    });   
}
class Keihin {
    constructor({type, note, link, date, code, bey, ver, img: [src, style]}) {
        let {line, jap, chi} = new Bey(bey, {for: 'prize'});   
        return E(`article.keihin-${type}.${line}`, [
            E('em', Keihin.type[type]), 
            E('a', link || parseInt(style?.width) > 300 ? {href: link ?? src} : {}, Markup.spacing(note)),
            E('div', [
                E('figure>img', {src, style}), 
                E('h4', {lang: 'ja'}, [
                    E('code', code?.replace('-', '‒') || ''), 
                    E('span', jap), 
                    E('small', Markup.spacing(ver?.[0]) ? {
                        classList: ver[0].length > 12 && !ver[0].includes('<br>') ? 'tight' : '',
                        innerHTML: ver[0]
                    } : '')
                ]),
            ]),
            E('h4', {lang: 'zh'}, [chi, E('small', [ver?.[1] ?? ''].filter(t => t).join(' '))]),
            E('time', date.replace('-','‒'))
        ], {id: Keihin.id(bey, ver)});
    }
    static id = (bey, ver) => `${bey.split(' ')[0]}${ver ? `–${ver[1].match(/\w+(?!.*:)|\w+$/)?.[0]}` : ''}`
    static type = new O({t: '比賽', d: '抽獎', m: '限定商品', g: '贈品'})
}

const FilterForm = {
    event (targets, {legend, single, action} = {}, form = document.forms[0]) {
        this.targets = targets;
        this.form = Object.assign(form, {
            onchange: ev => {
                if (ev) {
                    (single === true || single?.[ev.target.name]) && 
                        form[ev.target.name]?.forEach(i => i.checked = i == ev.target);
                    Transition.page.pause();
                }
                let query = [...new FormData(form)].reduce((obj, [n, v]) => ({...obj, 
                    [n]: [...obj[n] || [], v == '¬' ? `:not(${Q(`[name=${n}]`).slice(1).map(i => i.value)})` : v]
                }), {});
                query = [...new O(query).map(([n, v]) => [n, v.join()]).values()];
                
                let filter = () => {
                    [...targets].forEach(el => el.hidden = query.some(classes => !el.matches(classes)));
                    form.count && this.count();
                    action?.[ev?.target.name]?.(ev);
                }
                ev ? document.startViewTransition(filter).finished.then(Transition.page.resume) : filter();
            },
            onreset: () => {
                [...form.elements].forEach(input => input.checked = true);
                [...targets].forEach(el => el.hidden = false);
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
                checked: name == 'group' ? label.checked : true, 
            })))
        ]
    },
    count () {this.form.count.value = [...this.targets].filter(el => !el.matches('[hidden],.hidden,.Lm')).length},
}

const Transition = {
    root: Q('html'),
    page: {
        pause: (popover = false) => Q('html').classList.add('pause-page', popover ? 'prepare-popover' : null),
        resume: () => Q('html').classList.remove('pause-page', 'prepare-popover')
    },
    popover: (action, {clientX: x, clientY: y}, popover) => {
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
    if (!Q('#glossary')) {
        addEventListener('click', ev => {
            let clicked = ev.composedPath()[0];
            clicked.tagName == 'U' && Glossary.lookup(ev, clicked.innerText);
        }, {capture: true});
        Q('body').append(E('aside#glossary', {popover: 'hint'}));
    }
    let p = [where.Q('p'), where.Q('x-part', []).map(part => part.shadowRoot.Q('p'))].flat(9).filter(el => el);
    if (!p.length) return;
    Glossary.search(p, await DB.get('meta', 'glossary'));    
}
Object.assign(Glossary, {
    search: (texts, glossary) => texts.forEach(p => {
        const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, 
            node => NodeFilter[node.parentElement.tagName == 'U' ? 'FILTER_REJECT' : 'FILTER_ACCEPT']);
        let node;
        while (node = walker.nextNode()) {
            const texts = node.nodeValue.split(/(\w[\w ]*\w)/);
            if (texts.length <= 1) continue;
            const fragment = new DocumentFragment;
            fragment.append(...texts.map(text => text in glossary ? E('u', text) : new Text(text)));
            node.replaceWith(fragment);
        }
    }),    
    lookup: async (ev, term) => {
        ev.stopPropagation();
        clearTimeout(Glossary.timer);
        let aside = Q('#glossary');
        aside.innerHTML = '';
        let [jap, def] = (await DB.get('meta', 'glossary'))[term];  //ev.target changes after await
        E(aside).set({
            '--left': `${ev.clientX}px`, '--top': `${ev.clientY}px`
        }, [
            E('dfn', [
                E('ruby', term, E('rt', jap.split('&')[0])),
                ' ', jap.split('&')[1] ?? ''
            ]), Markup.spacing(def)
        ]);
        aside.showPopover();
        Glossary.timer = setTimeout(() => {
            aside.innerHTML = '';
            aside.hidePopover();
        }, 3000);
    },
});

const Markup = (where, string, divide = true) => {
    if (!string) return [];
    string = string.split(Markup.split);
    if (where == 'cell')
        return (string.length == 2 ? [string[0], '⬧', string[1]] : string)
            .map(s => Markup.replace(s, 'cell')).flatMap(s => Markup.replace(s, 'mode'));
    if (where == 'tile')
        return string.map(s => Markup.replace(s, 'mode')).map(s => divide ? Markup.replace(s, 'tile') : s);
    if (where == 'stat')
        return Markup.replace(string, 'stat');
    return string;
}
Object.assign(Markup, {
    split: /(?<=.+?) (?=[一-龢].+)/,
    cell: [[/[/\\]/g, ''], [/(?<=[a-z]{2,})(?=[A-Z])/, ' '], [' ', ' ']],
    tile: new O([ //mode first so that _mode won't be sticking to span
        [/(.+)\\(.+)/, ([, $1, $2]) => [$1, E('span', $2)]],
        [/(.+)\/(.+)/, ([, $1, $2]) => [E('span', $1), $2]],
        [/(.+?) ?([A-Z].+)/, ([, $1, $2]) => [E('span', $1), $2]],
        [/^([一-龢]{2})([一-龢]{2,})/, ([, $1, $2]) => [E('span', $1), $2]],
    ]),
    mode: new O([
        [/(.+)_([一-龢]{4,})/, ([, $1, $2]) => [$1, E('sub.long', $2)]],
        [/(.+)_(.+)/, ([, $1, $2]) => [$1, E('sub', $2)]]
    ]),
    stat: new O([
        [/^(.+?)([一-龢]{2})$/, ([, $1, $2]) => [$1, String.fromCharCode(10), $2]],
        [/(.+)([+=-])/, ([, $1, $2]) => [$1, E('sup', {'+':'+','=':'≈','-':'−'}[$2])]],
        [/(.+?)(<>|>)(.+)/, ([, $1, $2, $3]) => [$1, E('small', {'<>': '↔', '>': '→'}[$2]), $3]],
    ]),
    image: [
        [/(.*)\$\{(.+)\}(.*)/, ([, $1, $2, $3], values) => [$1, values[$2], $3].join('')],
        [/(.*)\((.+)\)(.*)/, ([, $1, $2, $3]) => $2.split('|').map(s => [$1, s, $3].join(''))],
    ],
    search: [
        [/攻擊?/, 'att '], [/防禦?/, 'def' ], [/平衡?/, 'bal '], [/持久?/, 'sta '],
        ['左', 'left '], ['右', 'right '],
        [/軸心?/, 'bit '], ['固鎖', 'ratchet '], [/上蓋|面|戰刃/, 'blade '],
    ],
    replace (string, which, values) {
        if (string instanceof Array) 
            return string.flatMap(s => Markup.replace(s, which));
        if (string instanceof HTMLElement) 
            return string;
        if (Markup[which] instanceof Array)
            return Markup[which].reduce((str, [r, f]) => 
                typeof f == 'string' ? str.replace(r, f) : 
                r.test(str) ? f(r.exec(str), values) : str
            , string);
        let [r, f] = Markup[which].find(([r]) => r.test(string)) ?? [];
        return f?.(r.exec(string), values) ?? string;
    },
    remove: name => name?.replaceAll(/[_\/\\]/g, '') ?? '',
    spacing: text => text?.replace(/(?<=\w)(?=[一-龢ぁ-ヴ])/g, ' ').replace(/(?<=[一-龢ぁ-ヴ])(?=\w)/g, ' ') ?? ''
});

export {FilterForm, Transition, Shohin, Keihin, Glossary, Markup}
