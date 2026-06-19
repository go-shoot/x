import DB from '../include/DB.js'
import { Part, Tile, Cell } from '../parts/part.js';
import { Markup, Transition } from '../include/utilities.js';
import { Bey, Preview } from '../parts/bey.js';
import PI from 'https://aeoq.github.io/pointer-interaction/script.js';

navigator.storage.persist();
let PARTS;
const Garage = () => Garage.before().then(Garage.display).then(Garage.after).catch(console.error);
Object.assign(Garage, {
    get: mode => DB.get('user', mode).then(beys => Garage[mode] = beys || {}),
    put: (mode, code, content) => (Garage[mode][code] = content) && DB.put('user', {[mode]: Garage[mode]}),

    async before () {
        Q('nav button', button => button.type = 'button');
        let [resp, acquired] = await Promise.all([fetch('../sitemap.txt'), Garage.get('acquired')]), hrefs;
        if (!Object.keys(acquired).length) {
            Q('.loading')?.classList.remove('loading');
            Q('details').open = true;
            return new O();
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
        new O(acquired).each(([code, obj]) => [...obj].forEach(([subcomp, abbr]) => {
            let P = Bey.comps.includes(subcomp) ? PARTS[subcomp][abbr] : PARTS.blade.CX[subcomp][abbr];
            grouped[subcomp].get(P).push(code);
        }));
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
        [...grouped].forEach(async ([comp, map]) => {
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
            a.classList = `icon-${a.search.substring(1).split('=')[0]}`;
            section.Q('li', (li, i) => li.dataset.order = i);
        });
        let amount = Q('li figure', []).length;
        gtag('event', 'GARAGE', {amount});
        if (!amount) return;
        Q(`input[value=${Storage('pref')?.lang || 'hk'}]`).click();
        Garage.set.tier();
        Garage.set.class();
        Garage.events.sort();
        Q('.loading')?.classList.remove('loading');
    },

    sorter: {
        blade: ([P1], [P2]) => (P2.weight || 0) - (P1.weight || 0),
        ratchet: ([P1], [P2]) => parseInt(P1.abbr.replace('-', '')) - parseInt(P2.abbr.replace('-', '')),
        bit: ([P1], [P2]) => [...P1.attr][0] > [...P2.attr][0] ? 1 : [...P1.attr][0] < [...P2.attr][0] ? -1 : 
            P1.abbr > P2.abbr ? 1 : -1
    },
    inferior: {
        CX: {
            chip: P => !P.weight || P.weight < 2, 
            over: P => !P.weight || P.weight < 3, metal: P => !P.weight || P.weight < 28, 
            main: P => !P.weight || P.weight < 31, assist: P => !P.weight || P.weight < 6
        },
        blade: P => !P.weight || P.weight < 35,
        ratchet: P => parseInt(P.abbr.split('-')[1]) > 70,
        bit: P => /^[^FLU][^a-z]/.test(P.abbr)
    },
    set: {
        tier: () => Garage.comps.forEach(comp => 
            DB.get('user', `tier-${comp}`).then(tiers => Object.entries(tiers ?? {}).forEach(([id, t]) => {
                let [subcomp, abbr] = id.split('.');
                let select = Q(`section#${abbr ? subcomp : comp} li[id='${abbr ?? id}'] select[name=tier]`);
                if (!select || t == null || isNaN(t)) return;
                select.options[t+1].selected = true;
                select.dispatchEvent(new InputEvent('change', {bubbles: true}));
            }))
        ),
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
    save: {
        tier (lis) {
            let grouped = Object.groupBy(lis, li => [li.closest('section').Q('a[href*=CX]') ? 'CX' : li.closest('section').id.split('#')[0]]);
            grouped.CX &&= grouped.CX.reduce((obj, li) => ({ ...obj, [`${li.closest('section').id}.${li.id}`]: li.tier }), {});
            grouped.CX && DB.get('user', 'tier-CX').then(obj => DB.put('user', {'tier-CX': {...obj, ...grouped.CX}}));
            Bey.comps.forEach(comp => {
                grouped[comp] &&= grouped[comp].reduce((obj, li) => ({ ...obj, [li.id]: li.tier }), {});
                grouped[comp] && DB.get('user', `tier-${comp}`).then(obj => DB.put('user', {[`tier-${comp}`]: {...obj, ...grouped[comp]}}));
            });
            lis.forEach(li => li.classList.remove('selected'));
        }
    },
    count: () => Q('ol', ol => ol.Q('summary').title = ol.Q('li:has(details)~:not(.unacquired)', []).length),
    events () {
        E(Q('main')).set({
            async onclick (ev) {console.log(ev.target);
                if (ev.target.matches('main,h2,ol')) return Q('li.selected', li => li.classList.remove('selected'));
                if (Garage.held) return;
                let path = ev.target.closest('figure')?.firstElementChild.src.match(/(?<=img\/).+(?=\.png)/)[0].split('/');
                path && new Preview(['cell', 'tile'], {path}, ev).then(() => Garage.set.acquired(ev.target));
            },
            onpointerup: () => Garage.held = false,
            async onchange (ev) {
                if (ev.target.name == 'acquired') {
                    let [code, option] = [ev.target.value, ev.target.options[ev.target.selectedIndex]];
                    ev.target.firstElementChild.selected = true;
                    await (option.matches('.Lm') ?
                        new Preview(['cell', 'diamond'], {code, bey: option.title}, ev) :
                        new Preview(['cell', 'image'], {code: code.split('_')[0]}, ev));
                    return Garage.set.acquired(ev.target);
                }
                let changed = [ev.target.closest('li'), ...Q('li.selected', [])];
                changed.forEach(li => {
                    li.tier = li.Q('select[name=tier]').value = parseInt(ev.target.value);
                    li.tier >= 0 ? E(li).set({'--tier': E(ev.target.selectedOptions[0]).get('--tier')}) : li.removeAttribute('style');
                });
                if (!ev.isTrusted) return; 
                Garage.save.tier(changed);
                Q('input[value=tier]:checked') && Garage.events.sort(true);
            }
        });
        Q('#prompt').onclick = ev => {
            ev.target.matches('button,textarea') ? ev.stopPropagation() : Q('#prompt').hidePopover();
            ev.target.id == 'copy' && navigator.clipboard.writeText(Q('textarea').value).then(() => {
                let original = ev.target.innerHTML;
                ev.target.innerHTML = '&#xe014;';
                setTimeout(() => ev.target.innerHTML = original, 1000);
            });
        }
        Q('#export').onclick = ev => {
            Promise.all(['acquired', ...Garage.comps.map(c => `tier-${c}`)].map(async key => 
                [key, await DB.get('user', key)]
            )).then(data => {
                let json = JSON.stringify(Object.fromEntries(data.filter(([, d]) => d)));
                E('a', {
                    href: `data:text/json;charset=utf-8,${encodeURIComponent(json)}`,
                    download: `存庫${new Date().toLocaleDateString()}.json`
                }).click();
            })
        }
        Q('nav form').onchange = ev => {
            if (ev.target.name == 'view') return;
            if (ev.target.name == 'lang')
                return Storage('pref', {lang: ev.target.value}) && Garage.events.lang(ev.target.value);
            if (ev.target.name == 'sort')
                return Garage.events.sort(true);
            let reader = new FileReader;
            reader.readAsText(ev.target.files[0]);
            reader.onload = () => console.log(JSON.parse(reader.result))??Promise.all(
                Object.entries(JSON.parse(reader.result)).map(([key, data]) => DB.put('user', {[key]: data}))
            ).then(() => [ev.target.value = '', location.reload()]);
        }
        PI.events({
            'section li:has(figure)': {
                hold: hold => hold.for(.5).to((_, target) => (Garage.held = true) && target.classList.toggle('selected'))
            }
        });
    },
    comps: ['CX', ...Bey.comps]
});
Object.assign(Garage.events, {
    sort (trusted) {
        let sorting = (by = Q('input[name=sort]:checked').value) => {
            Q('ol', ol => {
                if (by == 'default')
                    return ol.replaceChildren(...[...ol.children].sort((a, b) => a.dataset.order - b.dataset.order));
                let more = ol.Q('li:has(details)');
                ol.after(more);
                ol.replaceChildren(...[...ol.children].sort((a, b) => (a.tier >= 0 ? a.tier : Infinity) - (b.tier >= 0 ? b.tier : Infinity)));
                let inferior = [...ol.children].find(li => !(li.tier < 3))
                inferior ? inferior.before(more) : ol.append(more);
            });
            Garage.count();
        }
        trusted ? Transition.allow.for(sorting) : sorting();
    },
    lang (lang) {
        Q('main figure:has(b[lang])>img', img => {
            let path = img.src.match(/(?<=img\/).+(?=\.png)/)[0].split('/');
            let [name, l] = [PARTS.at(path).names[lang] || PARTS.at(path).names.chi, lang];
            name ? (name = Markup.hktw(lang, name)) : ([name, l] = [PARTS.at(path).names.eng, 'eng']);
            E(img.nextElementSibling.Q('b')).set([...Markup.cell(name)], {lang: l, title: Markup.clear(PARTS.at(path).names.eng)});
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
    li: (P, codes) => {
        let li = Q('#li').content.cloneNode(true);
        Object.entries({
            li: {id: P.abbr, classList: codes.length ? '' :'unacquired'},
            img: {src: `../img/${P.path.join('/')}.png`},
            figcaption: Tile.prototype.fill.icons.call({Part: P})
                .map(li => li.matches?.('li:has(img)') ? li.childNodes[0] : E('i', li.childNodes?.[0] ?? ''))
                .filter(ch => ch.matches('i:not(:empty),img[src*=types]'))
                .concat(E('b', P.only.name() ? {lang: ''} : P.path.at(-1))),
            'select[name=acquired]': [E('option', `${codes.length}`), ...codes.map(c => E('option', {value: c}, Markup.cell(c)))]
        }).forEach(([el, content]) => E(li.Q(el)).set(content));
        return li;
    },
    summary: comp => [
        E('span.default', {
            chip: '< 2 g', over: '< 3 g', metal: '< 28 g', main: '< 31 g', assist: '< 6 g',
            blade: '< 35 g', ratchet: '> 70 dmm', bit: '非F/L/U系'
        }[comp]), E('span.tier', '> T2')
    ]
}
export default Garage;