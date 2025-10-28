import DB from '../include/DB.js'
import { Part, Tile, Cell } from '../include/part.js';
import { Bey, Preview, Search } from '../include/bey.js';
import { FilterForm } from '../include/utilities.js';

let META, PARTS;

const Table = () => Table.before().then(Table.display).then(Table.after);
Object.assign(Table, {
    async before () {
        Filter();
        Table.events();
        [META, PARTS] = await DB.get.essentials();
        Part.import(META = META.general, PARTS);
    },
    display: () => DB.get('product', 'beys').then(beys => Q('tbody').append(...beys.map(bey => new Bey(bey)))),
    after () {
        Q('.loading').classList.remove('loading');
        Q('#chi').click();
        $(Q('table')).tablesorter();
        location.search ? Table.search(decodeURI(location.search.substring(1)).split(/-(?=.+\=)|=/)) : FilterForm.count();
    },
    
    events () {
        E(Q('nav form')).set({
            onkeydown: ev => ev.key != 'Enter',
            onreset: ev => ev.preventDefault() || Table.reset(),
            onchange: ev => ev.target.type == 'radio' && Cell.fill(ev.target.id) || '',
            oninput: ev => {
                if (ev.target.type != 'search') return;
                clearTimeout(Table.timer);
                Table.timer = setTimeout(() => Table.search(ev.target.value), 500);
            }
        });
        Q('tbody').onclick = Preview.for.table;
    },
    reset () {
        location.search && history.replaceState('', '', './');
        Q('input[type=search]').value = '';
        Q('tbody tr', tr => tr.classList.toggle('hidden', tr.hidden = false));
        Filter.form.onreset();
        Q('a[href*=obake]').href = 'http://obakeblader.com/?s=入手法';
        Q('a[href*=kyoganken]').href = '//kyoganken.web.fc2.com/beyx/#parts1';
    },
    async search (search) {
        Filter.form.onreset();
        search[0] == 'search' && (search = search[1]);
        typeof search == 'string' && (search = search.trim());
        if (!search) return Table.reset();
        Q('tbody tr', tr => tr.classList.add('hidden'));
        await new Search(search).then(({beys, href}) => {
            beys.forEach(tr => tr.classList.remove('hidden'));
            href && setTimeout(() => Table.links(search)) && history.replaceState('', '', `?${href}`);
        });
        FilterForm.count();
    },
    links (query) {
        let target = PARTS.at(query);
        if (!target) return;
        let comp = target.path[2] != 'motif' && META.jap.at(target.path.slice(0, -1))._;
        let name = Tile.named(target.path) ? target.names.jap : target.abbr;
        Q('a[href*=obake]').href = 'http://obakeblader.com/' + (comp && Q('output').value > 1 ? `${comp}-${name}/#toc2` : `?s=入手法`);
        Q('a[href*=kyoganken]').href = `//kyoganken.web.fc2.com/beyx/color0${['', 'blade', 'ratchet', 'bit'].indexOf(target.path[0])}.htm`;
    }
});

const Filter = () => {
    Filter.form.append(...Filter.items.map(([main, ...rest]) =>
        new FilterForm.fieldset(main.map(([cl, {label}]) => [cl, {label: label.push({classList: cl.match(/\w+/)[0]})}]), ...rest)
    ));
    Filter.events();
}
Object.assign(Filter, {
    form: document.forms[1],
    events () {
        FilterForm.event(Q('tbody').children, {single: {line: true}}, Filter.form);
        Filter.form.onmouseover = ({target}) => target.matches('label[title]') && 
            (Q('summary i').innerText = `｛${target.innerText || target.classList}｝：${target.title}`);
    },
    items: [
        [new O({
            'S:not(H)' : {label: new A('Starter', {title: '附發射器的單陀螺'})},
            'B:not(H)' : {label: new A('Booster', {title: '單陀螺'})},
            'St:not(H)': {label: new A('Set', {title: '至少包含兩陀螺'})},
            'SS:not(H)': {label: new A('Stadium Set', {title: '含對戰盤及陀螺'})},
            'RB:not(H)': {label: new A('Random Booster', {title: '單陀螺抽包'})}
        }), {name: 'type'}],
        [new O({
            'S H' : {label: new A('Starter')},
            'B H' : {label: new A('Booster')},
            'St H': {label: new A('Set')},
            'SS H': {label: new A('Stadium Set')},
            'RB H': {label: new A('Random Booster')}
        }), {name: 'type', legend: '\ue02a 異色版／再推出版'}],
        [new O({ 
            CX: {label: new A(E('img', {src: `../img/lines.svg#CX`}), {title: 'Custom Line'})},
            UX: {label: new A(E('img', {src: `../img/lines.svg#UX`}), {title: 'Unique Line'})},
            BX: {label: new A(E('img', {src: `../img/lines.svg#BX`}), {title: 'Basic Line'})},
        }), {name: 'line', legend: ['\ue02b LINE', E('span', '\ue010 全部 \ue00f')]}]
    ]
});

export default Table