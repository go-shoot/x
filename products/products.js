import DB from '../include/DB.js'
import { Part, Cell } from '../parts/part.js';
import { Bey, Preview, Search } from '../parts/bey.js';
import { FilterForm, Markup } from '../include/utilities.js';
import Garage from '../customize/garage.js';
import PI from 'https://aeoq.github.io/pointer-interaction/script.js';

let PARTS;
const Table = () => Table.before().then(Table.display).then(Table.after);
Object.assign(Table, {
    body: Q('tbody'),
    async before () {
        Filter();
        Table.events();
        Links.events();
        PARTS = await DB.get.essentials();
    },
    display: () => DB.get('product', 'beys')
        .then(beys => Table.body.append(...beys.map(bey => new Bey(bey).row))),
    after () {
        Q('.loading').classList.remove('loading');
        Table.form.onchange();
        Filter.form.onchange();
        window.onresize();
        location.search ? Table.search(decodeURI(location.search.substring(1)).split(/\.|=/)) : FilterForm.count();
        Garage.get('acquired').then(beys => Table.select({beys}, 'acquired'));
        Garage.get('marked').then(beys => Table.select({beys}, 'marked'));
    },
    
    form: document.forms[0],
    events () {
        E(Table.form).set({
            onreset: Table.reset,
            oninput: ev => ev.target.type == 'search' && Table.search(ev.target.value),
            onchange: ev => !ev || ev.target.type == 'radio' ? Cell.fill(Table.form.lang.value) : ''
        });
        Q('thead').onclick = Table.sort;
        Q('#copy').onclick = Table.copy;
        let downtime;
        E(Table.body).set({
            onpointerdown: () => downtime = Date.now(),
            onclick: ev => !Q('#garage:checked') || ev.target.matches(':first-child') ? 
                Preview.for.table(ev) : 
                Date.now() - downtime < 500 ? Table.select({tr: ev.target.closest('tr')}) : null
        });
        PI.events({
            'td:not(:first-child)': {hold: hold => hold.for(.5).to((_, target) => Table.select({td: target}))}
        });
    },
    sort (ev) {
        let [input, index] = [ev.target.Q('input'), Q('th').indexOf(ev.target.closest('th'))];
        input.value == 'on' && (input.value = 1);
        let extract = {
            code: trs => [trs].flat().map(tr => tr.firstChild.innerText.trim()),
            abbr: trs => [trs].flat().map(tr => tr.title.split(' ')[index - 1])
        }
        Table.body.append(...[...Table.body.children].sort((...trs) => {
            let text = extract[index === 0 ? 'code' : 'abbr'](trs);
            let move = text[0].includes('/') && text[1].includes('/') ? 0 : 
                text[0].includes('/') ? 1 : text[1].includes('/') ? -1 : 
                index == 1 && (text[0].length - text[1].length) || text[0].localeCompare(text[1]);
            return move * input.value;
        }));
        (input.checked = true) && (input.value *= -1);
    },
    async search (query) {
        Filter.form.onreset();
        query[0] == 'search' && (query = query[1]) && (Q('input[type=search]').value ||= query);
        typeof query == 'string' && (query = query.trim());
        if (!query) return Table.reset();
        let {beys, href} = await new Search(query);
        [...Table.body.rows].forEach(tr => tr.classList.toggle('hidden', !beys.includes(tr)));
        Links.link(href ? query : '');
        href && history.replaceState('', '', href);
        FilterForm.count();
    },
    reset () {
        location.search && history.replaceState('', '', './');
        Q('input[type=search]').value = '';
        [...Table.body.rows].forEach(tr => tr.classList.toggle('hidden', tr.hidden = false));
        Filter.form.onreset();
        Links.div.title = '';
    },
    select ({tr, td, beys}, mode = Q('input[name=mode]:checked').value) {
        beys && new O(beys).each(([code, parts]) => {
            let tr = Table.body.Q(`tr[id='${code}']`);
            new O(parts).each(([headers, abbr]) => 
                Cell.group(tr.Q(`[headers='${headers}'][title='${abbr}']`), td => td?.classList.toggle(mode))
            );
        });
        if (!Q('#garage:checked') || (tr ?? td?.parentElement)?.id.includes('?')) return;
        if (tr) {
            tr[mode] = !(tr[mode] ?? false);
            [...tr.children].forEach((td, i) => i > 0 && td.classList.toggle(mode, tr[mode])); 
        } else {
            Cell.group(td, td => td?.classList.toggle(mode));
            tr = td.closest('tr');
        }
        Garage.put(mode, tr.id, [...tr.children].reduce((obj, td) => td.matches(`[title].${mode}`) ? {...obj, [td.headers]: td.title} : obj, {}));
    },
    copy (ev, mode = Q('input[name=mode]:checked').value) {
        let table = E('table', Q(`tr:has(.${mode})`, []).map(tr => {
            let [coat, fusedBit] = [E(tr).get('--coat'), tr.Q('[headers=bit].fused')];
            tr = tr.cloneNode(true); 
            return E(tr).set([
                E('td', /^.X$/.test(tr.classList[0]) ? tr.classList[0] : '-'),
                E('td', tr.matches('.RB') ? tr.id : tr.id.split('_')[0]), 
                ...[...tr.childNodes].slice(1).filter(td => td instanceof Text || td.headers)
                    .map(td => td instanceof Text ? fusedBit ? E('td', '⇤') : td : E(td).set({
                        innerText: Table.to.sheet(td, mode),
                        colSpan: (Table.span[td.headers] ?? 1) + (td.matches(':not([headers=bit]).fused') ? 1 : 0),
                        style: Table.coated.includes(td.headers) ? {color: coat} : {}
                    }))
            ]);
        }));
        let csv = [...table.children].map(tr => [...tr.children].flatMap(td => Table.to.csv(td)).join('\t')).join('\n');
        navigator.clipboard.write([new ClipboardItem({
            'text/html': table.outerHTML,
            'text/plain': csv
        })]).then(() => {
            let original = ev.target.innerHTML;
            ev.target.innerHTML = csv ? '&#xe014;' : '（空白）';
            setTimeout(() => ev.target.innerHTML = original, 1000);
        });
    }
});
Table.to = {
    sheet (td, mode) {
        if (!td.title) return '-';
        if (!td.classList.contains(mode)) return '(未標記)';
        let [names, i] = [td.innerText.split('⬧'), ['hk','tw'].indexOf(Storage('pref')?.lang)];
        return i >= 0 ? names[i] || names[0] : td.innerText;
    },
    csv: td => [td.innerText, ...Array((td.colSpan ?? 1) - 1).fill('⇥')]
}
Table.span = {main: 2, blade: 4};
Table.coated = ['blade', 'main', 'metal'];

const Links = {
    div: Q('.links'),
    link (query) {
        let P = PARTS.at(query);
        if (!P) return Links.div.title = '';
        let comp = Part.names[P.subcomp];
        comp.eng = comp.eng.replace(' ', '');
        let name = P.only.name() ? {
            chi: Markup.clear(P.names.chi).replace(' ', ','),
            jap: P.names.jap
        } : P.abbr.split('.').at(-1);
        Links.div.title = P.abbr;
        [
            `//beyblade.phstudy.org/?category=${comp.eng}&` + (name.chi ? `search=${name.chi}` : `view=table&spec=spec-${name}#spec-${name}`),
            'http://obakeblader.com/' + (comp.jap ? `${comp.jap}-${name.jap ?? name}/#toc2` : `?s=入手法`),
        ].forEach((href, i) => Links.div.children[i].href = href);
    },
    events () {
        Links.div.onclick = ev => ev.target.tagName == 'A' ? 
            gtag('event', 'SEARCH', {COLOR: ev.target.parentElement.title}) : '';
        new MutationObserver(([{target}]) => target.title == '' && [...target.children].forEach((a, i) => 
            a.href = ['//beyblade.phstudy.org', 'http://obakeblader.com/?s=入手法'][i]
        )).observe(Links.div, {attributeFilter: ['title']});
    }
}
const Filter = () => {
    Filter.form.append(...Filter.items.map(([main, ...rest]) =>
        new FilterForm.fieldset(main.map(([cl, {label}]) => [cl, {
            label: (label instanceof A ? label : new A(label)).push({classList: cl})
        }]), ...rest)
    ));
    Filter.events();
}
Object.assign(Filter, {
    form: document.forms[1],
    events () {
        FilterForm.event(Table.body.children, {type: 'negative', single: {line: true}}, Filter.form);
        Filter.form.onmouseover = ({target}) => target.matches('label[title]') && 
            (Q('summary i').innerText = `｛${target.innerText || target.classList}｝：${target.title}`);
    },
    items: [
        [new O({
            'S' : {label: new A('Starter', {title: '附發射器的單陀螺'})},
            'B' : {label: new A('Booster', {title: '單陀螺'})},
            'St': {label: new A('Set', {title: '至少包含兩陀螺'})},
            'SS': {label: new A('Stadium Set', {title: '含對戰盤及陀螺'})},
            'RB': {label: new A('Random Booster', {title: '單陀螺抽包'})},
            'Lm': {label: new A('', {title: '官方網站產品頁未有收錄'})}
        }), {name: 'type'}],
        [new O({
            'S H' : {label: 'Starter'},
            'B H' : {label: 'Booster'},
            'St H': {label: 'Set'},
            'SS H': {label: 'Stadium Set'},
            'RB H': {label: 'Random Booster'},
            'Lm H': {label: ''}
        }), {name: 'type', legend: '\ue02a 異色版／再推出版'}],
        [new O({
            '¬': {label: E('img', {src: `../img/bit/B.png`})}}, 
            LINES.map(([line, {title}]) => 
                [line, {label: new A(E('img', {src: `../img/lines.svg#${line}`}), {title})}]
            )
        ), {name: 'line', legend: ['\ue02b LINE', E('button.text', {type: 'button'}, '全部')]}]
    ]
});
export default Table