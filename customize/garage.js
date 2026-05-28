import DB from '../include/DB.js'
import { Part, Tile } from '../parts/part.js';
import { Markup } from '../include/utilities.js';
import { Bey, Preview } from '../parts/bey.js';

navigator.storage.persist();
let PARTS;
const Garage = () => Garage.before().then(Garage.display).then(Garage.after);
Object.assign(Garage, {
    get: mode => DB.get('user', mode).then(beys => Garage[mode] = beys || {}),
    put: (mode, code, content) => (Garage[mode][code] = content) && DB.put('user', {[mode]: Garage[mode]}),

    async before () {
        let [resp, acquired] = await Promise.all([fetch('../sitemap.txt'), Garage.get('acquired')]);
        if (!Object.keys(acquired).length) return Promise.reject();
        let [hrefs, [meta, parts]] = await Promise.all([resp.text(), DB.get.essentials(true)]);
        PARTS = Part.import(meta, parts).parts;
        
        return new Map(hrefs.split('\n').filter(href => href.includes('parts')).map(href => {
            Q('main').append(E('a', {href}));
            let {hash, search} = new URL(href);
            search = [...new URLSearchParams(search)][0];
            let [comp, map] = [search[1] ? hash.substring(1) : search[0], new Map()];
            Object.entries(acquired).forEach(([code, obj]) => {
                if (!obj[comp]) return;
                let P = Bey.comps.includes(comp) ? PARTS[comp][obj[comp]] : PARTS.blade.CX[comp][obj[comp]];
                map.get(P)?.push(code) ?? map.set(P, [code]);
            });
            return [comp, map];
        }));
    },
    async display (acquired) {
        let sortGroupShow = (comp, map, section) => {
            let sorter = Garage.sort[comp] ?? Garage.sort.blade;
            let grouper = ([P]) => Bey.comps.includes(comp) ? Garage.inferior[comp](P) : Garage.inferior.CX[comp](P);
            let parts = Object.groupBy((Array.isArray(map) ? map : [...map ?? []]).sort(sorter), grouper);
            new O({false: 'before', true: 'after'}).each(([type, posi]) => 
                section.Q('li:has(details)')[posi](...parts[type]?.map(([P, codes]) => Garage.element.li(P, codes)) ?? [])
            );
            section.Q('summary').replaceChildren(...Garage.element.summary(comp, parts.true?.length));
        };
        [...acquired].forEach(async ([comp, map]) => {
            let section = Garage.element.section(comp == 'blade' ? ['blade#UX', 'blade#BX'] : comp);
            if (comp == 'blade') {
                let UX = Object.groupBy([...map], ([P]) => P.group == 'UX');
                sortGroupShow(comp, UX.true, section[0]);
                sortGroupShow(comp, UX.false, section[1]);
            } else {
                comp == 'bit' && (map = await Promise.all(
                    [...map].map(async ([P, _]) => [P.attr.size ? P : await P.revise('tile'), _])
                ));
                sortGroupShow(comp, map, section);
            }
            Q('main').append(...[section].flat());
        });
    },
    after () {
        Garage.events();
        Q('h2 a', a => {
            a.classList = a.search.substring(1).split('=')[0];
            a.hash && !/.X$/.test(a.hash) && (a.innerText = a.hash);
        });
        Q(`input[value=${Storage('pref')?.lang || 'hk'}]`).click();
        DB.get('product', 'beys').then(beys => {
            beys = new Map(beys.map(([code, ...rest]) => [code, rest]));
            Q('option[value]', option => {
                let bey = beys.get(option.value);
                bey && (option.classList = bey[0]);
                bey?.[0] == 'Lm' && (option.title = bey[1]);
                bey?.[0] == 'RB' ? option.Q('sub').prepend(' ') : option.Q('sub')?.remove();
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
            chip: P => P.weight && P.weight < 2, 
            over: P => P.weight && P.weight < 3, metal: P => P.weight && P.weight < 28, 
            main: P => P.weight && P.weight < 31, assist: P => P.weight && P.weight < 6
        },
        blade: P => P.weight && P.weight < 35,
        ratchet: P => parseInt(P.abbr.split('-')[1]) > 70,
        bit: P => /^[^FLU][^a-z]/.test(P.abbr)
    },
    events () {
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
        Q('nav form').onchange = ev => Storage('pref', {lang: ev.target.value}) && Garage.lang(ev.target.value);
        Q('#prompt').onclick = ev => {
            ev.target.matches('button,textarea') ? ev.stopPropagation() : Q('#prompt').hidePopover();
            ev.target.id == 'copy' && navigator.clipboard.writeText(Q('textarea').value).then(() => {
                let original = ev.target.innerHTML;
                ev.target.innerHTML = '&#xe014;';
                setTimeout(() => ev.target.innerHTML = original, 1000);
            });
        }
    },
    lang (lang) {
        let hktw = name => name.split(' ')[['hk','tw'].indexOf(lang)] || name;
        Q('figure:has(b[lang])>img', img => {
            let path = img.src.match(/(?<=img\/).+(?=\.png)/)[0].split('/');
            let name = PARTS.at(path).names[lang] || PARTS.at(path).names.chi || PARTS.at(path).names.eng;
            ['hk','tw'].includes(lang) && (name = hktw(name));
            E(img.nextSibling.Q('b')).set([...Markup('cell', name)], {lang, title: Markup.remove(PARTS.at(path).names.eng)});
        });
        Q('section:has(h2 a:not(:empty))', section => {
            let name = Part.names[section.id][lang] || Part.names[section.id].chi;
            ['hk','tw'].includes(lang) && (name = hktw(name));
            section.Q('a').innerText = name;
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
    summary: (comp, length = 0) => [
        ({
            chip: '< 2 g', over: '< 3 g', metal: '< 28 g', main: '< 31 g', assist: '< 6 g',
            blade: '< 35 g', ratchet: '> 70 dmm', bit: '非F/L/U系'
        })[comp], E('br'), ` [ ${length} ]`
    ].flat()
}
export default Garage;