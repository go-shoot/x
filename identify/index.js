import DB from "../include/DB.js";
import { Markup } from "../include/utilities.js";
import { Preview } from "../parts/bey.js";
import 'https://cdn.jsdelivr.net/npm/imagehash-web/dist/imagehash-web.min.js';
import PI from 'https://aeoq.github.io/pointer-interaction/script.js';
import * as Comlink from "https://unpkg.com/comlink/dist/esm/comlink.mjs";

E.img = src => new Promise(res => E('img', {
    src, crossOrigin: 'anonymous', referrerPolicy: 'no-referrer', 
    onload: function() {res(this)}, onerror: () => res(null)
}));
let COLLAGE;
class Cutout {
    constructor({box, bmp}) {
        this.box = box, this.bitmap = bmp;
        this.class = ['blade','ratchet','bit','CX'][box.class];
    }
    computeHash (bmp = this.bitmap) {
        if (this.hash) return;
        let cvs = E('canvas', {width: bmp.width, height: bmp.height}); //only canvas accepted
        cvs.getContext('2d').drawImage(bmp, 0, 0, bmp.width, bmp.height);
        return window[Analysis.algo](cvs, 16).then(hash => (this.hash = hash) && bmp.close());
    }
    #determined; #corrected;
    set determined (r) {this.#determined = Asset.find(r, this.class); this.label();}
    set corrected (P) {this.#corrected = P; COLLAGE.label();}
    label (lang = Q('input[name=lang]:checked').value) {
        let P = this.#corrected ?? this.#determined;
        let label = P ? Markup.hktw(lang, P.only.name() && Markup.clear(P.names.chi) || P.abbr) : '';
        COLLAGE.worker.label(this.box, label);
    }
    actions = {
        correct: ev => {
            if (ev.target != Collage.cvs)
                return this.corrected = ev.target.labels[0].Part ?? '';
            let div = Q(`#${this.class}`);
            let sorted = [...div.children].sort((...labels) => 
                [...this.Parts].indexOf(labels[0].Part) - [...this.Parts].indexOf(labels[1].Part)
            );
            E(div).set(sorted, {hidden: false, onchange: this.actions.correct});
            sorted.find(label => 
                label.Part == (this.#corrected === '' ? undefined : (this.#corrected ?? this.#determined))
            ).Q('input').checked = true;
            div.parentElement.classList.add('active');
        },
        preview: ev => {
            if (this.#corrected === '') return;
            Q('aside.active', aside => aside.classList.remove('active'));
            Q('#correct div', div => div.hidden = true);
            return new Preview(['cell', 'tile'], {path: (this.#corrected ?? this.#determined).path}, ev);
        }
    }
}
class Asset {
    constructor(P, flipped) {
        return E.img(`/x/img/${typeof P == 'object' ? P.path.join('/') : `bit/${P}`}.png`)
        .then(async img => img ? [img, await this.canvas(img, {flipped})] : [])
        .then(([img, cvs]) => {
            if (!img) return;
            flipped && img.classList.add('flipped');
            this.label = E('label', [E('input', {type: 'radio', name: 'correction'}), cvs, img]);
            this.label.Part = this.P = P, this.cvs = cvs;
        }).then(() => this);
    }
    computeHash (backdrop, cvs = this.cvs) {
        if (this.backdrop == backdrop) return;
        this.backdrop = backdrop;
        return this.canvas(cvs, {backdrop})
            .then(cvs => cvs && window[Analysis.algo](cvs, 16))
            .then(hash => hash ? this.hash = hash : null);
    }
    canvas = async (img, {backdrop, flipped}) => {
        if (!img) return;
        let cvs = img.tagName == 'CANVAS' ? img : E('canvas', {width: img.width, height: img.height});
        let ctx = cvs.getContext('2d');
        img.tagName == 'CANVAS' && (img = img.nextElementSibling);
        backdrop && (ctx.fillStyle = `rgba(${backdrop})`);
        ctx.fillRect(0, 0, img.naturalWidth, img.naturalHeight);
        if (flipped === true) {
            ctx.translate(img.naturalWidth, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
        return cvs;
    }
    static async add (comp) {        
        if (Array.isArray(comp)) return Promise.all(comp.map(c => Q(`#${c}`) ?? Asset.add(c)));
        let assets = Asset.raw[comp].map(P => new Asset(P));
        comp == 'bit' && assets.concat(Asset.flipped.bit.map(abbr => new Asset(abbr, true)));
        return Promise.all(assets).then(As => (Asset[comp] = As) && Q('#correct').append(
            E(`div#${comp}`, {hidden: true}, [
                E('label>input', {type: 'radio', name: 'correction'}), 
                ...As.map(A => A.label ?? [])
            ])
        ));
    }
    static flipped = {bit: ['F','T','B','N','HN','LF']}
    static find (i, comp) {
        if (comp != 'bit') return Asset[comp][i]?.P;
        let flipped = Asset.flipped.bit[i - (Asset.bit.length - Asset.flipped.bit.length)];
        return flipped ? Asset.bit.find(({P}) => P.abbr == flipped)?.P : Asset[comp][i]?.P;
    }
}
class Collage {
    constructor(ev) {
        App.state(1, 'begun');
        return E.img(typeof ev == 'string' ? ev : URL.createObjectURL(ev.target.files[0]))
            .then(createImageBitmap)
            .then(bmp => {
                Q('input[type=file]').value = '';
                App.state(1, 'done');
                App.state(2, 'begun');
                let cvs = Collage.transferred ? null : Collage.cvs.transferControlToOffscreen();
                Collage.transferred = true;
                return new Collage.from.worker(cvs ? Comlink.transfer(cvs, [cvs]) : null, bmp);
            }).then(collage => {
                this.worker = collage;
                COLLAGE = this;
                App.state(2, 'done');
            });
    }
    cutouts = {}
    label () {
        COLLAGE.worker.draw(true);
        Object.values(this.cutouts).flat().forEach(cutout => cutout.label());
    }
    locate = ([x, y]) => Object.values(this.cutouts).flat()
        .find(({box: [x0, y0, x1, y1]}) => x >= x0 && x <= x1 && y >= y0 && y <= y1)?.actions
    static select (ev, W = Collage.cvs.width, H = Collage.cvs.height) {
        ev.stopPropagation();
        if (!Object.values(COLLAGE.cutouts).flat().length) return;
        let {left, top, width, height} = Collage.cvs.getBoundingClientRect();
        let [x, y] = [(ev.clientX - left) * W / width, (ev.clientY - top) * H / height];
        COLLAGE.locate([x, y])?.[Q('input[name=mode]:checked').value](ev);
    }
    static cvs = Q('canvas');
    static from = {worker: Comlink.wrap(new Worker('./worker.js', {type: 'module'}))};
}
class Analysis {
    constructor() {
        App.state(4, 'begun');
        return Promise.all([COLLAGE.worker.classes.then(comps => this.comps = [...comps]), COLLAGE.worker.detect.backdrop()])
            .then(([, backdrop]) => Promise.all([this.prepare.cutouts(), this.prepare.assets(backdrop)]))
            .then(() => this.match())
            .then(result => (Analysis.result = result) && App.state([4,5], 'done'))
            .catch(er => console.error(er) || Q('.loading', [])[0]?.append(`${er}`));
    }
    prepare = {
        assets: async (backdrop) => {
            App.state(3, 'begun');
            await Asset.add(this.comps).then(() => Promise.all(this.comps.flatMap(c => Asset[c]).map(A => A.computeHash(backdrop))));
            Q('#correct').style.background = `rgba(${backdrop})`;
            App.state(3, 'done');
        },
        cutouts: () => COLLAGE.worker.cutouts()
            .then(cutouts => Promise.all(cutouts.map(async ({box, bmp}) => {
                let cutout = new Cutout({box, bmp});
                (COLLAGE.cutouts[cutout.class] ??= []).push(cutout);
                return cutout.computeHash();
            })))
    }
    match = () => this.comps.map(c => 
        new ScoreMatrix(c).compare.by((h1, h2) => h1.hammingDistance(h2)).determine({from: 'min', limit: 130}).order()
    )
    static algo = Q('input[name=algo]:checked').value
}
class ScoreMatrix { //row: parts, col: boxes
    constructor(comp) {
        this.comp = comp;
        let asset = Asset[comp].map(A => A.hash), cutout = COLLAGE.cutouts[comp].map(C => C.hash);
        this.R = asset.length, this.C = cutout.length;
        this.hashes = {asset, cutout};
        this.scores = new Uint8Array(this.R * this.C).fill(255);
        this.done = {rows: new Set(), cols: new Set()};
    }
    compare = {by: comparer => {
        for (let [r, asset] of this.hashes.asset.entries())
            for (let [c, cutout] of this.hashes.cutout.entries())
                this.scores[r * this.C + c] = asset ? Math.min(255, comparer(cutout, asset)) : null;
        return this;
    }}
    #entries = () => [...this.scores].map((v, i) => ({r: Math.floor(i / this.C), c: i % this.C, v})).filter(({v}) => v >= 0)
    determine ({from, limit}) {
        this.#entries().sort((a, b) => from == 'min' ? a.v - b.v : b.v - a.v).forEach(({r, c, v}) => {
            if (this.done.rows.has(r) || this.done.cols.has(c) || (from == 'min' ? v > limit : v < limit)) return;
            COLLAGE.cutouts[this.comp][c].determined = r;
            this.done.rows.add(r);
            this.done.cols.add(c);
        });
        return this;
    }
    order = () => COLLAGE.cutouts[this.comp].map((cutout, c) => {
        let scores = [];
        for (let r = 0; r < this.R; r++)
            scores.push({r, v: this.scores[r * this.C + c]});
        cutout.Parts = new Set(scores.sort((a, b) => a.v - b.v).map(({r}) => Asset.find(r, this.comp)).filter(P => P));
        return this;
    });
}
const App = () => DB.get.essentials({flat: true})
    .then(Parts => {
        Asset.raw = Parts = Object.groupBy(Parts, P => P.path[2] ? P.path[1] : P.constructor.name.toLowerCase());        
        App.events();
        Q(`input[value=${Storage('pref')?.lang || 'hk'}]`).click();
        Q('.loading', el => el.classList.remove('loading'));
        App.comps = Object.keys(Parts);
    });
Object.assign(App, {
    state (step, state) {
        if (Array.isArray(step)) return step.forEach(s => App.state(s, state));
        App.steps ??= [...Q('ol').children];
        if (state == '++')
            return E(App.steps[step - 1]).set({'--p': E(App.steps[step - 1]).get('--p') + 1});
        App.steps[step - 1].classList.toggle('loading', state == 'begun');
        state == 'begun' ?
            App.steps.slice(step).forEach(li => li.classList.add('inactive')) : 
            App.steps[step].classList.remove('inactive');
    },
    autoflow: ({dataset: {url}}) => new Collage(url).then(() => new Analysis()),
    events () {
        Q('form button', button => button.type = 'button');
        E(Q('nav')).set({
            onclick: ev => ev.target.dataset.url ? App.autoflow(ev.target) : '',
            onchange: () => COLLAGE?.label()
        });      
        E(Q('main')).set({
            onclick (ev) {
                Q('aside.active', aside => aside.classList.remove('active'));
                Q('#correct div', div => div.hidden = true);
                if (ev.target.id == 'download')
                    return gtag('event', 'IDENTIFY-DOWNLOAD') || 
                    E('a', {href: Collage.cvs.toDataURL('image/jpeg'), download: `辦認.jpg`}).click();
                if (ev.target.matches('[id|=tier]'))
                    return App.events.tiers(ev);
                if (ev.target.name == 'mag')
                    return E(Q('div:has(canvas)')).set({
                        '--f': E(Q('div:has(canvas)')).get('--f') + (ev.target.value == '+' ? .1 : -.1)
                    });
            },
            onchange: (ev) =>
                ev.target.type == 'file' ? new Collage(ev).then(() => new Analysis()) : ev.target.name == 'algo' ? Analysis.algo = ev.target.value : '',
        });
        Collage.cvs.onclick = Collage.select;
        PI.events({'#correct': {scroll: {x: true}}});
    },
});
Object.assign(App.events, {
    tiers (ev) {
        let [textareas, confirm] = [Q('textarea'), Q('#tier-confirm')];
        if (ev.target.id == 'tier-list')
            return COLLAGE.worker.detect.tiers().then(tiers =>
                tiers.forEach(([ty0, ty1], i) => (textareas[i].value = [
                    Analysis.result.boxes.filter(({y0, y1}) => y0 >= ty0 - 5 && y1 <= ty1 + 5)
                    .map(({determined, corrected}) => (corrected || determined)?.abbr)
                ]) && (textareas[i].hidden = false))
            );
        DB.get('user', `tier-${App.comp}`)
        .then(obj => {
            obj = Object.assign(obj ?? {}, ...textareas.map((area, i) => 
                area.value.split(',').filter(a => a).reduce((obj, abbr) => ({...obj, [abbr.trim()]: i}), {})
            ));
            return DB.put('user', {[`tier-${App.comp}`]: obj})
        })
        .then(() => confirm.innerHTML = '&#xe014;')
        .catch(er => (confirm.innerHTML = '格式錯誤') && console.error(er))
        .finally(() => setTimeout(() => confirm.innerHTML = '確認', 1000));
    }
});
export default App;