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
let COLLAGE, KNOBS = Object.fromEntries(Q('continuous-knob', []).map(knob => [knob.id, knob.value]));
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
        comp == 'bit' && assets.push(...Asset.flipped.bit.map(abbr => new Asset(abbr, true)));
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
        return flipped ? Asset.bit.find(({P}) => P?.abbr == flipped)?.P : Asset[comp][i]?.P;
    }
}
class Cutout {
    constructor({box, bmp}) {
        this.box = box, this.bitmap = bmp, this.class = box.class;
    }
    computeHash (bmp = this.bitmap) {
        if (this.hash) return;
        let cvs = E('canvas', {width: bmp.width, height: bmp.height}); //only canvas accepted
        cvs.getContext('2d').drawImage(bmp, 0, 0, bmp.width, bmp.height);
        return window[Analysis.algo](cvs, 16).then(hash => (this.hash = hash) && bmp.close());
    }
    label (string = false, lang = Q('input[name=lang]:checked').value) {
        let P = this.identified;
        let label = P ? Markup.hktw(lang, P.only.name() && Markup.clear(P.names.chi) || P.abbr) : '';
        return string ? label : COLLAGE.worker.label(this.box, label);
    }
    actions = {
        correct: ev => {
            if (ev.target != Collage.cvs) {
                this.identified = ev.target.labels[0].Part ?? '';
                COLLAGE.label();
                return App.analysis.tiers.read();
            }
            let div = Q(`#${this.class || App.class}`);
            let sorted = [...div.children].sort((...labels) => 
                [...this.Parts].indexOf(labels[0].Part) - [...this.Parts].indexOf(labels[1].Part)
            );
            E(div).set(sorted, {hidden: false, onchange: this.actions.correct});
            sorted.find(label => 
                label.Part == (this.identified === '' ? undefined : this.identified)
            ).Q('input').checked = true;
            div.parentElement.classList.add('active');
        },
        preview: ev => {
            if (this.identified === '') return;
            Q('aside.active', aside => aside.classList.remove('active'));
            Q('#correct div', div => div.hidden = true);
            return new Preview(['cell', 'tile'], {path: this.identified.path}, ev);
        }
    }
}
class Collage {
    constructor(ev) {
        App.state(1, 'begun');
        COLLAGE = this;
        return E.img(typeof ev == 'string' ? ev : URL.createObjectURL(ev.target.files[0]))
            .then(createImageBitmap)
            .then(async bmp => {
                Q('input[type=file]').value = '';
                let cvs = Collage.transferred ? null : Collage.cvs.transferControlToOffscreen();
                Collage.transferred = true;
                this.worker = await new App.worker.Collage(cvs ? Comlink.transfer(cvs, [cvs]) : null, bmp);
                bmp.close();
                App.state(1, 'done');
                return this.detect('boxes', Q('input[value=AI]').checked || KNOBS);
            });
    }
    async detect (what, AI) {
        if (what != 'boxes')
            return this.worker.detect[what]();
        App.state(2, 'begun');
        this.cutouts = {};
        await this.worker.detect.boxes(AI);
        App.state(2, 'done');
    }
    label () {
        this.worker.draw(true);
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
}
class Analysis {
    constructor() {
        App.state(4, 'begun');
        return Promise.all([COLLAGE.worker.classes.then(comps => this.comps = [...comps]), COLLAGE.detect('backdrop')])
            .then(([, backdrop]) => Promise.all([this.prepare.cutouts(), this.prepare.assets(backdrop)]))
            .then(() => {
                this.match();
                this.tiers.read();
                App.state([4,5], 'done');
                App.analysis = this;
            }).catch(er => console.error(er) || Q('.loading', [])[0]?.append(`${er}`));
    }
    prepare = {
        assets: async (backdrop, comps = this.comps) => {
            App.state(3, 'begun');
            await Asset.add(comps).then(() => Promise.all(comps.flatMap(c => Asset[c]).map(A => A.computeHash(backdrop))));
            Q('#correct').style.background = `rgba(${backdrop})`;
            App.state(3, 'done');
        },
        cutouts: () => COLLAGE.worker.cutouts()
            .then(cutouts => Promise.all(cutouts.map(async ({box, bmp}) => {
                let cutout = new Cutout({box, bmp});
                (COLLAGE.cutouts[cutout.class || App.comp] ??= []).push(cutout);
                return cutout.computeHash();
            })))
    }
    match = () => this.comps.map(c => 
        new ScoreMatrix(c).compare.by((h1, h2) => h1.hammingDistance(h2)).determine({from: 'min', limit: 130}).order()
    )
    #tiers = {}
    tiers = {
        read: async () => {
            let tiers = this.#tiers.range ??= await COLLAGE.detect('tiers');
            this.#tiers.content = Object.entries(COLLAGE.cutouts).map(([comp, cutouts]) =>
                [comp, tiers.map(([ty0, ty1]) => cutouts.filter(({box: [, y0, , y1]}) => y0 >= ty0 - 10 && y1 <= ty1 + 10))]
            );
            Q(`#tier`).replaceChildren(...this.#tiers.content.map(([comp, tiers]) =>
                E(`pre#tier-${comp}`, tiers.map((cutouts, i) => `T${i}: ` + cutouts.map(C => C.label(true))).join('\n'))
            ));
        },
        save: () => Promise.all(this.#tiers.content.map(([comp, tiers]) => 
            DB.get('user', `tier-${comp}`)
            .then(obj => {
                obj = Object.assign(obj ?? {}, ...tiers.map((cutouts, i) => 
                    cutouts.reduce((obj, C) => ({...obj, 
                        [comp == 'CX' ? `${C.identified.subcomp}.${C.identified.abbr}` : C.identified.abbr]: i})
                    , {})
                ));
                return DB.put('user', {[`tier-${comp}`]: obj})
            })
        )).then(() => confirm.innerHTML = '&#xe014;')
    };
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
                this.scores[r * this.C + c] = asset ? Math.min(255, comparer(cutout, asset)) : 255;
        return this;
    }}
    #entries = () => [...this.scores].map((v, i) => ({r: Math.floor(i / this.C), c: i % this.C, v}))
    determine ({from, limit}) {
        this.#entries().sort((a, b) => from == 'min' ? a.v - b.v : b.v - a.v).forEach(({r, c, v}) => {
            if (this.done.rows.has(r) || this.done.cols.has(c) || (from == 'min' ? v > limit : v < limit)) return;
            COLLAGE.cutouts[this.comp][c].identified = Asset.find(r, this.comp); 
            COLLAGE.cutouts[this.comp][c].label();
            this.done.cols.add(c);
            this.done.rows.add(r);
            this.comp == 'bit' && this.done.rows.add(Asset.bit.findIndex(({P}) => P?.abbr == Asset.bit[r].P || P == Asset.bit[r].P.abbr));
        });
        return this;
    }
    order = () => COLLAGE.cutouts[this.comp].forEach((cutout, c) => {
        let scores = [];
        for (let r = 0; r < this.R; r++)
            scores.push({r, v: this.scores[r * this.C + c]});
        cutout.Parts = new Set(scores.sort((a, b) => a.v - b.v).map(({r}) => Asset.find(r, this.comp)).filter(P => P));
    }) ?? this;
}
const App = () => Promise.all([DB.get.essentials({flat: true}), App.worker.session()])
    .then(([Parts]) => {
        Asset.raw = Parts = Object.groupBy(Parts, P => P.path[2] ? P.path[1] : P.constructor.name.toLowerCase());        
        App.events();
        Q(`input[value=${Storage('pref')?.lang || 'hk'}]`).click();
        Q('.loading', el => el.classList.remove('loading'));
    });
Object.assign(App, {
    worker: Comlink.wrap(new Worker('./worker.js', {type: 'module'})),
    state (step, state) {
        if (Array.isArray(step)) return step.forEach(s => App.state(s, state));
        App.steps ??= [...Q('ol').children];
        App.steps[step - 1].classList.toggle('loading', state == 'begun');
        state == 'begun' ?
            App.steps.slice(step).forEach(li => li.classList.add('inactive')) : 
            App.steps[step].classList.remove('inactive');
    },
    autoflow ({dataset: {url}}) {
        Q('input[value=AI]').checked = true;
        new Collage(url).then(() => new Analysis);
    },
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
                    return App.analysis.tiers.save();
                if (ev.target.name == 'mag')
                    return E(Q('div[style]')).set({
                        '--f': E(Q('div[style]')).get('--f') + (ev.target.value == '+' ? .1 : -.1)
                    });
                if (ev.target.name == 'comp') {
                    return Q('.loading') ? 
                        false : COLLAGE.worker.setClasses(App.comp = ev.target.value).then(() => new Analysis);
                }
                if (ev.target.name == 'detect') {
                    if (Q('.loading')) return false;
                    Q('#comp').classList.toggle('inactive', ev.target.value == 'AI');

                    if (ev.target.value == 'AI')
                        return COLLAGE.detect('boxes', true).then(() => new Analysis);
                    Q('#controls').classList.add('active');
                    return COLLAGE.detect('boxes', KNOBS);
                }                
            },
            onchange: ev => {
                ev.target.type == 'file' ? new Collage(ev).then(() => new Analysis) :
                ev.target.name == 'algo' ? Analysis.algo = ev.target.value : '';
            },
        });
        Q('#controls').oninput = ev => {
            KNOBS[ev.target.id] = ev.target.value;
            App.rafID ??= requestAnimationFrame(() => COLLAGE.detect('boxes', KNOBS).then(() => App.rafID = null));
        }
        Collage.cvs.onclick = Collage.select;
        PI.events({'#correct': {scroll: {x: true}}});
    },
});
export default App;