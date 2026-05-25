import DB from '../include/DB.js'
import { Part, Tile } from '../parts/part.js';
import { Markup } from '../include/utilities.js';
import { Preview } from '../parts/bey.js';

let PARTS;
const Garage = () => DB.get.essentials(true)
    .then(([meta, parts]) => {
        PARTS = Part.import(meta, parts).parts;
        return Garage.get('acquired');
    })
    .then(async beys => {
        Garage.transform(beys);
        return Promise.all(['chip', 'over', 'metal', 'main', 'assist', 'blade', 'ratchet', 'bit'].map(comp => Garage.element.list(comp)))
    })
    .then(sections => {
        Q('main').append(...sections.flat());
        Garage.element.events();
        return DB.get('product', 'beys');
    })
    .then(beys => {
        Garage.fill('hk');
        Q('option[value]', option => option.classList = beys.find(([code]) => code == option.value)?.[1])
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
        bit: ([P1], [P2]) => [...P1.attr][0] > [...P2.attr][0] ? 1 : [...P1.attr][0] < [...P2.attr][0] ? -1 : 0
    },
    inferior: {
        CX: {
            chip: P => P.weight < 2, over: P => P.weight < 3, metal: P => P.weight < 28, main: P => P.weight < 31, assist: P => P.weight < 6
        },
        blade: P => P.weight < 35,
        ratchet: P => parseInt(P.abbr.split('-')[1]) > 70,
        bit: P => parseInt(P.stat.at(-1)) > 125 || /^[BDGHMRTW]./.test(P.abbr)
    },
    fill: lang => Q('figure:has(b[lang])>img', img => {
        let path = img.src.match(/(?<=img\/).+(?=\.png)/)[0].split('/');
        let name = PARTS.at(path).names[lang] || PARTS.at(path).names.chi || PARTS.at(path).names.eng;
        if (['hk','tw'].includes(lang)) {
            name = name.split(' ');
            name = name[['hk','tw'].indexOf(lang)] || name[0];
        }
        E(img.nextSibling.Q('b')).set([...Markup('cell', name)], {lang});
    })
});
Garage.element = {
    events: () => {
        Q('main').onclick = ev => ev.target.matches('figcaption') ? 
            new Preview('tile', {path: ev.target.previousSibling.src.match(/(?<=img\/).+(?=\.png)/)[0].split('/')}, ev) : null;
        Q('main').onchange = ev => {
            new Preview(['cell', 'image'], {code: ev.target.value.split('_')[0]}, ev);
            ev.target.firstChild.selected = true;
        }
        Q('nav form').onchange = ev => Garage.fill(ev.target.value);
        Q('#export').onclick = () => {
            Q('span').classList = 'loading'; 
            htmlToImage.toJpeg(Q('main')).then(href => {
                E('a', {download: '我的庫存.jpg', href}).click();
                Q('.loading').classList.remove('loading');
            });
        }
    },
    section: comp => Array.isArray(comp) ? comp.map(Garage.element.section) : E(`section#${comp}`, 
        comp.includes('-') ? {'--line': `url(../img/lines.svg#${comp.split('-')[1]})`} : {}, 
        [E(`h2.${comp.split('-')[0]}`), E('ol>li>details>summary')]
    ),
    list: async comp => {
        let processed, section = Garage.element.section(comp == 'blade' ? ['blade-UX', 'blade-BX'] : comp);
        let add = (processed, i) => {
            new O({false: 'before', true: 'after'}).each(([type, posi]) => 
                (i != null ? section[i] : section).Q('li:has(details)')[posi](...processed[type]?.map(([P, codes]) => Garage.element.item(P, codes)) ?? [])
            );
        }
        if (comp == 'blade') {
            processed = Object.groupBy([...Garage.parts[comp]].sort(Garage.sort[comp]), ([P]) => P.group == 'UX' || P.attr.has('UX'));
            processed.true &&= Object.groupBy(processed.true, ([P]) => Garage.inferior[comp](P));
            add(processed.true ?? [], 0);
            section[0].Q('summary').replaceChildren(...Garage.element.summary(comp, processed.true?.true));
            processed.false &&= Object.groupBy(processed.false, ([P]) => Garage.inferior[comp](P));
            add(processed.false ?? [], 1);
            section[1].Q('summary').replaceChildren(...Garage.element.summary(comp, processed.false?.true));

        } else if (['ratchet','bit'].includes(comp)) {
            comp == 'bit' && (Garage.parts[comp] = await Promise.all([...Garage.parts[comp]].map(async ([P, _]) => [P.attr.size ? P : await P.revise('tile'), _])));
            processed = [...Garage.parts[comp]].sort(Garage.sort[comp]);
            processed = Object.groupBy(processed, ([P]) => Garage.inferior[comp](P))
            add(processed);
            section.Q('summary').replaceChildren(...Garage.element.summary(comp, processed.true));
        } else {
            processed = [...Garage.parts.CX[comp] ?? []].sort(Garage.sort.blade);
            processed = Object.groupBy(processed, ([P]) => Garage.inferior.CX[comp](P));
            add(processed);
            section.Q('summary').replaceChildren(...Garage.element.summary(comp, processed.true));
        }
        return section;
    },
    item: (P, codes) => E('li', [
        E(`figure`, [
            E('img', {src: `../img/${P.path.join('/')}.png`}), 
            E('figcaption', [
                ...Tile.prototype.fill.icons.call({Part: P}).map(li => li.matches?.('li:has(img)') ? li.childNodes[0] : E('i', li.childNodes?.[0]))
                    .filter(ch => ch.matches('i:not(:empty),img[src*=types]')), 
                E('b', P.only.name() ? {lang: ''} : P.path.at(-1))
            ]),
        ]),
        E('select', [E('option', codes.length), ...codes.map(c => E('option', {value: c},
            Markup('cell', c)
            //c.replace(/_\d+/, sub => [...sub].map(d => String.fromCharCode(d.charCodeAt(0) + 8272)).toSpliced(0, 1, ' ').join('')),
        ))])
    ]),
    summary: (comp, parts = []) => [
        ({
            chip: '< 2 g', over: '< 3 g', metal: '< 28 g', main: '< 31 g', assist: '< 6 g',
            blade: '< 35 g', ratchet: '> 70 dmm', bit: ['> 125 dmm ／', E('br'), '非F/L/U系']
        })[comp], E('br'), ` [ ${parts.length} ]`
    ].flat()
}
export default Garage;