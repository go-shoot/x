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
        return Promise.all(['chip', 'over', 'metal', 'main', 'assist', 'blade', 'ratchet', 'bit'].map(comp => Garage.list(comp)))
    })
    .then(sections => {
        Q('main').append(...sections.flat());
        Garage.events();
        Q('h2 a', a => {
            a.classList = a.search.substring(1).split('=')[0];
            a.hash && !/.X$/.test(a.hash) && (a.title = a.hash.substring(1));
        });
        return DB.get('product', 'beys');
    })
    .then(beys => {
        Garage.fill('hk');
        beys = new Map(beys.map(([code, ...rest]) => [code, rest]));
        Q('option[value]', option => {
            let bey = beys.get(option.value);
            bey && (option.classList = bey[0]);
            option.matches('.Lm') && (option.title = bey[1]);
        });
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
    list: async comp => {
        let processed, section = Garage.element.section(comp == 'blade' ? ['blade#UX', 'blade#BX'] : comp);
        let add = (processed, i) => {
            new O({false: 'before', true: 'after'}).each(([type, posi]) => 
                (i != null ? section[i] : section).Q('li:has(details)')[posi](...processed[type]?.map(([P, codes]) => Garage.element.li(P, codes)) ?? [])
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
    sort: {
        blade: ([P1], [P2]) => P2.weight - P1.weight,
        ratchet: ([P1], [P2]) => parseInt(P1.abbr) - parseInt(P2.abbr),
        bit: ([P1], [P2]) => [...P1.attr][0] > [...P2.attr][0] ? 1 : [...P1.attr][0] < [...P2.attr][0] ? -1 : 0
    },
    inferior: {
        CX: {
            over: P => P.weight < 3, metal: P => P.weight < 28, 
            chip: P => P.weight < 2, main: P => P.weight < 31, assist: P => P.weight < 6
        },
        blade: P => P.weight < 35,
        ratchet: P => parseInt(P.abbr.split('-')[1]) > 70,
        bit: P => /^[^FLU][^a-z]/.test(P.abbr)
    },
    events: () => {
        E(Q('main')).set({
            onclick: ev => {
                let path = ev.target.closest('figure')?.firstChild.src.match(/(?<=img\/).+(?=\.png)/)[0].split('/');
                path && new Preview(['cell', 'tile'], {path}, ev);
            },
            onchange: ev => {
                let option = ev.target.options[ev.target.selectedIndex];
                option.matches('.Lm') ?
                    new Preview(['cell', 'diamond'], {code: ev.target.value, bey: option.title}, ev) :
                    new Preview(['cell', 'image'], {code: ev.target.value.split('_')[0]}, ev);
                ev.target.firstChild.selected = true;
            }
        });
        Q('nav form').onchange = ev => Garage.fill(ev.target.value);
        Q('#prompt').onclick = ev => {
            ev.target.matches('button,textarea') ? ev.stopPropagation() : Q('#prompt').hidePopover();
            ev.target.id == 'copy' && navigator.clipboard.writeText(Q('textarea').value).then(() => {
                let original = ev.target.innerHTML;
                ev.target.innerHTML = '&#xe014;';
                setTimeout(() => ev.target.innerHTML = original, 1000);
            });
        }
    },
    fill (lang) {
        Q('figure:has(b[lang])>img', img => {
            let path = img.src.match(/(?<=img\/).+(?=\.png)/)[0].split('/');
            let name = PARTS.at(path).names[lang] || PARTS.at(path).names.chi || PARTS.at(path).names.eng;
            if (['hk','tw'].includes(lang)) {
                name = name.split(' ');
                name = name[['hk','tw'].indexOf(lang)] || name[0];
            }
            E(img.nextSibling.Q('b')).set([...Markup('cell', name)], {lang, title: Markup.remove(PARTS.at(path).names.eng)});
        });
        Garage.prompt();
    },
    prompt: () => Q('textarea').value = 
        Q('p[hidden]').textContent + Q('section', []).map(section => Part.names[section.id.split('#')[0]].eng + '：' + 
            (section.Q('b', []).map(b => b.lang ? `${b.innerText}/${b.title}` : b.innerText).join('、') || '未有')
        ).join('\n')
});
Garage.element = {
    section: comp => Array.isArray(comp) ? 
        comp.map(Garage.element.section) : 
        E(`section`, {id: comp}, [E('h2', Q(`main a[href*='${comp}']`)), E('ol>li>details>summary')]),
    li: (P, codes) => E('li', [
        E(`figure`, [
            E('img', {src: `../img/${P.path.join('/')}.png`}), 
            E('figcaption', Tile.prototype.fill.icons.call({Part: P})
                .map(li => li.matches?.('li:has(img)') ? li.childNodes[0] : E('i', li.childNodes?.[0] ?? ''))
                .filter(ch => ch.matches('i:not(:empty),img[src*=types]'))
                .concat(E('b', P.only.name() ? {lang: ''} : P.path.at(-1)))
            ),
        ]),
        E('select', [E('option', codes.length), ...codes.map(c => E('option', {value: c}, Markup('cell', c)))])
    ]),
    summary: (comp, parts = []) => [
        ({
            chip: '< 2 g', over: '< 3 g', metal: '< 28 g', main: '< 31 g', assist: '< 6 g',
            blade: '< 35 g', ratchet: '> 70 dmm', bit: '非F/L/U系'
        })[comp], E('br'), ` [ ${parts.length} ]`
    ].flat()
}
export default Garage;