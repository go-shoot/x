
import DB from '../include/DB.js'
import { Bey, Preview } from './bey.js';
import { Markup, Glossary } from '../include/utilities.js';
import Table from '../products/products.js';

let PARTS;
class Part {
    constructor(json = {}) {
        Object.keys(this).forEach(k => Object.defineProperty(this, k, {enumerable: false}));
        this.push(json);
        this.abbr?.includes('.') && ([this.group, this.abbr] = this.abbr.split('.'));
        this.path = [this.constructor.name.toLowerCase(), this.abbr];
        return this.constructor == Part ? new Part[this.comp](json) : this;
    }
    *[Symbol.iterator] () {
        for (const value of Object.values(this)) 
            yield typeof value == 'object' ? 
                Object.values(value).filter(v => typeof v != 'function').map(v => v.split?.(' ') ?? v) : value;
    }
    get all () {return [...new Set([...this].flat(9).filter(p => p)), Part.types.chi[[...this.attr][0]]];}
    get subcomp () {return this.path[2] || this.path[0];}
    get weight () {return (w => parseInt(w) + Part.weight.adjust[w.at(-1)])(this.stat[0] || '0=');}
    only = {
        abbr: () => this.path[0] == 'ratchet',
        name: () => Part.named.includes(this.subcomp)
    }
    push = json => Object.assign(this, json, {attr: new Set([...this.attr ?? [], ...json.attr ?? []])})
    keep (...fields) {
        for (const key of Object.keys(this))
            !fields.includes(key) && typeof this[key] != 'function' && delete this[key];
        return this;
    }
    revise (where, base, pref) {
        this.constructor.revisions[where]?.forEach?.(what => this[what] = this.revised[what](base, pref));
        return this;
    }
    href = () => `/x/parts/` + Part.href.join(this.path, '?=#.')
    static href = {
        join: (path, joiner) => [...path].map((p, i) => `${joiner[joiner.length/path.length*i]}${p}`).join(''),
    }
    cell = () => new Cell(this)
    async tile () {
        let {path, stat} = this;
        !stat && this.push(await DB.get(...path));
        await this.revise('tile'); //Subclass revise() called. No then() for blade, ratchet
        return new Tile(this);
    }
    static types = Object.assign(['att','bal','sta','def'], {
        chi: {att:'攻擊', def:'防禦', sta:'持久', bal:'平衡'},
        eng: {att:'ATTACK', def:'DEFENSE', sta:'STAMINA', bal:'BALANCE'}
    })
    static weight = {adjust: {'+': .3, '=': 0, '-': -.3}};
}
Part.import = ({part, blade, bit, tile}, Parts) => Object.assign(Part, part) && 
    Object.assign(Blade, {...blade, sub: new O(blade.sub)}) && Object.assign(Bit, bit) && Object.assign(Tile, tile) && 
    Bey.import(PARTS = Parts);

class Blade extends Part {
    constructor(json) {
        super(json);
        let {line, group, abbr, path} = this;
        this.path = line || !abbr && group ? ['blade', line, group, abbr] : path;
    }
    revised = {
        attr: () => ['over', 'metal'].includes(this.group) || 
            this.group == 'UX' && this.attr.has('fused') || this.attr.has('UX') && this.attr.has('fused') ?
            this.attr.add('expand') : this.attr
    }
    static revisions = {tile: ['attr']};
}
class Ratchet extends Part {
    constructor(json) {super(json);}
    revise = (where = 'cell') => super.revise(where, where == 'tile' && {stat: [, ...this.abbr.split('-')]});
    revised = {
        group: () => new O(Tile.ratchet.height).find(([, dmm]) => this.abbr.split('-')[1] >= dmm)[0],
        names: () => {
            let [blade, height] = this.abbr.split('-');
            let {tens, digit} = Ratchet.eng;
            return {eng: `${digit[blade] ?? blade}‒${tens[Math.floor(height / 10)]}${digit[height % 10 || ''] ?? ''}`};
        },
        attr: () => this.attr.has('simple') ? this.attr : this.attr.add('normal'),
        stat: base => this.stat.length === 1 ? [...this.stat, ...base.stat.slice(1)] : this.stat
    }
    static revisions = {tile: ['group', 'names', 'attr', 'stat']};
    static eng = {
        digit: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
        tens: ['', '', '', '', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
    }
}
class Bit extends Part {
    constructor(json) {super(json);}
    async revise (where = 'cell') {
        if (!this.abbr || Bit.revisions[where].every(p => this[p] != undefined)) return this;
        let [, pref, base] = new RegExp(`^([${new O(Bit.prefix)}]+)([^a-z].*)$`).exec(this.abbr);
        Bit.revisions[where].some(p => !PARTS.bit[base][p]) && PARTS.bit[base].push(await DB.get('bit', base));
        return super.revise(where, PARTS.bit[base], pref);
    }
    revised = {
        group: base => base.group,
        names: (base, pref) => new O(base.names).prepend(...[...pref].reverse().map(p => Bit.prefix[p])),
        attr: (base, pref) => new Set([...this.attr, ...base.attr, ...pref]),
        stat: base => [this.stat[0], ...base.stat.slice(1, base.stat.length - this.stat.length + 1), ...this.stat.slice(1)],
        desc: (base, pref) => [...pref].map(p => Bit.prefix[p].desc).join('、') + `的〔${base.abbr}〕Bit${this.desc ? `，${this.desc}` : '。'}`,
    }
    static revisions = {cell: ['names'], tile: ['group', 'names', 'attr', 'stat', 'desc']};
}
class Tile extends HTMLElement {
    static observer = new IntersectionObserver(entries => entries.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.fill();
        en.target.classList.remove('loading');
        Glossary(en.target.shadowRoot);
        Tile.observer.unobserve(en.target);
    }));
    constructor(Part) {
        super();
        Tile.observer.observe(this);
        this.attachShadow({mode: 'open'});
        let {path, group, attr} = this.Part = Part;
        E(this).set({
            id: path.length > 2 ? path.slice(-2).join('.') : path.at(-1),
            classList: ['loading', ...path.slice(0, -1), group, ...[...attr].filter(a => !/^.X$/.test(a))], //BX vs collab
            onclick: ev => ev.target.href ? '' : Tile.#onclick[location.pathname]?.(path, ev)
        });
    }
    fill () {
        let {path, desc, from} = this.fill.Part = this.Part;
        from &&= from.split('.');
        from &&= path.toSpliced(-from.length, from.length, ...from);
        from?.length > 3 && (path[2] = from[2]);
        this.shadowRoot.append(
            E('link', {rel: 'stylesheet', href: '/x/include/common.css'}),
            E('link', {rel: 'stylesheet', href: '/x/parts/part.css'}),
            E('object', {data: this.fill.background(E(this).get('--hue'))}),
            E('figure>img', {src: `/x/img/${path.join('/')}.png`}),
            E('slot'),
            E('ul', this.fill.icons()),
            E('p', desc),
            ...this.fill.stat(),
            ...this.fill.names(),
            (typeof Tile.svg == 'object' ? Tile.svg : Tile.svg()).cloneNode(true)
        );
        this.append(
            from && from.length != 3 ? E('a', from.at(-1), {href: PARTS.at(from).href()}) : '',
            location.pathname.includes('parts') ? '' : E('a', {href: this.Part.href()})
        );
    }
    static #onclick = {
        '/x/parts/': (path, ev) => new Preview('cell', {path}, ev),
        '/x/products/': path => Table.search(path)
    }
    static icons = new O([
        [/^(?:[A-Z]+X|expand)$/, l => E('img', {src: `/x/img/lines.svg#${l}`})],
        [['BSB','MFB','BBB'], g => E('img', {src: `/x/img/system-${g}.png`})],
        [['att','bal','def','sta'], t => E('img', {src: `/x/img/types.svg#${t}`})],
        [['normal','simple'], t => E('img', {src: `/x/img/joint.svg#${t}`})]
    ], {left: '\ue01d', right: '\ue01e'});
}
Object.assign(Tile.prototype.fill, {
    background (hue) {
        let {attr} = this.Part;
        let unispin = attr.has('left') ^ attr.has('right');
        let param = {hue, 
            ...unispin ? {[[...attr].find(a => a == 'left' || a == 'right')]: ''} : {}
        };
        return `/x/img/tile.svg#${new URLSearchParams(param)}`;
    },
    icons () {
        let {line, group, attr} = this.Part;
        return [...new Set([line, group, ...attr])].map(a => {
            let content = Tile.icons.find(a, {evaluate: true});
            return content ? E('li', typeof content == 'string' ? {title: a} : {}, content) : '';
        });
    },
    names () {
        let {path, group, names, attr} = this.Part;
        let segment = {eng: !['collab', 'hasbro'].includes(group)};
        segment.chi = segment.eng && !attr.has('BSB');
        return [
            this.Part.only.name() ? 
                Markup('tile', names.chi, segment.chi)?.map(els => E('h5.chi', els)) ?? '' : 
                E('h4', Markup.figure(path.at(-1))), 
            names ? ['jap', 'eng'].map(l => E(`h5.${l}`, Markup('tile', names[l], segment.eng)[0])) : ''
        ].flat(9);
    },
    stat () {
        let {comp, stat, date, attr} = this.Part;
        let terms = Tile[comp][comp == 'bit' && attr.has('fused') ? 'terms.fused' : 'terms'];
        return [
            date ? E('strong', date) : '',
            E('dl', stat.flatMap((s, i) => E('div', [
                E('dt', s ? i > 0 ? Markup('stat', terms[i]) : terms[i] : ''), 
                E('dd', typeof s == 'string' ? Markup('stat', s) : s)
            ])))
        ];
    },
});
Tile.svg = () => {
    let [r1, r2] = [.75, 1], corner = {side: {}};
    corner.side.x = r1 / Math.tan(Math.PI / 8);
    corner.side.y = corner.side.x * Math.SQRT1_2;
    corner.top = r2 / Math.SQRT2;
    return Tile.svg = E('svg', {viewBox: '-75 -75 150 150'}, [
        E('defs>path#triangle', {d: `
            M ${corner.side.x-10},-10 A ${r1},${r1},0,0,0,${corner.side.y-10},${corner.side.y-10}
            L -${corner.top},-${corner.top} A ${r2},${r2},0,0,0,${corner.top},-${corner.top}
            L ${10-corner.side.y},${corner.side.y-10} A ${r1},${r1},0,0,0,${10-corner.side.x},-10 Z`
        }),
        ...Part.types.map(t => E(`use.${t}`, {href: '#triangle'}))
    ]);
};
customElements.define('x-part', Tile);

class Cell {
    constructor(P) {
        P.revise('cell');
        let {abbr, subcomp, path, attr} = P;
        let single = P.only.name() || P.only.abbr();
        let tds = [E('td'), !abbr || single ? '' : E('td')];
        E(tds[0]).set({
            headers: subcomp,
            ...Cell.colSpan[path[0]]?.(path) || (!abbr && !single ? {colSpan: 2} : {}),
        });
        if (abbr == null) return tds;
        E(tds[0]).set({
            title: abbr, innerText: abbr || '', 
            ...attr.has('fused') ? {classList: 'fused'} : {},
        });
        tds.forEach(td => td && (td.Part = P));
        return tds;
    }
    static fill = (lang, td = Q('td[title]')) => [td].flat().forEach(td => {
        if (!td || td.Part.only.abbr()) return;
        let {path, names} = td.Part, {mode} = td.dataset;
        let name = names[lang] || names.eng;
        mode = Markup('cell', JSON.parse(mode ?? '""')[lang]);
        mode.length && (name = mode.length > 1 && name.includes(' ') ? //'a b'->'a_m b_m' 'a'->'a_m'
            name.replace(' ', `_${mode[0]} `) + `_${mode[2]}` : name + `_${mode.join('')}`);
        name = Markup('cell', name);
        let limit = Cell.#limit[lang]?.at(path.slice(0, -1)) ?? 99;        
        let next = td.nextElementSibling;
        (next.headers ? td : next).replaceChildren(...names[lang]?.length >= limit ? [E('small', name)] : name);
    });
    static group = (td, action) => {
        if (!td) return;
        let sibling = td.headers ? td.nextElementSibling : td.previousElementSibling;
        [td, td.headers && sibling.headers ? null : sibling].forEach(action);
    }
    static #limit = {jap: new O({bit: 7})};
    static colSpan = {blade: path => !path[2] ? {colSpan: 6} : path[2] == 'main' ? {colSpan: 3} : ''}
}
Part = new Proxy(
    Object.assign(Part, {Blade, Ratchet, Bit}), 
    {get: (obj, prop) => obj[Bey.comps.includes(prop) ? prop[0].toUpperCase() + prop.slice(1) : prop]}
);
export {Part, Tile, Cell};