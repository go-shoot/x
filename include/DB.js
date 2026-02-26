import { Part } from "../parts/part.js";
import { Glossary } from "./utilities.js";
let fresh, index = location.pathname == '/x/';
class Indicator extends HTMLElement {
    constructor(callback) {
        super();
        this.callback = callback;
        Indicator.#css.then(css => this.attachShadow({mode: 'open'}).adoptedStyleSheets = [css]);
    }
    connectedCallback() {
        [this.progress, this.total] = [0, Storage('DB')?.count || 100];
        Q('link[href$="common.css"]') && DB.replace().catch(er => this.error(er)).then(this.callback).then(Glossary);
    }
    attributeChangedCallback(_, __, state) {
        if (state == 'success') {
            E(this).set({'--p': 40 - 225 + '%'});
            this.progress > (Storage('DB')?.count ?? 0) && Storage('DB', {count: this.progress});
            this.timer = setTimeout(() => this.hidden = true, 3000);
        } else
            clearTimeout(this.timer);
        E(this).set({'--hue': state == 'success' ? 'lime' : 'deeppink'});
        this.title = state == 'success' ? '更新成功' : state == 'offline' ? '離線' : '';
    }
    init(files) {console.log(files);
        if (!files.length) return this.hidden = true;
        this.setAttribute('progress', this.progress = 0);
        return this.title = '更新中';
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
    static #css = new CSSStyleSheet().replace(`
    :host(:not([progress]):not([class]))::before {display:none;}
    :host {
        position:relative;
        background:radial-gradient(circle at center var(--p),hsla(0,0%,100%,.2) 70%, var(--on) 70%) text;
        display:block;
        pointer-events:none;
    }
    :host([style*='--hue']) {
        background:var(--hue) text;
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
    :host(.offline)::before {content:'\\e007';}`);
};
customElements.define('db-state', Indicator);

const DB = (plugins = {}) => Object.assign(DB, {indicator: new DB.indicator, plugins});
Object.assign(DB, {
    outdate: 'V', current: 'X', indicator: Indicator,
    stores: [
        'bit', 'ratchet', 'blade',
        ...[...new O(LINES)].filter(([_, {divided}]) => divided).flatMap(([line]) => `blade.${line}`)
    ],
    then: callback => Object.assign(DB.indicator, {callback}),
    format: {
        store (store) {
            if (Array.isArray(store)) return store.map(DB.format.store);
            store = store.replace('part-', '').replace(/^.X$/, 'blade.$&');
            return DB.stores.includes(store) ? store.toUpperCase() : store;
        },
        part: (part, store) => ({...part, comp: store.split('.')[0], ...store.includes('.') ? {line: store.split('.')[1]} : {}})
    },

    replace: (before = DB.outdate, after = DB.current) => indexedDB.databases()
        .then(dbs => dbs.find(db => db.name == before) && DB.open(before).then(DB.discard))
        .then(() => DB.open(after))
    ,
    discard: handler => DB.transfer.out().catch(() => {})
        .then(() => new Promise(res => {
            DB.db.close();
            Object.assign(indexedDB.deleteDatabase(DB.db.name), {        
                onsuccess: () => res(DB.db = null),
                onblocked: handler ?? console.error
            });
        }))
    ,
    transfer: {
        out: () => DB.get.all('user').then(data => sessionStorage.user = JSON.stringify(data)),
        in: () => DB.put('user', JSON.parse(sessionStorage.user ?? '[]').map((item, i) => ({[`sheet-${i+1}`] : item})))
    },
    open: nameORver => nameORver == DB.db?.name ? DB.db : 
        new Promise(res => Object.assign(indexedDB.open(
            typeof nameORver == 'string' ? nameORver : DB.current, 
            typeof nameORver == 'number' ? nameORver : undefined
        ), {onsuccess: res, onupgradeneeded: res}))
        .then(ev => {
            if (ev.target.result.name != DB.current) 
                return ev.target.result;
            DB.db = ev.target.result;
            if (ev.type == 'success' && DB.stores.some(s => !DB.db.objectStoreNames.contains(s.toUpperCase())))
                return DB.db.close().then(() => DB.open(DB.db.version + 1));

            ev.type == 'upgradeneeded' && DB.setup(ev);
            fresh = ev.oldVersion === 0;
            let skip = Date.now() < Storage('no-update-jsons');
            return (!skip || index ? DB.update() : Promise.resolve())
                .then(() => DB.plugins.followup?.()).catch(console.error)
        })
    ,
    update: () => (fresh && !index ? Promise.resolve() : DB.fetch.updates())
        .then(DB.filter.files).then(DB.fetch.files).then(DB.cache.files)
        .then(() => Storage('no-update-jsons', Date.now() + 5*60*1000))
        .catch(er => navigator.onLine ? console.error(er) : DB.indicator.classList = 'offline')
    ,
    setup (ev) {
        ['product','meta','user'].forEach(s => DB.db.objectStoreNames.contains(s) || DB.db.createObjectStore(s));
        DB.stores.map(s => DB.db.objectStoreNames.contains(s.toUpperCase()) || 
            DB.db.createObjectStore(s.toUpperCase(), {keyPath: 'abbr'}).createIndex('group', 'group'));
        DB._tx = Transaction(ev.target.transaction);
        return DB.transfer.in();
    },
    fetch: {
        updates: () => fetch(`/x/db/-update.json`).then(resp => resp.json())
            .then(({news, ...files}) => {
                DB.plugins.announce?.(news);
                return files;
            })
        ,
        files: files => DB.indicator.init(files) && Promise.all(files.map(DB.fetch.file)),
        file: file => fetch(`/x/db/${file}.json`)
            .then(resp => Promise.allSettled([
                file, resp.json(), 
                fresh || file == 'part-blade-collab' && DB.delete('blade','hasbro'),
                fresh || file == 'part-blade-divided' && DB.delete('blade.CX','hasbro'),
            ]))
    },
    filter: {
        files: files => Object.keys(DB.cache.actions)
            .filter(f => fresh ? true : new Date(files[f]) / 1000 > (Storage('DB')?.[f] || 0))
    },
    cache: {
        actions: {
            'part-blade': '', 'part-ratchet': '', 'part-bit': '', 'part-blade-collab': json => DB.put.parts(json, 'blade'),
            'part-blade-divided': json => Promise.all(Object.entries(json).map(([line, parts]) => DB.put.parts(Transform.to.grouped(parts), `blade.${line}`))),
            'meta': json => DB.put('meta', json),
            'prod-equipment': json => DB.put('product', json),
            'prod-keihin': beys => DB.put('product', {keihins: beys}),
            'prod-beys': beys => DB.put('product', {beys: beys.map(Transform.to.RB())}),
        },
        files: arr => Promise.all(arr.map(([{value: file}, {value: json}]) => DB.cache.file(file, json)))
            .then(() => DB.indicator.update(true))
        ,
        file: (file, json) => (DB.cache.actions[file] || DB.put.parts)(json, file)
            .then(() => Storage('DB', {[file]: Math.round(new Date / 1000)} ))
    },
    store (store) {
        store = DB.format.store(store);
        DB._tx?.objectStoreNames.contains(store) || (DB._tx = new Transaction(store));
        return DB._tx.objectStore(store);
    },
    delete (store, value) {
        store = DB.store(store);
        return new Promise(res => store.index('group').getAll(IDBKeyRange.only(value))
            .onsuccess = ev => res(ev.target.result.forEach(({abbr}) => store.delete(abbr))));
    },
    get: (...path) => new Promise(res => DB.store(path.slice(0, path.length/2).join('.')).get(path.slice(path.length/2).join('.'))
        .onsuccess = ({target: {result}}) => res(result?.abbr ? DB.format.part(result, path[0]) : result))
    ,
    put: (store, items) => Array.isArray(items) ?
        Promise.all(items.map(item => DB.put(store, item))) :
        items && new Promise(res => DB.store(store).put(...items.abbr ? [items] : Object.entries(items)[0].reverse())
            .onsuccess = () => res(DB.put.success()))
});
Object.assign(DB.put, {
    parts: (parts, file) => DB.put(file, [...new O(parts)].map(([abbr, part]) => ({...part, abbr}))),
    success: () => DB.indicator.update()
});
Object.assign(DB.get, {
    all: store => new Promise(res => DB.store(store).getAll()
        .onsuccess = ev => res(ev.target.result.map(p => p.abbr ? DB.format.part(p, store) : p)))
    ,
    parts: dict => Promise.all(DB.stores.map(store => DB.get.all(store).then(parts => [store, parts])))
        .then(parts => dict ? Transform.to.dict(parts) : parts)
    ,
    essentials: (dict = true) => Promise.all([DB.get('meta', 'parts'), DB.get.parts(dict)])
        .then(([meta, parts]) => [new O(meta), parts])
});

const Transaction = function(txORstore) {
    return this instanceof Transaction ? 
        Transaction(DB.db.transaction(txORstore, 'readwrite')) : 
        Object.assign(txORstore, {oncomplete: () => DB._tx = null, onabort: () => DB._tx = null, onerror: () => DB._tx = null});
};
const Transform = {
    to: {
        grouped: parts => ({...new O(parts)
            .map(([group, parts]) => [group, parts.map(([sym, part]) => [sym, {...part, group}]) ])
            .flatten(([group, abbr, ...others]) => [`${group}.${abbr}`, ...others])
        }),
        dict (parts) {
            let OBJ = new O;
            parts.forEach(([comp, parts]) => comp.includes('.') ?
                OBJ.blade[comp.split('.')[1]] = Transform.to.dict([...new O(Object.groupBy(parts, part => part.group))]) : 
                OBJ[comp] = new O(OBJ[comp] ?? {}, parts.map(part => {
                    part.abbr.includes('.') && ([part.group, part.abbr] = part.abbr.split('.'));
                    part = new (Part[comp] ?? Part.blade)(part);
                    !location.pathname.includes('/parts/') 
                        && part.keep('abbr', 'path', 'line', 'group', 'names', 'attr', 'revised');
                    return [part.abbr, part];
                }))
            );
            return OBJ;
        },
        RB: (subcode, current) => ([code, type, ...rest]) => {
            type.split(' ')[0] == 'RB' ? code == current ? subcode++ : subcode = 1 : subcode = 0;
            current = code;
            return [subcode ? code + `_0${subcode}` : code, type, ...rest];
        }
    }
};
export default window.DB = DB