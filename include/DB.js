import { Part } from "../parts/part.js";
import { Glossary } from "./utilities.js";

const DB = (plugins = {}) => Object.assign(DB, {indicator: new DB.indicator, plugins});
Object.assign(DB, {
    outdate: 'V', current: 'X',
    replace: (before = DB.outdate, after = DB.current) => indexedDB.databases()
        .then(dbs => dbs.find(db => db.name == before) && DB.open(before).then(DB.discard))
        .then(() => DB.open(after))
    ,
    discard: handler => DB.transfer.out()
        .then(() => new Promise(res => {
            DB.db.close();
            Object.assign(indexedDB.deleteDatabase(DB.db.name), {        
                onsuccess: () => res(DB.db = null),
                onblocked: handler ?? console.error
            });
        }))
    ,
    transfer: {
        out: () => DB.get.all('user').then(data => sessionStorage.user = JSON.stringify(data)).catch(() => {}),
        in: () => DB.put('user', JSON.parse(sessionStorage.user ?? '[]').map((item, i) => ({[`sheet-${i+1}`] : item})))
    },
    stores: [
        'bit', 'ratchet', 'blade',
        ...[...new O(LINES)].filter(([_, {divided}]) => divided).flatMap(([line]) => `blade-${line}`)
    ],
    open: (name = DB.current) => name == DB.db?.name ? Promise.resolve(DB.db) : 
        new Promise(res => indexedDB.open(name).onsuccess = res)
        .then(ev => {
            DB.db = ev.target.result;
            if (DB.db.name != DB.current) return;
            let missing = DB.stores.filter(s => ![...DB.db.objectStoreNames].includes(s.toUpperCase()));
            if (!missing.length)
                return Promise.resolve(ev);
            DB.db.close();
            let ver = (DB.db.version || 0) + 1;
            return new Promise(res => Object.assign(indexedDB.open(DB.db.name, ver), {onsuccess: res, onupgradeneeded: res}));
        }).then(ev => {
            DB.db = ev.target.result;
            let [index, fresh] = [location.pathname == '/x/', ev.type != 'success'];
            return (fresh ? DB.setup(ev).then(DB.transfer.in) : Promise.resolve()).then(() => DB.fetch.updates({fresh, index}));
        }).then(DB.cache)
        .catch(er => `${er}`.includes('Failed to fetch') ? DB.indicator.classList = 'offline' : console.error(er))
        .then(() => DB.plugins.followup?.())
    ,
    setup (ev) {
        ['product','meta','user'].forEach(s => DB.db.objectStoreNames.contains(s) || DB.db.createObjectStore(s));
        DB.stores.map(s => DB.db.objectStoreNames.contains(s.toUpperCase()) || 
            DB.db.createObjectStore(s.toUpperCase(), {keyPath: 'abbr'}).createIndex('group', 'group'));
        return new Promise(res => ev.target.transaction.oncomplete = res);
    },
    fetch: {
        updates: ({fresh, index}) => fresh && !index ||
            fetch(`/x/db/-update.json`).then(resp => resp.json())
            .then(({news, ...files}) => {
                index && DB.plugins.announce(news);
                Storage('updated', Math.round(new Date / 1000));
                //!DB.plugins.include && (DB.plugins.exclude = ['prod-keihin', 'prod-equipment']);
                return fresh || DB.cache.filter(files);
            })
        ,
        files: files => Promise.all(files.filter(file => 
                (DB.plugins.include?.includes(file) ?? true) && !DB.plugins.exclude?.includes(file)
            ).map(file => 
                fetch(`/x/db/${file}.json`)
                .then(resp => Promise.allSettled([file, resp.json(), file == 'part-blade-collab' && DB.clear('blade','hasbro')]))
            )).then(arr => arr.map(([{value: file}, {value: json}]) => //in one transaction
                (DB.cache.actions[file] || DB.put.parts)(json, file)
                .then(() => Storage('DB', {[file]: Math.round(new Date / 1000)} ))
                .catch(er => console.error(file, er))
            ))
    },
    cache (files) {
        if (Array.isArray(files) && !files.length) 
            return DB.indicator.hidden = true;
        DB.indicator.init(files);
        files = Object.keys(DB.cache.actions).filter(f => files === true ? true : files.includes(f));
        return DB.fetch.files(files).then(() => DB.indicator.update(true));
    },
    trans: store => DB.tr = Object.assign(DB.db.transaction(DB.store.format(store), 'readwrite')),

    store: store => (s => DB.trans(s).objectStore(s))(DB.store.format(store)),

    get (store, key) {
        !key && ([store, key] = store.split('.').reverse());
        /^.X$/.test(store) && (store = `blade-${store}`);
        store == 'user' && (DB.tr = null);
        return new Promise(res => DB.store(store).get(key).onsuccess = ({target: {result}}) => res(result?.abbr ?
            {...result, comp: store.split('-')[0], ...store.includes('-') ? {line: store.split('-')[1]} : {}} : result
        ));
    },
    put: (store, items, callback) => items && new Promise(res => {
        store == 'meta' && (DB.tr = null);
        if (!Array.isArray(items))
            return DB.store(store).put(...items.abbr ? [items] : Object.entries(items)[0].reverse()).onsuccess = () => res(callback?.());
        DB.trans(store);
        return Promise.all(items.map(item => DB.put(store, item, callback))).then(res).catch(er => console.error(store, er));
    }),
    clear (store, value) {
        store = DB.store(store);
        return new Promise(res => store.index('group').getAll(IDBKeyRange.only(value))
            .onsuccess = ev => res(ev.target.result.forEach(({abbr}) => store.delete(abbr))));
    },
    then: callback => Object.assign(DB.indicator, {callback}),
    indicator: class extends HTMLElement {
        constructor(callback) {
            super();
            this.callback = callback;
            this.attachShadow({mode: 'open'}).append(E('style', this.#css));
        }
        connectedCallback() {
            [this.progress, this.total] = [0, Storage('DB')?.count || 100];
            Q('link[href$="common.css"]') && DB.replace('V', DB.current).then(this.callback).catch(this.error).then(Glossary);
        }
        attributeChangedCallback(_, __, state) {
            if (state == 'success') {
                E(this).set({'--p': 40 - 225 + '%'});
                this.progress > (Storage('DB')?.count ?? 0) && Storage('DB', {count: this.progress});
                setTimeout(() => this.hidden = true, 2000);
            }
            E(this).set({'--hue': state == 'success' ? 'lime' : 'deeppink'});
            this.title = state == 'success' ? '更新成功' : state == 'offline' ? '離線' : '';
        }
        init(update) {
            this.title = update ? '更新中' : '首次訪問 預備中';
            this.setAttribute('progress', this.progress = 0);
        }
        update(finish) {
            finish || ++this.progress == this.total ?
                this.classList = 'success' : 
                E(this).set({'--p': 40 - 225 * this.progress / this.total + '%'});
            this.setAttribute('progress', this.progress);
        }
        error(er) {
            console.error(...[er].flat());
            Q('.loading') && (Q('.loading').innerText = er);
            this.classList = 'error';
        }
        static observedAttributes = ['class'];
        #css = `
        :host(:not([progress]):not([class]))::before {display:none;}
        :host {
            position:relative;
            background:radial-gradient(circle at center var(--p),hsla(0,0%,100%,.2) 70%, var(--on) 70%);
            background-clip:text; -webkit-background-clip:text;
            display:block;
        }
        :host([style*='--hue']) {
            background:var(--hue);
            background-clip:text; -webkit-background-clip:text;
        }
        :host([title])::after {
            content:attr(title) ' ' attr(progress);
            position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
            color:var(--on); font-size:.9em;
            width:4.7rem;
        }
        :host::before {
            font-size:5rem; color:transparent;
            content:'\\e006';
        }
        :host(.offline)::before {content:'\\e007';}`
    },
});
Object.assign(DB.cache, {
    actions: {
        'part-blade': '', 'part-ratchet': '', 'part-bit': '', 'part-blade-collab': json => DB.put.parts(json, 'blade'),
        'part-blade-divided': json => Promise.all(Object.entries(json).map(([line, parts]) => DB.put.parts(parts, `blade-${line}`))),
        'meta': json => DB.put('meta', json),
        'prod-equipment': json => DB.put('product', json),
        'prod-keihin': beys => DB.put('product', {keihins: beys}),
        'prod-beys': beys => DB.put('product', {beys: beys.map(([code, type, ...rest]) => {
            type.split(' ')[0] == 'RB' ? code == DB.current ? DB.RB++ : DB.RB = 1 : DB.RB = 0;
            DB.current = code;
            return [DB.RB ? code + `_0${DB.RB}` : code, type, ...rest];
        })}),
    },
    filter: files => [...new O(files).filter(([file, time]) => new Date(time) / 1000 > (Storage('DB')?.[file] || 0)).keys()],
});
Object.assign(DB.store, {
    format (store) {
        if (Array.isArray(store)) return store.map(DB.store.format);
        store = store.replace('part-', '');
        return DB.stores.includes(store) ? store.toUpperCase() : store;
    }
});
Object.assign(DB.put, {
    parts: (parts, file) => DB.put(file, Object.entries(parts).map(([abbr, part]) => ({...part, abbr}) ), () => DB.indicator.update()),
});
Object.assign(DB.get, {
    all (store) {
        let comp = /(blade|ratchet|bit)/.exec(store)?.[0];
        return new Promise(res => DB.store(store).getAll().onsuccess = ev => 
            res(ev.target.result.map(p => comp ? {...p, comp, ...store.includes('-') ? {line: store.split('-')[1]} : {}} : p)));
    },
    parts (comps) {
        let transform = comps === true;
        comps = [typeof comps == 'string' ? comps : DB.stores].flat().map(c => /^.X$/.test(c) ? `blade-${c}` : c);
        DB.trans(comps);
        return comps.length === 1 ? 
            DB.get.all(comps[0]) : 
            Promise.all(comps.map(c => DB.get.all(c).then(parts => [c, parts])))
            .then(parts => transform ? DB.transform(parts) : parts);
    },
    essentials: (transform = true) => Promise.all([DB.get('meta', 'parts'), DB.get.parts(transform)])
        .then(([meta, parts]) => [new O(meta), parts])
});
DB.transform = parts => {
    let OBJ = new O;
    parts.forEach(([comp, parts]) => comp.includes('-') ?
        OBJ.blade[comp.split('-')[1]] = new O(parts.reduce((obj, {group, abbr, names}) => ({...obj, 
            [group]: {...obj[group], [abbr]: new Part.blade({abbr, names, group, line: comp.split('-')[1]})}
        }), {})) : 
        OBJ[comp] = new O(parts.map(({abbr, names, group, attr}) => 
            [abbr, new Part[comp]({abbr,
                ...names ? {names} : {}, 
                ...comp == 'blade' && /^.X$/.test(group) ? {group} : attr ? {attr} : {}
            })]
        ))
    );
    return OBJ;
}
customElements.define('db-state', DB.indicator);
export default window.DB = DB