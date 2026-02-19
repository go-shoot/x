
import DB from '../include/DB.js'
import { Bey, Preview } from './bey.js';
import { Markup } from '../include/utilities.js';
import Table from '../products/products.js';

let META, PARTS;
class Part {
    static import = (meta, parts) => ([META, PARTS] = [meta, parts]) && Bey.import(meta, parts);
    constructor(json = {names: {}}) {
        Object.keys(this).forEach(k => Object.defineProperty(this, k, {enumerable: false}));
        this.push(json);
        this.path = [this.constructor.name.toLowerCase(), this.abbr];
        return this.constructor == Part ? new Part[this.comp](json) : this;
    }
    *[Symbol.iterator] () {
        for (const value of Object.values(this)) 
            yield typeof value == 'object' ? 
                Object.values(value).filter(v => typeof v != 'function') : value;
    }
    keep (...fields) {
        for (const key of Object.keys(this))
            !fields.includes(key) && typeof this[key] != 'function' && delete this[key];
        return this;
    }
    push = json => Object.assign(this, json)

    async tile () {
        this.constructor == Blade && this.revise('tile'); //Subclass revise() called. No then() for blade, ratchet
        let {path, stat} = this;
        !stat && this.push(await DB.get(...path));
        this.constructor != Blade && await this.revise('tile');
        return new Tile(this);
    }
    cell = () => new Cell(this)

    revise (where, base, pref) {
        this.constructor.revisions[where]?.forEach?.(what => this[what] = this.revised[what](base, pref));
        return this;
    }
    only = {
        abbr: () => !this.path.at(-1) || this.path[0] == 'ratchet',
        name: () => this.path[0] == 'blade' && this.path.at(-1)?.length > 1
    }
    href = () => `/x/parts/` + Part.href.join(this.path, '?=#.')
    static href = {
        join: (path, joiner) => [...path].map((p, i) => `${joiner[joiner.length/path.length*i]}${p}`).join(''),
    }
}
class Blade extends Part {
    constructor(json) {
        super(json);
        this.abbr?.includes('.') && ([this.group, this.abbr] = this.abbr.split('.'));
        let {line, group, abbr, path} = this;
        this.path = line || !abbr && group ? ['blade', line, group, abbr] : path;
    }
    static revisions = {};
    static CX = {3: ['chip', 'main', 'assist'], 4: ['chip', 'metal', 'over', 'assist']}
}
class Ratchet extends Part {
    constructor(json) {super(json);}
    revise = (where = 'tile') => super.revise(where, where == 'tile' && {stat: [, ...this.abbr.split('-')]});
    revised = {
        group: () => META.ratchet.height.find(([, dmm]) => this.abbr.split('-')[1] >= dmm)[0],
        names: () => {
            let [blade, height] = this.abbr.split('-');
            let {tens, digit} = Ratchet.eng;
            return {eng: `${digit[blade] ?? blade}‒${tens[Math.floor(height / 10)]}${digit[height % 10 || ''] ?? ''}`};
        },
        attr: () => this.attr ??= ['normal'],
        stat: base => this.stat.length === 1 ? this.stat.concat(base.stat.slice(1)) : this.stat
    }
    static revisions = {tile: ['group', 'names', 'attr', 'stat']};
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
        return super.revise(where, PARTS.bit[base], pref);
    }
    revised = {
        group: base => base.group,
        names: (base, pref) => new O(base.names).prepend(...[...pref].reverse().map(p => META.bit.prefix[p])),
        attr: (base, pref) => [...this.attr ?? [], ...base.attr, ...pref],
        stat: base => this.stat.length < 3 ? this.stat.toSpliced(1, 0, ...base.stat.slice(1,3)) : this.stat,
        desc: (base, pref) => [...pref].map(p => META.bit.prefix[p].desc).join('、') + `的【${base.abbr}】Bit${this.desc ? `，${this.desc}` : '。'}`,
    }
    static revisions = {cell: ['names'], tile: ['group', 'names', 'attr', 'stat', 'desc']};
}
class Tile extends HTMLElement {
    constructor(Part) {
        super();
        let {path, group, attr, classes} = Part;
        this.Part = Part;
        this.attachShadow({mode: 'open'}).append(
            E('link', {rel: 'stylesheet', href: '/x/include/common.css'}),
            E('link', {rel: 'stylesheet', href: '/x/parts/part.css'}),
        );
        E(this).set({
            id: path.length > 2 ? path.slice(-2).join('.') : path.at(-1),
            classList: [...path.slice(0, -1), group, classes, ...attr?.filter(a => !/^.X$/.test(a)) ?? []],
            style: {opacity: 0},
            hidden: true,
            onclick: ev => ev.target.href ? '' : Tile.#onclick[location.pathname]?.(path, ev)
        });
    }
    static observedAttributes = ['hidden']
    attributeChangedCallback() {
        !this.hidden && this.fill();
    }
    fill () {
        this.hidden &&= false;
        !this.shadowRoot.Q('object') && this.html();
        return this;
    };
    html () {
        Q('#triangle') || Tile.triangle();
        let {path, desc, from} = this.html.Part = this.Part;
        this.shadowRoot.append(
            Q('#triangle').cloneNode(true),
            E('object', {data: this.html.background()}),
            E('figure>img', {src: `/x/img/${path.join('/')}.png`}),
            E('slot'),
            E('ul', this.html.icons()),
            E('p', Markup.spacing(desc)),
            ...this.html.stat(),
            ...this.html.names(),
            E('svg', {viewBox: '-75 -75 150 150'}, META.types.map(t => E(`use.${t}`, {href: '#triangle'}))),
        );
        from &&= from.split('.');
        from &&= path.toSpliced(-from.length, from.length , ...from);
        this.append(
            from ? E('a', from.at(-1), {href: PARTS.at(from).href()}) : '',
            location.pathname.includes('parts') ? '' : E('a', {href: this.Part.href()})
        );
    }
    static #onclick = {
        '/x/parts/': (path, ev) => new Preview('cell', {path}, ev),
        '/x/products/': path => Table.search(path)
    }
    static hue = {};
    static icons = new O([
        [/^[A-Z]+X$/, l => E('img', {src: `/x/img/lines.svg#${l}`})],
        [['BSB','MFB','BBB'], g => E('img', {src: `/x/img/system-${g}.png`})],
        [['att','bal','def','sta'], t => E('img', {src: `/x/img/types.svg#${t}`})],
        [['normal','simple'], t => E('img', {src: `/x/img/joint.svg#${t}`})]
    ], {left: '\ue01d', right: '\ue01e'});
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
        let {path, group, names, attr} = this.Part;
        let divide = {eng: !['collab', 'hasbro'].includes(group)};
        divide.chi = divide.eng && !attr.includes('BSB');
        return [
            this.Part.only.name() ? 
                Markup('tile', names.chi, divide.chi)?.map(els => E('h5.chi', els)) ?? '' : 
                E('h4', path.at(-1).replace('-', '‒')), 
            names ? ['jap', 'eng'].map(l => E(`h5.${l}`, Markup('tile', names[l], divide.eng)[0])) : ''
        ].flat(9);
    },
    stat () {
        let {comp, stat, date, attr} = this.Part;
        let terms = META[comp][attr?.includes('fusion') ? 'terms.fusion' : 'terms'];
        return [
            date ? E('strong', date) : '',
            E('dl', stat.flatMap((s, i) => E('div', [
                E('dt', s ? Markup('stat', terms[i]) : ''), 
                E('dd', typeof s == 'string' ? Markup('stat', s) : s)
            ])))
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
        Part.revise('cell');
        let {path, attr} = Part;
        let tds = [E('td'), Part.only.name() || Part.only.abbr() ? '' : E('td')];
        E(tds[0]).set({
            ...path[0] == 'blade' && !path[2] ? {colSpan: 6} : path[2] == 'main' ? {colSpan: 3} : {},
            headers: path[2] ?? path[0],
        });
        if (path.at(-1) == null) return tds;
        E(tds[0]).set({
            abbr: path.at(-1), 
            innerText: path.at(-1) || '', 
            ...attr?.includes('fusion') ? {classList: 'fusion'} : {},
        });
        tds.forEach(td => td && (td.Part = Part));
        return tds;
    }

    static fill = (lang, td) => [td ?? Q('td[abbr]')].flat().forEach(async td => {
        let {path} = td?.Part ?? {};
        if (!td || path[0] == 'ratchet') return;
        let next = td.nextElementSibling;
        (next.headers ? td : next).replaceChildren(...await Cell.#html(lang, td.Part, JSON.parse(td.dataset.mode ?? null)));
    })
    static async #html (lang, part, mode) {
        let {names} = part;
        if (!names) return [];
        let limit = Cell.#limit[lang]?.at(part.path.slice(0, -1));
        let name = names[lang] || names.eng;
        if (mode &&= Markup('cell', mode[lang]))
            name = mode.length > 1 && name.includes(' ') ? 
                name.replace(' ', `_${mode[0]} `) + `_${mode[2]}` : name + `_${mode.join('')}`;
        name = Markup('cell', name);
        return names[lang]?.length >= (typeof limit == 'number' ? limit : 99) ? [E('small', name)] : name;
    }
    static #limit = {jap: new O({bit: 7})};
}
Part.blade = Blade, Part.ratchet = Ratchet, Part.bit = Bit;
export {Part, Tile, Cell};