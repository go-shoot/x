import DB from '../include/DB.js'
import { Part } from '../include/part.js';
import { Glossary, Markup, FilterForm } from '../include/utilities.js';

let META, PARTS;
let [comp, line] = [...new URLSearchParams(location.search)][0] ?? [];

const Parts = () => Parts.firstly().then(Parts.before).then(Parts.display).then(Parts.after).then(Parts.finally);
Object.assign(Parts, {
    async firstly () {
        [META, PARTS] = await DB.get.essentials();
        Part.import(META.general, PARTS);
        line ||= META.grouped[comp].所有 ? '所有' : '一體';
        META = {
            types: META.general.types, 
            filters: META.grouped[comp].filters, 
            ...META.grouped[comp][line]
        };
        Parts.place = Q('section');
        Magnifier();
    },
    before: () => [Filter(), Sorter()],
    display: () => DB.get.parts(/^.X$/.test(line) ? line : comp)
        .then(parts => Promise.all(parts.map(json => new Part(json).tile())))
        .then(parts => Parts.place.replaceChildren(...parts)),

    after () {
        let hash = decodeURI(location.hash.substring(1));
        Parts.switch(hash && Q(`x-part[id='${hash}']`) || hash);
        Q(`#${Storage('pref')?.sort || 'name'}`).click();
    },
    finally: () => Q('.loading').classList.remove('loading'),
    
    switch (groupORpart) {
        let [group, part] = typeof groupORpart == 'string' ? [groupORpart] : [, groupORpart.Part];
        group ??= part.path[2] ?? part.group;
        group && Q(`#group input`, input => input.checked = input.value == `.${group}`);
        group ||= Q('#group input:checked').value?.substring(1);
        FilterForm.trigger();
        Parts.info(group);
        typeof groupORpart == 'object' && Parts.focus(groupORpart);
        Glossary(Parts.place);
    },
    info (group) {
        document.title = document.title.replace(/^.*?(?= ■ )/, META.title?.[group] ?? META.title ?? '');
        let info = comp + (/^\w+$/.test(line) ? `.${line}` : '');
        Q('details').hidden = !(Q('details p').innerHTML = Markup.spacing(Q(`[id='${info}']`)?.innerHTML));
    },
    focus (tile) {
        Q('.target')?.classList.remove('target');
        tile.classList.add('target');
        setTimeout(() => tile.scrollIntoView(), 500);
    }
});
onhashchange = () => Parts.after();

const Filter = function(type) {
    if (this instanceof Filter) 
        return new FilterForm.fieldset(...Filter.content[type](), {name: type});
    document.forms[0].classList.add(comp);
    document.forms[0].append(...['group', ...META.filters ?? []].map(f => new Filter(f)));
    Filter.events();
};
Object.assign(Filter, {
    events () {
        FilterForm.event(Parts.place.children, {
            legend: {group: {click: META.multiple}},
            single: true
        });
        FilterForm.actions.group = ev => Parts.switch(ev.target.value.substring(1));
    },
    content: {
        group:  () => [new O(META.group), {legend: line, checked: false}],
        type:   () => [new O(META.types.map(t => [t, E('img', {src: `../img/types.svg#${t}`})] )), {legend: '類型', negate: true}],
        spin:   () => [new O({left: '\ue01d', right: '\ue01e'}), {legend: '迴轉'}],
        prefix: () => [new O({'¬': '–', ...META.variety}), {legend: '變化'}],
    }
});

const Magnifier = () => {
    Q('nav').append(E(`div.magnifier`, [
        E('continuous-knob', {min: .75, max: 2, value: Storage('pref')?.knob || 1}, E('i.center', '')),
        ...E.radios([.54, .81, 1.6].map((value, i) => ({id: `mag${i}`, name: 'mag', value}) ))
    ]));
    Q(`#${Storage('pref')?.button || 'mag1'}`).checked = true;
    Magnifier.events();
};
Object.assign(Magnifier, {
    events () {
        Q('.magnifier').oninput = ({target}) => {
            E(Parts.place).set({'--font': target.value});
            Storage('pref', target instanceof HTMLInputElement ? {button: target.id} : {knob: target.value});
        }
        setTimeout(onresize = Magnifier.switch);
    },
    switch: () => E(Parts.place).set({'--font': (innerWidth > 630 ? Q('continuous-knob') : Q('[name=mag]:checked')).value})
});

const Sorter = () => {
    Q('nav').append(new FilterForm.fieldset(Sorter.icons, {legend: '排序'}));
    Sorter.events();
    Sorter.getSchedule(comp);
}
Object.assign(Sorter, {
    events: () => Q('.sorter').onchange = ({target: input}) => {
        let sorted = [...Parts.place.children].map(tile => tile.Part).sort(Sorter.functions[input.id]);
        Parts.place.append(...[...Parts.place.children].sort((a, b) => sorted.indexOf(a.Part) - sorted.indexOf(b.Part)));
        input.checked && Storage('pref', {sort: input.id});
    },
    compare: (u, v, f = p => p) => +(f(u) > f(v)) || -(f(u) < f(v)),
    functions: {
        name: (p, q) =>
            [p.group, q.group].includes('remake') && Sorter.compare(p, q, p => p.group)
            || Sorter.compare(p, q, p => parseInt(p.abbr))
            || Sorter.compare(p, q, p => p.abbr.toLowerCase()),

        weight: (p, q) => Sorter.compare(q, p, p => (w => parseInt(w) + Sorter.weight[w.at(-1)])(p.stat[0] || '0=')),
        
        time: (p, q) => Sorter.compare(p, q, p =>
            Sorter.getSchedule()[Sorter.index.blade[p.group] ?? 0].findIndex(abbr => abbr == p.abbr) * -1
        )
    },
    getSchedule: comp => Sorter.schedule ?? DB.get('product', 'beys')
        .then(beys => beys.reverse()
            .map(bey => bey[2].split(' ')[Sorter.index.full[comp]]?.split('.'))
            .filter(subs => subs?.length === (/.X$/.test(line) ? 3 : 1))
        ).then(list => Sorter.schedule = list[0].map((_, i) => [...new Set(list.map(row => row[i]))] )),
    index: {
        full: {blade: 0, ratchet: 1, bit: 2},
        blade: {motif: 0, upper: 1, lower: 2}
    },
    weight: {'+': .2, '=': 0, '-': -.2},
    icons: new O({name: '\ue034', weight: '\ue036', time: '\ue035'})
});
export default Parts
