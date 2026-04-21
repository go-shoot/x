import DB from '../include/DB.js'
import { Part, Cell } from '../parts/part.js';
import { Bey, Preview, Search } from '../parts/bey.js';
import { FilterForm, Markup } from '../include/utilities.js';

let META, PARTS;

const Table = () => Table.before().then(Table.display).then(Table.after);
Object.assign(Table, {
    body: Q('tbody'),
    async before () {
        Filter();
        Table.events();
        [META, PARTS] = await DB.get.essentials();
        Part.import(META = META.general, PARTS);
    },
    display: () => DB.get('product', 'beys')
        .then(beys => Table.body.append(...beys.map(bey => new Bey(bey).row))),
    after () {
        Q('.loading').classList.remove('loading');
        Table.form.onchange();
        Filter.form.onchange();
        window.onresize();
        location.search ? Table.search(decodeURI(location.search.substring(1)).split(/\.|=/)) : FilterForm.count();
    },
    
    form: document.forms[0],
    events () {
        E(Table.form).set({
            onkeydown: ev => ev.key != 'Enter',
            onreset: Table.reset,
            onchange: ev => (!ev || ev.target.type == 'radio') && Cell.fill(Table.form.lang.value),
            oninput: ev => {
                if (ev.target.type != 'search') return;
                clearTimeout(Table.timer);
                Table.timer = setTimeout(() => Table.search(ev.target.value), 500);
            }
        });
        Table.body.onclick = Preview.for.table;
        Q('thead').onclick = Table.sort;

        Q('.links').onclick = ({target: {tagName, href, parentElement}}) => tagName == 'A' ? 
            gtag('event', `LINK-${href.includes('obake') ? 'OB' : 'PH'}-${parentElement.title}`) : '';
        new MutationObserver(([{target}]) => target.title == '' && [...target.children].forEach((a, i) => 
            a.href = ['//beyblade.phstudy.org', 'http://obakeblader.com/?s=入手法'][i]
        )).observe(Q('.links'), {attributeFilter: ['title']});
    },
    sort (ev) {
        let input = ev.target.Q('input');
        input.value == 'on' && (input.value = 1);
        let index = Q('th').indexOf(ev.target.closest('th'));
        let extract = {
            code: tr => Array.isArray(tr) ? tr.map(extract.code) : tr.firstChild.innerText.trim(),
            abbr: tr => Array.isArray(tr) ? tr.map(extract.abbr) : tr.dataset.abbr.split(' ')[index - 1]
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
    reset () {
        location.search && history.replaceState('', '', './');
        Q('input[type=search]').value = '';
        [...Table.body.rows].forEach(tr => tr.classList.toggle('hidden', tr.hidden = false));
        Filter.form.onreset();
        Q('.links').title = '';
    },
    async search (search) {
        Filter.form.onreset();
        search[0] == 'search' && (search = search[1]) && (Q('input[type=search]').value ||= search);
        typeof search == 'string' && (search = search.trim());
        if (!search) return Table.reset();
        let {beys, href} = await new Search(search);
        [...Table.body.rows].forEach(tr => tr.classList.toggle('hidden', !beys.includes(tr)));
        Table.links(href ? search : '');
        href && history.replaceState('', '', href);
        FilterForm.count();
    },
    async links (query) {
        let target = PARTS.at(query);
        if (!target) return Q('.links').title = '';
        let comp = {
            eng: target.path[2] ? 
                (await DB.get('meta', 'parts')).blade[target.line].title[target.path[2]].match(/[ \w]+$/)[0].replace(' ', '') :
                target.path[0][0].toUpperCase() + target.path[0].substring(1),
            jap: target.path[2] != 'chip' && META.jap.at(target.path.slice(0, -1))._
        };
        comp.eng == 'MetalBlade' && (comp.eng = 'MainBlade');
        let name = target.only.name() ? {
            chi: Markup.remove(target.names.chi).replace(' ', ','),
            jap: target.names.jap
        } : target.abbr.split('.').at(-1);
        Q('.links').title = target.abbr;
        Q('a[href*=obake]').href = 'http://obakeblader.com/' + (comp.jap ? `${comp.jap}-${name.jap ?? name}/#toc2` : `?s=入手法`);
        Q('a[href*=phstudy]').href = `//beyblade.phstudy.org/?category=${comp.eng}&` + (name.chi ? `search=${name.chi}` : `view=table&spec=spec-${name}#spec-${name}`);
    }
});

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
            new O(LINES).map(([line, {title}]) => 
                [line, {label: new A(E('img', {src: `../img/lines.svg#${line}`}), {title})}]
            )
        ), {name: 'line', legend: ['\ue02b LINE', E('span', '\ue010 全部 \ue00f')]}]
    ]
});

export default Table