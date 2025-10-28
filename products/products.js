import DB from '../include/DB.js'
import { Part, Tile, Cell } from '../include/part.js';
import { Bey, Preview, Search } from '../include/bey.js';

let META, PARTS;

const Table = () => Table.before().then(Table.display).then(Table.after);
Object.assign(Table, {
    count: () => Q('output').value = Q('tbody tr:not(.hidden):not([hidden])', []).length,
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
        location.search && Table.filter(decodeURI(location.search.substring(1)).split(/-(?=.+\=)|=/));
    },
    
    events () {
        E(Q('nav form')).set({
            onkeydown: ev => ev.key != 'Enter',
            onreset: ev => ev.preventDefault() || Table.reset(),
            onchange: ev => ev.target.type == 'radio' && Cell.fill(ev.target.id) || '',
            oninput: ev => {
                if (ev.target.type != 'search') return;
                clearTimeout(Table.timer);
                Table.timer = setTimeout(() => Table.filter(ev.target.value), 500);
            }
        });
        Q('tbody').onclick = Preview.for.table;
        new MutationObserver(Table.count).observe(Q('tbody'), {childList: true, subtree: true, attributeFilter: ['hidden', 'class']});
    },
    reset () {
        location.search && history.replaceState('', '', './');
        Q('input[type=search]').value = '';
        Q('tbody tr', tr => tr.classList.toggle('hidden', tr.hidden = false));
        Filter.reset();
        Q('a[href*=obake]').href = 'http://obakeblader.com/?s=入手法';
        Q('a[href*=kyoganken]').href = '//kyoganken.web.fc2.com/beyx/#parts1';
    },
    async filter (search) {
        search[0] == 'search' && (search = search[1]);
        typeof search == 'string' && (search = search.trim());
        if (!search) return Table.reset();
        Q('tbody tr', tr => tr.hidden = true);
        await new Search(search).then(({beys, href}) => {
            beys.forEach(tr => tr.hidden = false);
            href && setTimeout(() => Table.links(search)) && history.replaceState('', '', `?${href}`);
        });
    },
    links (query) {
        let target = PARTS.at(query);
        if (!target) return;
        let comp = target.path[2] != 'motif' && META.jap.at(target.path.slice(0, -1))._;
        let name = Tile.named(target.path) ? target.names.jap : target.abbr;
        Q('a[href*=obake]').href = 'http://obakeblader.com/' + (comp && Q('output').value > 1 ? `${comp}-${name}/#toc2` : `?s=入手法`);
        Q('a[href*=kyoganken]').href = `//kyoganken.web.fc2.com/beyx/color0${['blade', 'ratchet', 'bit'].indexOf(target.path[0]) + 1}.htm`;
    }
});

const Filter = () => {
    Q('#filter label', label => label.append(E('input', {value: `.${label.className.replaceAll(' ', '.')}`, type: 'checkbox'})));
    [Filter.inputs, Filter.systems] = [Q('#filter input'), Q('.system input')];
    Filter.reset();
    Filter.events();
}
Object.assign(Filter, {
    filter () {
        let hide = this.inputs.filter(i => !i.checked).map(i => i.value);
        Q('tbody tr').forEach(tr => tr.classList.toggle('hidden',
            hide.length && tr.matches(hide) || this.systems.some(i => !i.checked) && tr.matches('[data-abbr^="/"]'))
        );
        Table.count();
    },
    events () {
        E(Q('#filter')).set({
            onclick: ev => ev.target.tagName == 'BUTTON' && 
                this.systems.forEach(i => !i.checked && i.dispatchEvent(new InputEvent('change', {bubbles: true}))) || '',
            onchange: ev => {
                ev.target.value.endsWith('X') && this.systems.forEach(i => i.checked = !ev.isTrusted || ev.target == i);
                this.filter();
            },
            onmouseover: ({target}) => target.matches('label[title]') && 
                (Q('#filter summary i').innerText = `｛${target.innerText || target.classList}｝：${target.title}`)
        });
    },
    reset: () => Filter.inputs.forEach(input => input.checked = true)
});

export default Table