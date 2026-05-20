import DB from '../include/DB.js'
import { Part, Tile } from '../parts/part.js';
import { Markup } from '../include/utilities.js';

let PARTS;
const Garage = () => DB.get.essentials(true)
    .then(([meta, parts]) => {
        PARTS = Part.import(meta, parts).parts;
        return Garage.get('acquired');
    })
    .then(beys => {
        Garage.transform(beys);console.log(Garage.parts);
        Q('main').append(
            ...['chip', 'over', 'metal', 'main', 'assist'].map(comp => Garage.element.list(comp)),
            ...['blade', 'ratchet', 'bit'].flatMap(comp => Garage.element.list(comp))
        );
        Garage.element.events();
    });
Object.assign(Garage, {
    put (mode, code, content) {
        Garage[mode][code] = content;
        DB.put('user', {[mode]: Garage[mode]});
    },
    get: mode => DB.get('user', mode).then(beys => Garage[mode] = beys || {}),
    transform: beys => {
        Garage.parts = {CX: {}};
        new O(beys).each(([code, obj]) => {
            ['blade','ratchet','bit'].forEach(comp => {
                if (!obj[comp]) return;
                let map = Garage.parts[comp] ??= new Map();
                map.get(PARTS[comp][obj[comp]])?.push(code) ?? map.set(PARTS[comp][obj[comp]], [code]);
            });
            obj = (({blade, ratchet, bit, ...rest}) => rest)(obj);
            new O(obj).each(([subcomp, abbr]) => {
                let map = Garage.parts.CX[subcomp] ??= new Map();
                map.get(PARTS.blade.CX[subcomp][abbr])?.push(code) ?? map.set(PARTS.blade.CX[subcomp][abbr], [code]);
            });
        });
    },
    sort: {
        blade: ([P1], [P2]) => P2.weight - P1.weight,
        ratchet: ([P1], [P2]) => parseInt(P1.abbr) - parseInt(P2.abbr),
        bit: ([P1], [P2]) => P1.abbr > P2.abbr ? 1 : -1
    },
    inferior: {
        CX: {
            chip: P => P.weight < 2, over: P => P.weight < 3, metal: P => P.weight < 28, main: P => P.weight < 31, assist: P => P.weight < 6
        },
        blade: P => P.weight < 35,
        ratchet: P => parseInt(P.abbr.split('-')[1]) > 70,
        bit: P => parseInt(P.stat.at(-1)) > 125 || /^[BDGHMRTW]/.test(P.abbr)
    },
});
Garage.element = {
    events: () => {
        Q('main').onclick = ev => ev.target.closest('ul')?.classList.toggle('open')
    },
    section: comp => Array.isArray(comp) ? comp.map(Garage.element.section) : E(`section#${comp}`, [
        E('h3', comp), E('ol'), 
        E('details', [E('summary'), E('ol')])
    ]),
    list: comp => {
        let processed, section = Garage.element.section(comp == 'blade' ? ['blade-UX', 'blade-BX'] : comp);
        let append = (processed, i) => new O({false: 'h3+ol', true: 'details ol'}).each(([type, el]) => 
            Promise.all(processed[type]?.map(([P, codes]) => Garage.element.item(P, codes)) ?? [])
            .then(lis => (i != null ? section[i] : section).Q(el).append(...lis))
        );
        if (comp == 'blade') {
            processed = Object.groupBy([...Garage.parts[comp]].sort(Garage.sort[comp]), ([P]) => P.group == 'UX' || P.attr.has('UX'));
            processed.true = Object.groupBy(processed.true, ([P]) => Garage.inferior[comp](P));
            append(processed.true, 0);
            section[0].Q('summary').innerText = Garage.element.summary[comp] + ` (${processed.true?.true?.length ?? 0})`;
            processed.false = Object.groupBy(processed.false, ([P]) => Garage.inferior[comp](P));
            append(processed.false, 1);
            section[1].Q('summary').innerText = Garage.element.summary[comp] + ` (${processed.false?.true?.length ?? 0})`;
        } else if (['blade','ratchet','bit'].includes(comp)) {
            processed = [...Garage.parts[comp]].sort(Garage.sort[comp]);
            processed = Object.groupBy(processed, ([P]) => Garage.inferior[comp](P))
            append(processed);
            section.Q('summary').innerText = Garage.element.summary[comp] + ` (${processed.true?.length ?? 0})`;
        } else {
            processed = [...Garage.parts.CX[comp]].sort(([P1], [P2]) => P2.weight - P1.weight);
            processed = Object.groupBy(processed, ([P]) => Garage.inferior.CX[comp](P));
            append(processed);
            section.Q('summary').innerText = Garage.element.summary[comp] + ` (${processed.true?.length ?? 0})`;
        }
        return section;
    },
    item: async (P, codes) => {
        P.comp == 'bit' && !P.attr.size && await P.revise('tile');
        return E('li', [
            E('figure', [
                E('img', {src: `../img/${P.path.join('/')}.png`}), 
                E('figcaption', [
                    ...Tile.prototype.fill.icons.call({Part: P}).map(li => li.matches?.('li:has(img)') ? li.childNodes[0] : E('i', li.childNodes?.[0]))
                        .filter(ch => ch.matches('i:not(:empty),img[src*=types]')), 
                    ...(P.only.name() ? P.names.chi || P.names.eng : P.path.at(-1)).split(' ').map(n => E('b', Markup.replace(Markup.remove(n), 'mode')))
                ]),
            ]),
            E('ul', codes.map(c => E('li', c)), {dataset: {count: codes.length}})
        ])
    },
    summary: {
        chip: '< 2 g', over: '< 3 g', metal: '< 28 g', main: '< 31 g', assist: '< 6 g',
        blade: '< 35 g', ratchet: '> 70 dmm', bit: '> 125 dmm／BDGHMRTW系'
    }
}
export default Garage;