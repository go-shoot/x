
import DB from '../include/DB.js'
import { Bey, Preview, Markup } from './bey.js';
import Table from '../products/products.js';

let META, PARTS;
class Part {
    static import = (meta, parts) => ([META, PARTS] = [meta, parts]) && Bey.import(meta, parts);
    #path;
    constructor(json = {names: {}}) {
        this.push({...new O(json)});
        return this.constructor.name == 'Part' ? new Part[this.comp](json) : this;
    }
    *[Symbol.iterator] () {
        for (const v of Object.values(this)) yield typeof v == 'object' ? Object.values(v) : v;
    }
    push (json) {return Object.assign(this, json);}
    get path () {return this.#path ??= [this.constructor.name.toLowerCase(), this.abbr];}

    async tile () {
        let {path, stat} = this;
        !stat && this.push(await (
            path.length >= 3 ? DB.get(`${path[0]}-${path[1]}`, path[3]) : DB.get(path[0], path[1])
        ));
        await this.revise('tile'); //Subclass revise() called. No then() for blade, ratchet
        return new Tile(this);
    }
    cell () {return new Cell(this);}

    revise (revisions, base, pref) {
        revisions?.forEach?.(what => this[what] = this.revised[what](base, pref));
        return this;
    }
    revised = {
        stat: base => this.stat.length === 1 ? [this.stat[0], ...base.stat.slice(1)] : this.stat,
    }
}
class Blade extends Part {
    #path;
    constructor(json) {super(json);}
    get path () {return this.#path ??= this.line ? ['blade', this.line, this.group, this.abbr] : super.path;}
    static sub = ['motif', 'upper', 'lower'];
}
class Ratchet extends Part {
    constructor(json) {super(json);}
    revise (where = 'tile') {return super.revise(Ratchet.revisions[where], {stat: [, ...this.abbr.split('-')]});}
    revised = {
        ...this.revised,
        group: () => META.ratchet.height.find(([, dmm]) => this.abbr.split('-')[1] >= dmm)[0],
        names: () => ({ eng: (([blade, height]) => [
            Ratchet.eng.digit[blade] ?? blade, 
            Ratchet.eng.tens[Math.floor(height / 10)], 
            Ratchet.eng.digit[height % 10 || ''] ?? ''
        ].join(' '))(this.abbr.split('-')) })
    }
    static revisions = {tile: ['group', 'names', 'stat']};
    static eng = {
        digit: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
        tens: ['', '', '', '', 'fourty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
    }
}
class Bit extends Part {
    constructor(json) {super(json);}
    async revise (where = 'tile') {
        if (Bit.revisions[where].every(p => this[p])) return this;
        let [, pref, base] = new RegExp(`^([${META.bit.prefix}]+)([^a-z].*)$`).exec(this.abbr);
        Bit.revisions[where].some(p => !PARTS.bit[base][p]) && PARTS.bit[base].push(await DB.get('bit', base));
        return super.revise(Bit.revisions[where], PARTS.bit[base], pref);
    }
    revised = {
        ...this.revised,
        group: base => base.group,
        names: (base, pref) => new O(base.names).prepend(...[...pref].reverse().map(p => META.bit.prefix[p])),
        attr: (base, pref) => [...this.attr ?? [], ...base.attr, ...pref],
        desc: (base, pref) => [...pref].map(p => META.bit.prefix[p].desc).join('、') + `的【${base.abbr}】Bit${this.desc ? `，${this.desc}` : '。'}`,
    }
    static revisions = {cell: ['names'], tile: ['group', 'names', 'attr', 'stat', 'desc']};
}
class Tile extends HTMLElement {
    constructor(Part) {
        super();
        let {path, group, attr} = Part;
        this.Part = Part;
        this.attachShadow({mode: 'open'}).append(
            E('link', {rel: 'stylesheet', href: '/x/include/common.css'}),
            E('link', {rel: 'stylesheet', href: '/x/include/part.css'}),
        );
        E(this).set({
            id: path.at(-1),
            classList: [...path.slice(0, -1), group, ...attr?.filter(a => !/^.X$/.test(a)) ?? []],
            style: {opacity: 0},
            onclick: Tile.#onclick
        });
    }
    fill = href => {
        !this.shadowRoot.Q('object') && this.html();
        href && this.append(E('a', {href: this.href()}));
        return this;
    };
    html () {
        Q('#triangle') || Tile.triangle();
        let {path, desc, from} = this.html.Part = this.Part;
        this.html.named = Tile.named(path);
        this.shadowRoot.append(
            Q('#triangle').cloneNode(true),
            E('object', {data: this.html.background()}),
            E('figure>img', {src: `/x/img/${path.join('/')}.png`}),
            E('slot'),
            E('ul', this.html.icons()),
            E('p', Markup.spacing(desc)),
            ...this.html.stat(),
            ...this.html.names(),
            E('div', META.types.map(t => E(`svg.${t}`, {viewBox: '-10 -10 20 10'}, E('use', {href: '#triangle'})))),
            from ? E('a', from, {
                href: `#${from}`, 
                onclick: ev => location.pathname.includes('part') && ev.stopPropagation()
            }) : '',
        );
    }
    href () {
        let {path} = this.Part;
        return `/x/parts/?${path[0]}${path[2] ? `=${path[1]}` : ''}#${path.at(-1)}`
    }
    static named = path => path[0] == 'blade' && !path[2] || ['motif', 'upper', 'hasbro'].includes(path[2]);
    static #onclick = ev => location.pathname.includes('parts') ? new Preview('cell', ev.target.Part.path) : 
        location.pathname.includes('products') ? Table.filter(ev.target.Part.path) : '';
    static hue = {};
    static icons = new O([
        [/^[A-Z]+X$/, l => E('img', {src: `/x/img/lines.svg#${l}`})],
        [['BSB','MFB','BBB'], g => E('img', {src: `/x/img/system-${g}.png`})],
        [['att','bal','def','sta'], t => E('img', {src: `/x/img/types.svg#${t}`})]
    ], {left: '\ue01d', right: '\ue01e', simple: '\ue04e'});
}
Object.assign(Tile.prototype.html, {
    background () {
        let {comp, attr} = this.Part;
        let selector = `.${comp}${attr?.includes('fusion') ? '.fusion' : ''}`;
        Tile.hue[selector] ??= [...document.styleSheets]
            .filter(({href}) => href && new URL(href).host == location.host).flatMap(css => [...css.cssRules])
            .find(rule => rule.selectorText == selector).styleMap.get('--hue')[0];

        let spin = attr?.includes('left') ^ attr?.includes('right');
        let param = {
            hue: Tile.hue[selector],
            ...spin ? {[attr?.find(a => a == 'left' || a == 'right')]: ''} : {}
        };
        return `/x/parts/bg.svg?${new URLSearchParams(param)}`;
    },
    icons () {
        let {line, group, attr} = this.Part;
        return [...new Set([line, group, ...attr ?? []])].map(a => {
            let content = Tile.icons.find(a, {evaluate: true});
            return content ? E('li', typeof content == 'string' ? {title: a} : {}, content) : '';
        });
    },
    names () {
        let {path, group, names} = this.Part;
        let span = !['remake', 'collab', 'hasbro'].includes(group);
        return [
            this.named ? 
                Markup('tile', names.chi, span)?.map(els => E('h5.chi', els)) ?? '' : 
                E('h4', path.at(-1).replace('-', '‒')), 
            names ? ['jap', 'eng'].map(l => E(`h5.${l}`, Markup('tile', names[l], span)[0])) : ''
        ].flat(9);
    },
    stat () {
        let {comp, stat, date, attr} = this.Part;
        let terms = META[comp][attr?.includes('fusion') ? 'terms.fusion' : 'terms'];
        return [
            date ? E('strong', date) : '',
            E('dl', stat.flatMap((s, i) => [
                E('dt', Markup('stat', terms[i])), 
                E('dd', typeof s == 'string' ? Markup('stat', s) : s)
            ]))
        ];
    },
});
Tile.triangle = () => {
    let [r1, r2] = [.75, 1], corner = {side: {}};
    corner.side.x = r1 / Math.tan(Math.PI / 8);
    corner.side.y = corner.side.x * Math.SQRT1_2;
    corner.top = r2 / Math.SQRT2;
    document.body.append(E('svg>defs>path', {id: 'triangle', d: 
        `M ${corner.side.x-10},-10 A ${r1},${r1},0,0,0,${corner.side.y-10},${corner.side.y-10}
        L -${corner.top},-${corner.top} A ${r2},${r2},0,0,0,${corner.top},-${corner.top}
        L ${10-corner.side.y},${corner.side.y-10} A ${r1},${r1},0,0,0,${10-corner.side.x},-10 Z`
    }));
};
customElements.define('x-part', Tile);

class Cell {
    constructor(Part) {
        let {path, attr} = Part;
        let tds = [E('td'), !Cell.#named(path) ? E('td') : ''];
        E(tds[0]).set({
            ...path[0] == 'blade' && !path[2] ? {colSpan: 4} : {},
            headers: path[2] ?? path[0],
        });
        if (path.at(-1) == null) return tds;
        E(tds[0]).set({
            abbr: path.at(-1), 
            innerText: path.at(-1) || '', 
            ...attr?.includes('fusion') ? {classList: 'fusion'} : {},
            onclick: Cell.#onclick
        });
        tds[0].Part = Part;
        tds[1] && E(Object.assign(tds[1], {Part})).set({onclick: tds[0].onclick});
        return tds;
    }
    static #named = path => path[0] == 'ratchet' || Tile.named(path);
    static #onclick = ev => '';

    static fill = (lang, td) => [td ?? Q('td[abbr]:not([headers=ratchet])')].flat().forEach(td => {
        if (!td) return;
        let next = td.nextElementSibling;
        Cell.#html(lang, td.Part, JSON.parse(td.dataset.mode ?? '""'))
            .then(name => (!next.headers ? next : td).replaceChildren(...name));
    })
    static async #html (lang, part, mode) {
        let names = part.names ?? (part.path[0] == 'bit' && await part.revise('cell')).names;
        if (!names) return [];
        let limit = Cell.#limit[lang]?.at(part.path.slice(0, -1));
        let content = [...Markup('cell', names[lang] || names.eng), mode ? E('sub', mode[lang] || mode.eng) : ''];
        return names[lang]?.length >= (typeof limit == 'number' ? limit : 99) ? [E('small', content)] : content;
    }
    static #limit = {jap: new O({blade: {CX: {lower: 5}}, bit: 7})};
}
Part.blade = Blade, Part.ratchet = Ratchet, Part.bit = Bit;
export {Part, Tile, Cell};