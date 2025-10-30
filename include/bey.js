import DB from './DB.js';
import { Part, Cell } from './part.js';
import { Glossary, Markup } from './utilities.js';
import Maps from '../products/maps.js';

let META, PARTS;

class Bey {
    static import = (meta, parts) => [META, PARTS] = [meta, parts];
    constructor(content) {
        return typeof content == 'string' ? 
            location.href.includes('prize') ? this.for.prize(content) : this.for.index(content) : 
            this.for.product(content);
    }
    abbr = {to: {parts: abbr => {
        abbr = new O(abbr.split(' ').map((a, i) => [i == 0 ? 'blade' : i == 1 ? 'ratchet' : 'bit', a]));
        ['ratchet', 'bit'].forEach(comp => this[comp] = PARTS[comp][abbr[comp]] ?? new Part[comp]);

        this.line = META.blade.delimiter.find(([, char]) => 
            (abbr.blade = [abbr.blade].flat()[0].split(char)).length > 1
        )?.[0];
        this.blade = abbr.blade.length > 1 ? 
            abbr.blade.map((b, i) => PARTS.blade[this.line][Part.blade.sub[i]][b]) ?? new Part.blade : 
            PARTS.blade[abbr.blade[0]] ?? new Part.blade;
        this.line ??= this.blade.group ?? '';
        return this.parts;
    }}}
    name = {to: {parts: name => {
        let bey = name.toUpperCase().match(/^(.*?(?:(?<=[A-z])\D)?)(\w-?\d+)?(\w*)$/)?.slice(1, 4) ?? [];
        return bey[0] ? [
            ...bey[0].match(/^(.*?)([一-龢]{1,2})(\w)?$/)?.slice(1, 4).map((b, i) => PARTS.blade.CX[Part.blade.sub[i]][b] ?? b) ?? [],
            ...['ratchet', 'bit'].map((comp, i) => Bey.CACHE.parts.find(p => p.abbr == bey[i + 1] && p.comp == comp) ?? bey[i + 1]),
        ].filter(_ => _) : [name];
    }}}
    parts = {to: {name: () => {
        let names = {};
        names.chi = [...new O({...['', '']}).append(...
            [this.blade].flat().map(b => Markup.remove(b?.names.chi ?? b?.abbr)?.replace(/^(?!.+ ).*/, '$& $&').split(' '))
        ).values()].filter(n => n).join('⬧'),
        names.chi &&= [names.chi, ' ', this.ratchet.abbr, this.bit.abbr].join('').replace('-', '‑');

        names.jap = Array.isArray(this.blade) ? 
            this.blade.map((b, i, ar) => ar[0] && ar[1] && i == 2 ? b.abbr : b?.names.jap) : this.blade.names.jap,
        names.jap = [names.jap, ' ', this.ratchet.abbr, this.bit.abbr].flat().join('').replace('-', '‑');
        
        let single = parts => parts.length === 1 && META.jap.at(parts[0].path.slice(0, -1))?._;
        return {
            ...names, line: this.line,
            only: single([this.blade, this.ratchet, this.bit].flat().filter(p => p?.abbr))
        };
    }}}
    for = {
        index: name => this.name.to.parts(name),
        prize: abbr => this.abbr.to.parts(abbr).to.name(),
        product: ([code, type, abbr, ...others]) => {
            if (code == 'BH') return new Text;
            this.abbr.to.parts(this.abbr = abbr);
            return new Row(this, code, type, others);
        },
    }
}
class Row {
    constructor(bey, code, type, others) {
        let [video, extra] = ['string', 'object'].map(t => others.find(o => typeof o == t));
        this.tr = E('tr', [
            this.cell(code, video), 
            ...[bey.blade].flat().map(b => b.cell()), bey.ratchet.cell(), bey.bit.cell()
        ].flat(9), {
            classList: [bey.line || 'BX', type],
            dataset: {abbr: bey.abbr}
        });
        this.extra(extra ?? {});
        return this.tr;  
    }
    cell (code, video) {
        code = code.split('_');
        return E('td', [code[0] + ' ', code[1] ? E('sub', code[1]) : ''], {dataset: {code: code[0], ...video ? {video} : {}}});
    }
    extra ({coat, mode}) {
        coat && E(this.tr).set({'--coat': coat});
        mode && (this.tr.Q('td[headers=blade]').dataset.mode = JSON.stringify(mode));
    }
}

class Search {
    constructor(query) {
        this.regexp = [];
        if (typeof query == 'string') {
            query = query.replace(/[’'ʼ´ˊ]/g, '′');
            /^\/.+\/\w?$/.test(query) ?
                this.regexp.push(new RegExp(.../^\/(.+)\/(\w?)$/.exec(query).slice(1))) :
            !/^.X/i.test(query) ?
                this.lookup(query.replace(/([^\\])?([.*+?^${}()|[\]\\])/g, '$1\\$2')) : '';
        } else {
            query.length == 3 && (query = PARTS.flatten(([comp, line, sub, abbr]) => [comp, line, abbr]).at(query).path);
            this.query = query.toReversed().slice(1).reduce((obj, key) => new O({[key]: obj}), query.at(-1));
            this.href = new URLSearchParams({...this.query.flatten(([comp, line, sub, abbr]) => [`${comp}-${line}`, abbr])});
        }
        this.build();
        return Search.beys().then(beys => ({
            beys: beys.filter(bey => 
                this.regexp.some(r => r.test(bey.dataset?.abbr ?? bey[2])) ||
                typeof query == 'string' && query.length >= 2 && 
                    this.#search.code(query.split(' '), bey.firstChild?.dataset.code ?? bey[0])
            ),
            href: this.href || `search=${query}`
        }));
    }
    lookup (string) {
        this.query = this.#search.deep(string.split(' ')).map(([comp, parts]) => [comp, new A(
            [...parts.filter(([, part]) => part instanceof Part).keys()], 
            {...parts.filter(([, part]) => !(part instanceof Part)).map(([line, subs]) => 
                [line, subs.map(([s, parts]) => [s, [...parts.keys()]]).filter(([, parts]) => parts.length)]
            )}
        )]);
    }
    #search = {
        deep: (target, parts = PARTS) => parts.map(([comp, parts]) => [comp, parts.filter(([, part], i, arr) => 
            part instanceof Part ? this.#search.match(target, part) : arr[i][1] = this.#search.deep(target, part)
        )]),
        match: (target, {abbr, names = {}}) => Array.isArray(target) ?
            target.some(t => this.#search.match(t, {abbr, names})) :
            target.toLowerCase() == abbr.toLowerCase() ||
            !/^[^一-龥]{1,2}$/.test(target) && Object.values(names).some(n => new RegExp(target, 'i').test(Markup.remove(n))),
        code: (target, code) => Array.isArray(target) ?
            target.some(t => this.#search.code(t, code)) : new RegExp(target.replace('-', ''), 'i').test(code.replace('-', ''))
    }
    build () {
        const q = this.query;
        if (!q) return;
        if (q.blade) {
            let single = q.blade instanceof A ? [...q.blade] : typeof q.blade == 'string' ? q.blade : null;
            let divided = q.blade instanceof A ? {...q.blade} : typeof q.blade == 'object' ? q.blade : null;
            single?.length && this.regexp.push(new RegExp(`^${Search.#or(single)} .+$`, 'u'));
            divided && META.blade.delimiter.each(([line, char]) => new O(divided[line]).size &&
                this.regexp.push(new RegExp(`^${Part.blade.sub.map(sub => Search.#or(divided[line][sub])).join(`\\${char}`)} .+$`, 'u'))
            );
        }
        if (q.ratchet?.length || q.ratchet?.size)
            this.regexp.push(new RegExp(`^.+? ${Search.#or(q.ratchet instanceof A ? [...q.ratchet] : q.ratchet)} .+$`));
        if (q.bit?.length || q.bit?.size)
            this.regexp.push(new RegExp(`^.+? ${Search.#or(q.bit instanceof A ? [...q.bit] : q.bit)}$`, 'u'));
    }
    static #beys;
    static beys = async () => Search.#beys ??= Q('tbody tr') ?? await DB.get('product', 'beys');
    static #or = abbrs => abbrs?.length ? `(?:${[abbrs].flat().filter(a => typeof a == 'string').join('|')})` : '.+?'
}
class Preview {
    constructor(what, pathORcode, type) {
        if (what == 'index')
            return [
                ...this.#image.src('main', pathORcode),
                ...this.#image.src('more', pathORcode, '', this.#image.params(pathORcode, type).amount),
            ];
        Preview.reset();
        Preview.place.showPopover();
        [what].flat().reduce((prom, w) => prom.then(() => this[w](pathORcode)), Promise.resolve())
        .then(() => Glossary(Preview.place));
    }
    cell = path => new Search(path).then(({beys, href}) => Q('#cells').append(
        E('table', [
            href ? E('caption>a', {href: `/x/products/?${href}`}) : '',
            Preview.thead.cloneNode(true), 
            E('tbody', beys.map(bey => new Bey(bey)))
        ], {
            onclick: Preview.for.table
        })
    )).then(() => Cell.fill('chi'))

    tile = path => PARTS.at(path).tile().then(tile => Q('#tiles').append(tile.fill()))
    image (tdORcode) {
        let dataset = typeof tdORcode == 'object' ? tdORcode.dataset : {code: tdORcode};
        let {code, video, lowercase, markup, amount} = this.#image.revisions(dataset);
        Preview.place.Q('#images').append(
            E('p', Markup.spacing(Maps.note.find(dataset.code))),
            ...video?.split(',').map(vid => E('a', {href: `//youtu.be/${vid}?start=60`})) ?? [],
            ...this.#image.src('main', code),
            ...this.#image.src('more', code, markup.more, amount),
            ...this.#image.src('detail', lowercase ? code.toLowerCase() : code, markup.detail),
        );
        /^BXG-\d+$/.test(dataset.code) && setTimeout(() => !Preview.place.Q('#images img') && 
            Preview.place.Q('#images').prepend(E('a', {
                href: `//google.com/search?q=%22${dataset.code}%22+beyblade`, target: '_blank'
            }))
        , 1000);
    }
    #image = {
        revisions: ({code, video}) => {
            video ??= Q(`[data-code=${code}][data-video]`)?.dataset.video;
            let {lowercase, amount} = this.#image.params(code);
            let {alias, _, ...markup} = Maps.images.find(code) ?? {};
            code = (alias || code).replace('-', _ ? '_' : '');
            return {code, video, lowercase, markup, amount};
        },
        params: (code, type) => ({
            lowercase: (([line, number]) => Maps.lowercase[line]?.(number))(code.split('-')),
            amount: (/set|random/i.test(type) || Q(`[data-code='${code}']`)?.length > 2 ? 18 : 9) 
                + (META.blade.delimiter[code.split(/(?<=[a-z])(?=\d)|-/i)[0]] ? 2 : 0)
        }),
        src: (type, code, markup, amount) => 
            [...markup ? Markup.replace(markup, 'image', {no: code}) : [code]]
                .flatMap(code => this.#image.format[type](code, amount))
                .map(src => E('img', {src: src.replace(/^(?!\/).+$/, `//beyblade.takaratomy.co.jp/beyblade-x/lineup/_image/$&.png`)}))
        ,
        format: {
            main: code => `${code}@1`,
            more: (code, amount) => [...Array(amount)].map((_, i) => `${code}_${`${i+1}`.padStart(2, 0)}@1`),
            detail: code => `detail_${code}`
        },
    }
    static for = {
        table: ev => location.pathname.includes('products') ? new Preview(...
            ev.target.matches(':first-child') ? ['image', ev.target.dataset.code] : ['tile', ev.target.Part.path]
        ) : ''
    }
    static place = Q('[popover]') || Q('body').appendChild(E('aside', {
        popover: 'auto',
        onclick: ev => ev.target.closest('[popover]')?.hidePopover()
    }, [E('div#cells'), E('div#tiles'), E('div#images')]));
    static thead = E('thead>tr', [
        E('th', 'No'), 
        E('th.blade', 'Blade', {colSpan: 4}),
        E('th.ratchet', 'Ratchet'),
        E('th.bit', 'Bit', {colSpan: 2}),
    ]);
    static reset = () => Preview.place?.Q('div', div => div.innerHTML = '');
}
export {Bey, Search, Preview};