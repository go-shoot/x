import DB from '../include/DB.js'
import { Part, Tile, Cell } from '../parts/part.js';
import { Markup } from '../include/utilities.js';
import { Bey, Preview } from '../parts/bey.js';
import PI from 'https://aeoq.github.io/pointer-interaction/script.js';

navigator.storage.persist();
let PARTS;
const Garage = () => Garage.before().then(Garage.display).then(Garage.after).catch(er => er && console.error(er));
Object.assign(Garage, {
    get: mode => DB.get('user', mode).then(beys => Garage[mode] = beys || {}),
    put: (mode, code, content) => (Garage[mode][code] = content) && DB.put('user', {[mode]: Garage[mode]}),

    async before () {
        let [resp, acquired] = await Promise.all([fetch('../sitemap.txt'), Garage.get('acquired')]), hrefs;
        if (!Object.keys(acquired).length) {
            Q('.loading')?.classList.remove('loading');
            Q('details').open = true;
            return Promise.reject();
        }
        [hrefs, PARTS] = await Promise.all([resp.text(), DB.get.essentials({drop: false})]);
        hrefs = hrefs.split('\n').filter(href => href.includes('parts'));
        hrefs.forEach(href => Q('main').append(E('a', {href})));

        let grouped = Object.groupBy(DB.transform(PARTS).to.array(), P => P.subcomp);
        grouped = new O(hrefs.map(href => {
            let {hash, search} = new URL(href);
            search = [...new URLSearchParams(search)][0];
            let subcomp = search[1] ? hash.substring(1) : search[0];
            return [subcomp, new Map(grouped[subcomp].map(P => [P, []]))];
        }));
        new O(acquired).each(([code, obj]) => [...obj].forEach(([subcomp, abbr]) => 
            grouped[subcomp].get(Bey.comps.includes(subcomp) ? 
                PARTS[subcomp][abbr] : PARTS.blade.CX[subcomp][abbr]).push(code)
        ));
        return grouped;
    },
    async display (grouped) {
        let sortGroupShow = (comp, map, section) => {
            let sorter = Garage.sorter[comp] ?? Garage.sorter.blade;
            let grouper = ([P]) => Bey.comps.includes(comp) ? Garage.inferior[comp](P) : Garage.inferior.CX[comp](P);
            let parts = Object.groupBy((Array.isArray(map) ? map : [...map ?? []]).sort(sorter), grouper);
            new O({false: 'before', true: 'after'}).each(([type, posi]) => 
                section.Q('li:has(details)')[posi](...parts[type]?.map(([P, codes]) => Garage.element.li(P, codes)) ?? [])
            );
        };
        Object.entries(grouped).forEach(async ([comp, map]) => {
            let section = Garage.element.section(comp == 'blade' ? ['blade#UX', 'blade#BX'] : comp);
            if (comp == 'blade') {
                let UX = Object.groupBy([...map], ([P]) => P.group == 'UX');
                sortGroupShow(comp, UX.true, section[0]);
                sortGroupShow(comp, UX.false, section[1]);
            } else {
                comp == 'bit' && (map = await Promise.all(
                    [...map].map(async ([P, _]) => [P.attr ? P : await P.revise(['attr']), _])
                ));
                sortGroupShow(comp, map, section);
            }
            [section].flat().forEach(s => s.Q('summary').append(...Garage.element.summary(comp)));
            Q('main').append(...[section].flat());
        });
    },
    after () {
        Garage.count();
        Garage.events();
        Q('section', section => {
            let a = section.Q('h2 a');
            E(a).set({
                classList: `icon-${a.search.substring(1).split('=')[0]}`,
                innerText: a.hash && !/.X$/.test(a.hash) ? a.hash : ''
            });
            section.Q('li', (li, i) => li.dataset.order = i);
        })
        let amount = Q('li figure', []).length;
        gtag('event', 'GARAGE', {amount});
        if (!amount) return;
        Q(`input[value=${Storage('pref')?.lang || 'hk'}]`).click();
        Garage.set.tier();
        Garage.set.class();
        Q('.loading')?.classList.remove('loading');
    },

    sorter: {
        blade: ([P1], [P2]) => P2.weight - P1.weight,
        ratchet: ([P1], [P2]) => parseInt(P1.abbr.replace('-', '')) - parseInt(P2.abbr.replace('-', '')),
        bit: ([P1], [P2]) => [...P1.attr][0] > [...P2.attr][0] ? 1 : [...P1.attr][0] < [...P2.attr][0] ? -1 : 
            P1.abbr > P2.abbr ? 1 : -1
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
    set: {
        tier: () => Q('li:has(figure)', li => li.tier = li.Q('select[name=tier]').value = null ?? Math.floor(Math.random()*6)),
        class: () => DB.get('product', 'beys').then(beys => {
            beys = new Map(beys.map(([code, ...rest]) => [code, rest]));
            Q('option[value]', option => {
                let bey = beys.get(option.value);
                bey && (option.classList = bey[0]);
                option.matches('.Lm') && (option.title = bey[1]);
                option.matches('.RB') ? option.Q('sub').prepend(' ') : option.Q('sub')?.remove();
            });
        }),
        acquired (target) {
            let comp = target.closest('section').id.split('#')[0];
            target.closest('li').Q('option[value]', []).forEach(({value}) => 
                Cell.group(Q(`tr[id='${value}'] [headers=${comp}]`), td => td?.classList.add('acquired'))
            );
        },
    },
    count: () => Q('ol', ol => ol.Q('summary').title = ol.Q('li:has(details)~:not(.unacquired)', []).length),
    events () {
        let observer = new IntersectionObserver(entries => entries.forEach(en => {
            if (!en.isIntersecting) return;
            observer.unobserve(en.target);
        }));
        Q('section', section => observer.observe(section));
        E(Q('main')).set({
            async onclick (ev) {
                if (ev.target.matches('main,ol')) return Q('li.selected', li => li.classList.remove('selected'));
                if (Garage.held) return;
                let path = ev.target.closest('figure')?.firstChild.src.match(/(?<=img\/).+(?=\.png)/)[0].split('/');
                path && new Preview(['cell', 'tile'], {path}, ev).then(() => Garage.set.acquired(ev.target));
            },
            onpointerup: () => setTimeout(() => Garage.held = false),
            async onchange (ev) {
                if (ev.target.name == 'tier') {
                    Q('li.selected', li => li.tier = li.Q('select[name=tier]').value = ev.target.value);
                    return Garage.events.sort();
                }
                let [code, option] = [ev.target.value, ev.target.options[ev.target.selectedIndex]];
                ev.target.firstChild.selected = true;
                await (option.matches('.Lm') ?
                    new Preview(['cell', 'diamond'], {code, bey: option.title}, ev) :
                    new Preview(['cell', 'image'], {code: code.split('_')[0]}, ev));
                Garage.set.acquired(ev.target);
            }
        });
        Q('nav form').onchange = ev => {
            if (ev.target.name == 'view') return;
            if (ev.target.name == 'lang') 
                return Storage('pref', {lang: ev.target.value}) && Garage.events.lang(ev.target.value);
            Garage.events.sort(ev.target.value);
            Garage.count();
        }
        Q('#prompt').onclick = ev => {
            ev.target.matches('button,textarea') ? ev.stopPropagation() : Q('#prompt').hidePopover();
            ev.target.id == 'copy' && navigator.clipboard.writeText(Q('textarea').value).then(() => {
                let original = ev.target.innerHTML;
                ev.target.innerHTML = '&#xe014;';
                setTimeout(() => ev.target.innerHTML = original, 1000);
            });
        }
        PI.events({
            'section li:has(figure)': {
                hold: hold => hold.for(.5).to((_, target) => (Garage.held = true) && target.classList.toggle('selected'))
            }
        });
    },
});
Object.assign(Garage.events, {
    sort (by) {
        by ??= Q('input[name=sort]:checked').value;
        Q('ol', ol => {
            if (by == 'default')
                return ol.replaceChildren(...[...ol.children].sort((a, b) => a.dataset.order - b.dataset.order));
            let more = ol.Q('li:has(details)');
            ol.after(more);
            ol.replaceChildren(...[...ol.children].sort((a, b) => a.tier - b.tier));
            let inferior = [...ol.children].find(li => li.tier == null || li.tier >= 3)
            inferior ? inferior.before(more) : ol.append(more);
        });
    },
    lang (lang) {
        let hktw = name => name.split(' ')[['hk','tw'].indexOf(lang)] || name;
        Q('figure:has(b[lang])>img', img => {
            let path = img.src.match(/(?<=img\/).+(?=\.png)/)[0].split('/');
            let name = PARTS.at(path).names[lang] || PARTS.at(path).names.chi, l = lang;
            !name && (name = PARTS.at(path).names.eng) && (l = 'eng');
            ['hk','tw'].includes(lang) && (name = hktw(name));
            E(img.nextSibling.Q('b')).set([...Markup.cell(name)], {lang: l, title: Markup.clear(PARTS.at(path).names.eng)});
        });
        Q('section:has(h2 a:not(:empty))', section => {
            let name = Part.names[section.id][lang] || Part.names[section.id].chi;
            ['hk','tw'].includes(lang) && (name = hktw(name));
            section.Q('a').innerText = name;
        });
        Garage.events.prompt();
    },
    prompt: () => Q('textarea').value = 
        Q('p[hidden]').textContent + Q('section', []).map(section => 
            Part.names[section.id.split('#')[0]].eng + '：' + 
            (section.Q('li:not(.unacquired) b', []).map(b => b.innerText + (b.lang ? `/${b.title}` : '')).join('、') || '未有')
        ).join('\n')
});
Garage.element = {
    section: comp => Array.isArray(comp) ? 
        comp.map(Garage.element.section) : 
        E(`section`, {id: comp}, [E('h2', Q(`main a[href*='${comp}']`)), E('ol>li>details>summary')]),
    li: (P, codes) => E('li', codes.length ? {} : {classList: 'unacquired'}, [
        E('select', {name: 'tier', hidden: true}, [...Array(6)].map((_, i) => E('option', {value: i}, `T${i}`))),
        E(`figure`, [
            E('img', {src: `../img/${P.path.join('/')}.png`}), 
            E('figcaption', Tile.prototype.fill.icons.call({Part: P})
                .map(li => li.matches?.('li:has(img)') ? li.childNodes[0] : E('i', li.childNodes?.[0] ?? ''))
                .filter(ch => ch.matches('i:not(:empty),img[src*=types]'))
                .concat(E('b', P.only.name() ? {lang: ''} : P.path.at(-1)))
            ),
        ]),
        E('select', {name: 'acquired'}, [
            E('option', `${codes.length}`), ...codes.map(c => E('option', {value: c}, Markup.cell(c)))
        ])
    ]),
    summary: comp => [
        E('span.default', {
            chip: '< 2 g', over: '< 3 g', metal: '< 28 g', main: '< 31 g', assist: '< 6 g',
            blade: '< 35 g', ratchet: '> 70 dmm', bit: '非F/L/U系'
        }[comp]), E('span.tier', '> T3')
    ]
}
export default Garage;