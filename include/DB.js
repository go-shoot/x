import { Part } from "../parts/part.js";
import { Glossary } from "./utilities.js";
class Indicator extends HTMLElement {
    constructor(callback) {
        super();
        this.callback = callback;
        Indicator.#css.then(css => this.attachShadow({mode: 'open'}).adoptedStyleSheets = [css]);
    }
    connectedCallback() {
        this.total = Storage('DB')?.count || 100;
        this.onclick = () => this.classList == 'error-ex' && location.reload();
        Q('link[href$="common.css"]') && 
            DB.replace().catch(er => this.error(er, 'db'))
            .then(this.callback).catch(er => this.error(er, 'ex')).then(Glossary);
    }
    update (signal) {
        signal === true || ++this.progress == this.total ?
            this.progress ? this.complete() : this.title = '更新中' :
            this.progress ? E(this).set({'--p': -150 - 200 * this.progress / this.total + '%'}) : this.hidden = true;
        this.setAttribute('progress', this.progress ||= 0);
        return true;
    }
    complete () {
        [this.title, this.classList] = ['更新成功', 'completed'];
        setTimeout(() => this.hidden = true, 3000);
        this.progress > (Storage('DB')?.count ?? 0) && Storage('DB', {count: this.progress});
    }
    error (er, type) {
        if (er) {
            er == 'offline' ? 
                [er, type] = ['離線', er] : 
                console.error(er) ?? gtag('event', 'ERROR', {MESSAGE: er.message});
            [this.title, this.classList, this.hidden] = [er, `error-${type}`, false];
        }
        return Promise.reject();
    }
    static #css = new CSSStyleSheet().replace(`
    :host(:not([progress]):not([class]))::before {display: none;}
    :host {
        position: relative;
        background: radial-gradient(circle at center var(--p),hsla(0,0%,100%,.2) 70%, var(--on) 70%) text;
        display: block;
    }
    :host::before {
        font-size: 5rem; color: transparent;
        content: '\\e006';
    }
    :host(.error-offline)::before {content: '\\e007';}
    :host(.error-ex)::before {content: '';}
    :host(.completed) {
        background: lime text;
        --p: 350%;
    }
    :host([class|=error]) {
        background: red text;
    }
    :host([title])::after {
        content: attr(title) ' ' attr(progress);
        position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
        color: var(--on); mix-blend-mode: difference;
        width: 100%;
    }`);
};
customElements.define('db-state', Indicator);

const DB = (plugins = {}) => Object.assign(DB, {indicator: new DB.indicator, plugins});
Object.assign(DB, {
    outdate: 'V', current: 'X', indicator: Indicator,
    then: callback => Object.assign(DB.indicator, {callback}),
    format: {
        store (store) {
            if (store === true) return DB.format.store([...DB.os.parts, ...DB.os.others]);
            if (Array.isArray(store)) return store.map(DB.format.store);
            store = store.replace('part-', '').replace(/^.X$/, 'blade.$&');
            return DB.os.parts.includes(store) ? store.toUpperCase() : store;
        },
        part: (part, store) => ({...part, 
            comp: store.split('.')[0], 
            ...store.includes('.') ? {line: store.split('.')[1]} : {}
        })
    },
    replace: (before = DB.outdate, after = DB.current) => indexedDB.databases()
        .then(dbs => dbs.find(db => db.name == before) && DB.open(before).then(DB.discard))
        .then(() => DB.open(after))
    ,
    discard: handler => new Promise(res => {
        DB.db.close();
        Object.assign(indexedDB.deleteDatabase(DB.db.name), {        
            onsuccess: () => res(DB.db = null),
            onblocked: handler ?? console.error
        });
    }),
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
            if (ev.type == 'success' && DB.os.parts.some(s => !DB.db.objectStoreNames.contains(s.toUpperCase())))
                return DB.db.close().then(() => DB.open(DB.db.version + 1));

            ev.type == 'upgradeneeded' && DB.setup(ev);
            DB.fresh = ev.oldVersion === 0;
            let [index, expired] = [location.pathname == '/x/', Date.now() > Storage('no-update-jsons')];
            return DB.update({skip: {
                all: !index && location.host == 'go-shoot.github.io' && !expired,
                check: !index && DB.fresh
            }});
        })
    ,
    update: ({skip}) => skip.all || Promise.try(() => skip.check || DB.fetch.updates())
        .then(DB.filter.files).then(DB.fetch.files).then(DB.cache.files)
        .then(() => Storage('no-update-jsons', Date.now() + 5*60*1000))
    ,
    setup (ev) {
        DB.os.others.forEach(s => DB.db.objectStoreNames.contains(s) || DB.db.createObjectStore(s));
        DB.os.parts.map(s => DB.db.objectStoreNames.contains(s.toUpperCase()) || 
            DB.db.createObjectStore(s.toUpperCase(), {keyPath: 'abbr'}).createIndex('group', 'group'));
        DB.tx.bind(ev.target.transaction);
    },
    fetch: {
        aborter: new AbortController(),
        timer: () => DB.fetch.timer = setTimeout(() => DB.fetch.aborter.abort(), 5000),
        updates: () => DB.fetch.timer() && fetch(`/x/db/-update.json`, {signal: DB.fetch.aborter.signal})
            .catch(() => DB.indicator.error('offline'))
            .then(resp => clearTimeout(DB.fetch.timer) || resp.json())
            .then(({news, ...files}) => {
                DB.plugins.announce?.(news);
                return files;
            }).catch(er => DB.indicator.error(er, 'ex'))
        ,
        files: files => DB.indicator.update(files.length && true) && Promise.all(files.map(DB.fetch.file)),
        file: file => fetch(`/x/db/${file}.json`)
            .then(resp => Promise.allSettled([
                file, resp.json(), 
                DB.fresh || file == 'part-blade-collab' && DB.delete('blade','collab'),
                DB.fresh || file == 'part-blade-divided' && DB.delete('blade.CX','hasbro'),
            ]))
    },
    filter: {
        files: files => Object.keys(DB.cache.actions)
            .filter(f => DB.fresh ? true : new Date(files[f]) / 1000 > (Storage('DB')?.[f] || 0))
    },
    cache: {
        actions: {
            'part-blade': '', 'part-ratchet': '', 'part-bit': '', 'part-blade-collab': json => DB.put.parts(json, 'blade'),
            'part-blade-divided': json => Promise.all(Object.entries(json).map(([line, parts]) => DB.put.parts(Transform.to.grouped(parts), `blade.${line}`))),
            'meta': json => DB.put('meta', json),
            'prod-gear': json => DB.put('product', json),
            'prod-keihin': beys => DB.put('product', {keihins: beys}),
            'prod-beys': beys => DB.put('product', {beys: beys.map(Transform.to.RB())}),
        },
        files: ar => ar.length && DB.prepare.tx(true, 'rw') && 
            Promise.all(ar.map(([{value: file}, {value: json}]) => DB.cache.file(file, json)))
            .then(() => DB.indicator.update(true))
        ,
        file: (file, json) => (DB.cache.actions[file] || DB.put.parts)(json, file)
            .then(() => Storage('DB', {[file]: Math.round(new Date / 1000)} ))
    },
    prepare: {
        tx (stores, mode) {
            stores = [DB.format.store(stores)].flat();
            if (!DB._tx || mode == 'rw' && DB._tx.mode != 'readwrite' 
                || stores.some(s => !DB._tx.objectStoreNames.contains(s))) {
                DB.tx.bind(DB.db.transaction(stores, mode == 'rw' ? 'readwrite' : 'readonly'));
            }
            return DB._tx;
        },
        os (store, mode) {
            try {
                return DB.prepare.tx(store, mode).objectStore(DB.format.store(store));
            }
            catch (e) {
                DB._tx = null; 
                return DB.prepare.os(store, mode);
            }
        }
    },
    tx: {
        bind: (tx = DB._tx) => (DB._tx = tx) && (tx.oncomplete = tx.onabort = tx.onerror = () => DB._tx = null),
    },
    os: {
        parts: [
            'bit', 'ratchet', 'blade',
            ...LINES.filter(([_, {divided}]) => divided).flatMap(([line]) => `blade.${line}`)
        ],
        others: ['product', 'meta', 'user'],
    },
    delete (store, value) {
        store = DB.prepare.os(store, 'rw');
        return new Promise(res => store.index('group').getAll(IDBKeyRange.only(value))
            .onsuccess = ev => res(ev.target.result.forEach(({abbr}) => store.delete(abbr))));
    },
    get: (...path) => new Promise(res => DB.prepare.os(path.slice(0, path.length/2).join('.'))
        .get(path.slice(path.length/2).join('.'))
        .onsuccess = ({target: {result}}) => res(result?.abbr ? DB.format.part(result, path[0]) : result))
    ,
    put: (store, items) => Array.isArray(items) ?
        Promise.all(items.map(item => DB.put(store, item))) :
        items && new Promise(res => DB.prepare.os(store, 'rw').put(...items.abbr ? [items] : Object.entries(items)[0].reverse())
            .onsuccess = () => res(DB.put.success()))
});
Object.assign(DB.put, {
    parts: (parts, file) => DB.put(file, [...new O(parts)].map(([abbr, part]) => ({...part, abbr}))),
    success: () => DB.indicator.update()
});
Object.assign(DB.get, {
    all: store => new Promise(res => DB.prepare.os(store).getAll()
        .onsuccess = ev => res(ev.target.result.map(p => p.abbr ? DB.format.part(p, store) : p)))
    ,
    parts: detailed => DB.prepare.tx(DB.os.parts) && 
        Promise.all(DB.os.parts.map(store => DB.get.all(store).then(parts => [store, parts])))
        .then(parts => Transform.to.dict(parts, detailed))
    ,
    essentials: detailed => Promise.all([DB.get('meta', 'general'), DB.get.parts(detailed)])
        .then(([meta, parts]) => [meta, parts])
});
const Transform = {
    to: {
        grouped: parts => ({...new O(parts)
            .map(([group, parts]) => [group, parts.map(([sym, part]) => [sym, {...part, group}]) ])
            .flatten(([group, abbr, ...others]) => [`${group}.${abbr}`, ...others])
        }),
        dict (parts, detailed) {
            let OBJ = new O;
            parts.forEach(([comp, parts]) => comp.includes('.') ?
                OBJ.blade[comp.split('.')[1]] = Transform.to.dict([...new O(Object.groupBy(parts, part => part.group))], detailed) : 
                OBJ[comp] = new O(OBJ[comp] ?? {}, parts.map(part => {
                    part.abbr.includes('.') && ([part.group, part.abbr] = part.abbr.split('.'));
                    let P = new (Part[comp] ?? Part.Blade)(part);
                    detailed || P.keep('abbr', 'path', 'line', 'group', 'names', 'attr', 'revised');
                    return [P.abbr, P];
                }))
            );
            return OBJ;
        },
        RB: subcode => ([code, classes, ...rest], i, list) => {
            if (!/^RB|Lm/.test(classes)) return [code, classes, ...rest];
            subcode = code == list[i-1]?.[0] ? subcode + 1 : 
                      code == list[i+1]?.[0] ? 1 : 0;
            return [subcode ? code + `_0${subcode}` : code, classes, ...rest];
        }
    }
};
export default window.DB = DB