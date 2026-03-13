import DB from '../include/DB.js'
import { Part, Cell } from '../parts/part.js';
import { Bey, Preview, Search } from '../parts/bey.js';
import { FilterForm } from '../include/utilities.js';

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
    display: () => DB.get('product', 'beys').then(beys => Table.body.append(...beys.map(bey => new Bey(bey)))),
    after () {
        Q('.loading').classList.remove('loading');
        $(Q('table')).tablesorter();
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
    },
    reset () {
        location.search && history.replaceState('', '', './');
        Q('input[type=search]').value = '';
        [...Table.body.rows].forEach(tr => tr.classList.toggle('hidden', tr.hidden = false));
        Filter.form.onreset();
        Q('a[href*=obake]').href = 'http://obakeblader.com/?s=入手法';
        Q('a[href*=kyoganken]').href = '//kyoganken.web.fc2.com/beyx/#parts1';
    },
    async search (search) {
        Filter.form.onreset();
        search[0] == 'search' && (search = search[1]) && (Q('input[type=search]').value ||= search);
        typeof search == 'string' && (search = search.trim());
        if (!search) return Table.reset();
        let {beys, href} = await new Search(search);
        [...Table.body.rows].forEach(tr => tr.classList.toggle('hidden', !beys.includes(tr)));
        href && setTimeout(() => Table.links(search)) && history.replaceState('', '', href);
        FilterForm.count();
    },
    links (query) {
        let target = PARTS.at(query);
        if (!target) return;
        let comp = target.path[2] != 'chip' && META.jap.at(target.path.slice(0, -1))._;
        let name = target.only.name() ? target.names.jap : target.abbr.split('.').at(-1);
        Q('a[href*=obake]').href = 'http://obakeblader.com/' + (comp && Filter.form.count.value > 1 ? `${comp}-${name}/#toc2` : `?s=入手法`);
        Q('a[href*=kyoganken]').href = `//kyoganken.web.fc2.com/beyx/color0${['', 'blade', 'ratchet', 'bit'].indexOf(target.path[0])}.htm`;
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
            'Lm': {label: new A('', {title: '官方網站商品頁未有收錄'})}
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