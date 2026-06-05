import DB from '../include/DB.js'
import { Bey } from '../parts/bey.js';
import { Part } from '../parts/part.js';
import { FilterForm, Transition } from '../include/utilities.js';

let PARTS, PATH = ([...new URLSearchParams(location.search)][0] ?? []).filter(_ => _);

const Catalog = () => Catalog.firstly().then(Catalog.before).then(Catalog.display).then(Catalog.after).then(Catalog.finally);
Object.assign(Catalog, {
    place: Q('section'),
    async firstly () {
        gtag('event', PATH[1] || PATH[0].toUpperCase());
        Magnifier();
        PARTS = Part.import(...await DB.get.essentials({drop: false})).parts;
        let meta = JSON.parse(Q(`[title=${PATH[0]}]`).innerText);
        Filter.legend = meta.所有 ? '所有' : '一體';
        Object.assign(Filter, meta.filter, meta[PATH[1] || Filter.legend].filter);
        Object.assign(Sorter, meta.sorter);
    },
    before: () => Promise.all([Filter(), Sorter()]),
    display: () => Promise.all(
        [...PARTS.at(PATH).flatMap(([_, inner]) => inner instanceof Part ? inner : [...inner.values()])]
        .map(P => P.tile?.())
    ).then(tiles => Catalog.place.replaceChildren(...tiles.filter(t => t))),

    async after () {
        Catalog.switch();
        Sorter.checked == 'time' ? await Sorter.time.order(PATH[0]) : Sorter.time.order(PATH[0]);
        Sorter.sort(Sorter.checked);
    },
    finally: () => Catalog.place.classList.remove('loading'),
    
    switch (what) { // #part #group .group _
        what = decodeURI((what || location.hash).substring(1));
        let tile = Q(`x-part[id='${what}']`);
        let group = tile ? tile.Part.path[2] || tile.Part.group : what;
        group && Q(`#group input`, input => input.checked = input.value == `.${group}`);
        Filter.form.onchange();
        Catalog.info(group || Q('#group input:checked').value?.substring(1));
        tile && Catalog.focus(tile);
    },
    info (group) {
        document.title = document.title.replace(/^.*?(?= 🙼 )/, (PATH[1] ? `〖${PATH[1]}〗` : '') 
            + Object.values(Part.names[group] || (PATH[1] ? {_: '未出'} : Part.names[PATH[0]])).join(' ⬧ ').replace(' ', ' ⬧ '));
        Q('details p', p => p.hidden = p.id != (PATH[1] || PATH[0]));
    },
    focus (tile) {
        Q('.target')?.classList.remove('target');
        tile.classList.add('target');
        setTimeout(() => tile.scrollIntoView(), 500);
    }
});
onhashchange = () => Catalog.switch();

const Filter = function(which) {
    if (this instanceof Filter) 
        return new FilterForm.fieldset(...Filter.content[which](), {name: which});
    Filter.form.classList.add(PATH[0]);
    Filter.form.append(...['group', ...Filter.use ?? []].map(f => new Filter(f)));
    Filter.events();
};
Object.assign(Filter, {
    form: document.forms[0],
    events () {
        FilterForm.event(Catalog.place.children, {
            legend: {group: {click: Filter.multi}},
            action: {group: ev => {
                history.replaceState(null, '', ' '); //remove #
                Catalog.switch(ev.target.value);
            }},
            single: true
        });
    },
    content: {
        group:  () => [new O(Filter.groups), {legend: PATH[1] || Filter.legend, checked: false}],
        joint:  () => [new O(['normal', 'simple'].map(t => [t, E('img', {src: `../img/joint.svg#${t}`})] )), {legend: '類型'}],
        type:   () => [new O(Part.types.map(t => [t, E('img', {src: `../img/types.svg#${t}`})] )), {legend: '類型', negate: true}],
        spin:   () => [new O({left: '\ue01d', right: '\ue01e'}), {legend: '迴轉'}],
        prefix: () => [new O({'¬': '–', ...Filter.variety}), {legend: '變化'}],
    }
});

const Magnifier = () => {
    Q('.magnifier').append(
        E('continuous-knob', {min: .75, max: 2, value: Storage('pref')?.knob || 1}, E('i.center', '')),
        ...E.radios([.54, .81, 1.6].map((value, i) => ({id: `mag${i}`, name: 'mag', value}) ))
    );
    Q(`#${Storage('pref')?.button || 'mag1'}`).click();
    Magnifier.events();
};
Object.assign(Magnifier, {
    events () {
        Q('.magnifier').oninput = ({target}) => {
            if (innerWidth <= 630 && target.tagName != 'INPUT') return;
            E(Catalog.place).set({'--font': target.value});
            Storage('pref', target.tagName == 'INPUT' ? {button: target.id} : {knob: target.value});
        }
        new ResizeObserver(Magnifier.switch).observe(Q('nav'));
    },
    switch: () => E(Catalog.place).set({'--font': Q(innerWidth > 630 ? 'continuous-knob' : '[name=mag]:checked').value})
});

const Sorter = () => {
    Sorter.use ??= ['name','time','weight'];
    Q('nav').append(new FilterForm.fieldset(new O(Sorter.use.map(by => [by, Sorter.icons[by]])), {legend: '排序'}));
    Sorter.events();
    let input = Q(`#${Storage('pref')?.sort || 'name'},#${Sorter.use[2]}`, [])[0];
    [Sorter.checked, input.checked] = [input.id, true];
}
Object.assign(Sorter, {
    sort: by => Catalog.place.append(...[...Catalog.place.children].sort((a, b) => Sorter.by[by](a.Part, b.Part))),
    events: () => Q('.sorter').onchange = ({target: input}) => {
        Transition.allow.for(() => Sorter.sort(input.id));
        input.checked && Storage('pref', {sort: input.id});
    },
    compare: (u, v, f = p => p) => +(f(u) > f(v)) || -(f(u) < f(v)),
    by: {
        name: (p, q) =>
            [p.group, q.group].includes('remake') && Sorter.compare(p, q, p => p.group)
            || Sorter.compare(p, q, p => parseInt(p.abbr))
            || Sorter.compare(p, q, p => p.abbr.toLowerCase()),

        weight: (p, q) => Sorter.compare(q, p, p => p.weight),
        height: (p, q) => parseInt(p.stat[3] || 999) - parseInt(q.stat[3] || 999),
        time: (p, q) => (q.order ?? 999) - (p.order ?? 999)
    },
    icons: {name: '\ue034', time: '\ue035', weight: '\ue036', height: '\ue047'}
});
Sorter.time = {
    order: comp => DB.get('product', 'beys').then(beys => {
        let setOrder = (list, path) => [...new Set(list)].forEach((abbr, i) => 
            abbr && PARTS.at([...path, abbr])?.push({order: i})
        );
        let list = beys.reverse().map(bey => bey[2].split(' ')[Bey.comps.indexOf(comp)]); 
        if (!PATH[1])
            return setOrder(list.flat().filter(abbr => !abbr.includes('.')), PATH);

        list = list.map(comp => comp.split('.')).filter(comp => comp.length > 1);
        Array.prototype.on ??= function(d) {
            if (Number.isInteger(d)) return this.at(d);
            const i = d * this.length;
            return this[Math.abs(i - Math.round(i)) < 0.01 ? Math.round(i) : i];
        }   
        new O(Part[PATH[0]].sub[PATH[1]].index).each(([sub, index]) => 
            setOrder(list.map(comp => comp.on(index)), [...PATH, sub])
        );
    })
}
export default Catalog
