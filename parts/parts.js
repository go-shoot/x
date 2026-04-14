import DB from '../include/DB.js'
import { Part } from '../parts/part.js';
import { Glossary, FilterForm, Transition } from '../include/utilities.js';

let META, PARTS;
let [COMP, LINE] = [...new URLSearchParams(location.search)][0] ?? [];

const Parts = () => Parts.firstly().then(Parts.before).then(Parts.display).then(Parts.after).then(Parts.finally);
Object.assign(Parts, {
    async firstly () {
        gtag('event', LINE || COMP.toUpperCase());
        Parts.place = Q('section');
        Magnifier();
        [META, PARTS] = await DB.get.essentials(true);
        Part.import(META.general, PARTS);
        Object.assign(Sorter, {...META[COMP].sorter ?? {}});
        Object.assign(Filter, {
            legend: META[COMP].所有 ? '所有' : '一體',
            types: META.general.types,
            ...{...META[COMP]}.filter ?? {}
        });
        META = META[COMP][LINE || Filter.legend];
        Object.assign(Filter, {...META.filter});
    },
    before: () => Promise.all([Filter(), Sorter()]),
    display: () => Promise.all([...
            LINE ? PARTS.blade[LINE].flatMap(([_, subs]) => [...subs.values()]) : PARTS[COMP].values()
        ].map(part => part.tile?.())
    ).then(parts => Parts.place.replaceChildren(...parts.filter(p => p))),

    async after () {
        let hash = decodeURI(location.hash.substring(1));
        Parts.switch(hash && Q(`x-part[id='${hash}']`) || hash);
        Sorter.checked == 'time' ? await Sorter.time.order(COMP) : Sorter.time.order(COMP);
        Sorter.sort(Sorter.checked);
        Filter.form.onchange();
    },
    finally: () => Q('.loading').classList.remove('loading'),
    
    switch (groupORpart) {
        let [group, part] = typeof groupORpart == 'string' ? [groupORpart] : [, groupORpart.Part];
        group ??= part.classes || part.path[2] || part.group;
        group && Q(`#group input`, input => input.checked = input.value == `.${group}`);
        group ||= Q('#group input:checked').value?.substring(1);
        Parts.info(group);
        typeof groupORpart == 'object' && Parts.focus(groupORpart);
        Glossary(Parts.place);
    },
    info (group) {
        document.title = document.title.replace(/^.*?(?= ■ )/, META.title?.[group] ?? META.title ?? '');
        let info = COMP + (LINE ? `.${LINE}` : '');
        Q('details').hidden = !(Q('details p').innerHTML = Q(`[id='${info}']`)?.innerHTML);
    },
    focus (tile) {
        Q('.target')?.classList.remove('target');
        tile.classList.add('target');
        setTimeout(() => tile.scrollIntoView(), 500);
    }
});
onhashchange = () => Parts.after();

const Filter = function(which) {
    if (this instanceof Filter) 
        return new FilterForm.fieldset(...Filter.content[which](), {name: which});
    Filter.form.classList.add(COMP);
    Filter.form.append(...['group', ...Filter.use ?? []].map(f => new Filter(f)));
    Filter.events();
};
Object.assign(Filter, {
    form: document.forms[0],
    events () {
        FilterForm.event(Parts.place.children, {
            legend: {group: {click: Filter.multi}},
            action: {group: ev => {
                history.replaceState(null, '', ' '); //remove #
                Parts.switch(ev.target.value.substring(1));
            }},
            single: true
        });
    },
    content: {
        group:  () => [new O(Filter.groups), {legend: LINE || Filter.legend, checked: false}],
        joint:  () => [new O(['normal', 'simple'].map(t => [t, E('img', {src: `../img/joint.svg#${t}`})] )), {legend: '類型'}],
        type:   () => [new O(Filter.types.map(t => [t, E('img', {src: `../img/types.svg#${t}`})] )), {legend: '類型', negate: true}],
        spin:   () => [new O({left: '\ue01d', right: '\ue01e'}), {legend: '迴轉'}],
        prefix: () => [new O({'¬': '–', ...Filter.variety}), {legend: '變化'}],
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
        new ResizeObserver(Magnifier.switch).observe(Q('nav'));
    },
    switch: () => E(Parts.place).set({'--font': (innerWidth > 630 ? Q('continuous-knob') : Q('[name=mag]:checked')).value})
});

const Sorter = () => {
    Q('nav').append(new FilterForm.fieldset(new O((Sorter.use ??= ['name','time','weight']).map(by => [by, Sorter.icons[by]])), {legend: '排序'}));
    Sorter.events();
    let checked = Q(`#${Storage('pref')?.sort || 'name'},#${Sorter.use[2]}`, [])[0];
    checked.checked = true;
    Sorter.checked = checked.id;
}
Object.assign(Sorter, {
    sort: by => Parts.place.append(...[...Parts.place.children].sort((a, b) => Sorter.by[by](a.Part, b.Part))),
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

        weight: (p, q) => Sorter.compare(q, p, p => (w => parseInt(w) + Sorter.weight.adjust[w.at(-1)])(p.stat[0] || '0=')),
        height: (p, q) => parseInt(p.stat[3] || 999) - parseInt(q.stat[3] || 999),
        time: (p, q) => (q.order ?? 999) - (p.order ?? 999)
    },
    index: {
        whole: {blade: 0, ratchet: 1, bit: 2},
        blade: {chip: 0, main: 1, metal: 1, over: 2, assist: -1}
    },
    icons: {name: '\ue034', time: '\ue035', weight: '\ue036', height: '\ue047'}
});
Sorter.time = {
    order: comp => DB.get('product', 'beys').then(beys => {
        let setOrder = (list, path) => [...new Set(list)].forEach((abbr, i) => 
            abbr && PARTS.at([...path, abbr])?.push({order: i})
        );
        let list = beys.reverse().map(bey => bey[2].split(' ')[Sorter.index.whole[comp]]);            
        if (!LINE)
            return setOrder(list.flat(), [comp]);

        list = list.map(blade => blade.split('.'));
        new O(Sorter.index.blade).each(([sub, index]) => 
            setOrder(list
                .filter(blade => ['chip','assist'].includes(sub) || blade.length == (sub == 'main' ? 3 : 4))
                .map(blade => blade.at(index)), 
            [comp, LINE, sub])
        );
    })
}
Sorter.weight = {adjust: {'+': .2, '=': 0, '-': -.2}};
export default Parts
