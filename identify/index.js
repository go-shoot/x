import DB from "../include/DB.js";
import { Markup } from "../include/utilities.js";
import { Preview } from "../parts/bey.js";
import 'https://cdn.jsdelivr.net/npm/imagehash-web/dist/imagehash-web.min.js';
import PI from 'https://aeoq.github.io/pointer-interaction/script.js';
import * as Comlink from "https://unpkg.com/comlink/dist/esm/comlink.mjs";

let PARTS, Controls = {el: Q('#controls')};
Object.assign(E, {
    img: src => new Promise(res => E('img', {
        src, crossOrigin: 'anonymous', referrerPolicy: 'no-referrer', 
        onload: function() {res(this)}, onerror: () => res(null)
    })),
    canvas: async (img, bg = '246,245,250', flip) => {
        typeof img == 'string' && (img = await E.img(img));
        if (!img) return;
        let cvs = E('canvas', {width: img.w ?? img.width, height: img.h ?? img.height});
        let ctx = cvs.getContext('2d');
        if (img instanceof Node) {
            ctx.fillStyle = `rgba(${bg}`;
            ctx.fillRect(0, 0, img.width, img.height);
            if (flip) {
                ctx.translate(img.width, 0);
                ctx.scale(-1, 1);
            }
            ctx.drawImage(img, 0, 0, img.width, img.height);
        } else
            ctx.drawImage(App.collage.img, img.x, img.y, img.w, img.h, 0, 0, img.w, img.h);
        return cvs;
    }
});
let COLLAGE;
const WorkerCollage = Comlink.wrap(new Worker('./worker.js', {type: 'module'}));
class Collage {
    constructor(ev) {
        App.state(1, 'begun');
        return E.img(typeof ev == 'string' ? ev : URL.createObjectURL(ev.target.files[0]))
            .then(createImageBitmap)
            .then(img => {
                let cvs = Collage.transferred ? null : Collage.cvs.transferControlToOffscreen();
                Collage.transferred = true;
                WorkerCollage.take((({el, ...values}) => values)(Controls));
                return new WorkerCollage(cvs ? Comlink.transfer(cvs, [cvs]) : null, img);
            }).then(collage => {
                COLLAGE = collage;
                App.state([1,2], 'done');
                App.comp && App.state(3, 'done');
                Q('input[type=file]').value = '';
            });
    }
    static cvs = Q('canvas');
    static select = ev => {
        ev.stopPropagation();
        if (!Analysis.results || !Analysis.results.boxes.length) return;
        let {left, top, width, height} = Collage.cvs.getBoundingClientRect();
        let [x, y] = [(ev.clientX - left) * Collage.cvs.width / width, (ev.clientY - top) * Collage.cvs.height / height];
        Analysis.results.box([x, y])?.[Q('input[name=mode]:checked').value](ev);
    }
}
const App = () => DB.get.essentials({flat: true})
    .then(async Parts => {
        PARTS = Object.groupBy(Parts, P => P.path[2] ? P.path[1] : P.constructor.name.toLowerCase());        
        App.events();
        Q(`input[value=${Storage('pref')?.lang || 'hk'}]`).click();
        Q('continuous-knob', knob => knob.dispatchEvent(new InputEvent('input', {bubbles: true})));
        Q('.loading', el => el.classList.remove('loading'));
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
    autoflow: ({dataset: {url, comp, controls}}) => {
        Object.entries(JSON.parse(controls)).forEach(([id, v]) => Q(`#${id}`).set.value({v}));
        Q(`input[name=comp][value=${comp}]`).checked = true;
        return new Collage(url).then(() => new Analysis());
    },
    events () {
        Q('form button', button => button.type = 'button');
        E(Q('nav')).set({
            onclick: ev => ev.target.dataset.url ? App.autoflow(ev.target) : '',
            onchange: () => Analysis.results?.label()
        });      
        E(Q('main')).set({
            onchange: ev => ev.target.type == 'file' ? new Collage(ev) :
                ev.target.name == 'comp' ? (App.collage?.draw(true), App.state(3, 'done')) : ''    
            ,
            onclick (ev) {
                Q('aside.active', aside => aside.classList.remove('active'));
                if (ev.target.closest('#step-2'))
                    return Controls.el.classList.toggle('active');
                if (ev.target.id == 'match')
                    return new Analysis();
                if (ev.target.id == 'download')
                    return E('a', {href: Collage.cvs.toDataURL('image/jpeg'), download: `${App.comp}辦認.jpg`}).click();
                if (ev.target.id == 'tier')
                    return App.events.tiers();
                if (ev.target.name == 'mag')
                    return E(Q('div:has(canvas)')).set({
                        '--f': E(Q('div:has(canvas)')).get('--f') + (ev.target.value == '+' ? .1 : -.1)
                    });
            }
        });
        Controls.el.oninput = ev => {
            Analysis.results = null;
            Controls[ev.target.id] = ev.target.value;
            App.rafID ??= requestAnimationFrame(async () => {
                await WorkerCollage.take((({el, ...values}) => values)(Controls));
                await COLLAGE?.detect.boxes();                
                App.rafID = null;
            });
        }
        Collage.cvs.onclick = Collage.select;
        PI.events({'#correct': {scroll: {x: true}}});
    },
    flipped: {bit: ['F','T','B','N','HN','LF']},
    includes: {flipped: i => App.comp == 'bit' && i > PARTS.bit.length ? 
        PARTS.bit.find(P => P.abbr == App.flipped.bit[i - PARTS.bit.length]) : PARTS[App.comp][i]
    }
});
Object.assign(App.events, {
    tiers: async () => Q('textarea').innerHTML = (await COLLAGE.detect.tiers()).map(([ty0, ty1]) => [
        Analysis.results.filter(({x0, y0, x1, y1}) => y0 >= ty0 - 5 && y1 <= ty1 + 5)
        .map(({determ, corrected}) => (corrected || determ).abbr)
    ]).join('<br>')
});
class Analysis {
    constructor() {
        App.state(4, 'begun');
        App.assets ??= {};
        let {value: comp, title: lastBackdrop} = Q('input[name=comp]:checked');
        App.comp = comp;
        return COLLAGE.detect.backdrop()
            .then(backdrop => Promise.all([
                this.prepare.cutouts(),
                !App.assets[comp] || backdrop != lastBackdrop ? this.prepare.assets(backdrop) : undefined,
            ]))
            .then(hashes => this.match.by.hash(...hashes))
            .then(result => (Analysis.results = result) && App.state([4,5], 'done'));
    }
    prepare = {
        assets: async (backdrop, comp = App.comp) => {
            App.state(3, 'begun');
            let canvases = PARTS[comp].map(P => E.canvas(`/x/img/${P.path.join('/')}.png`, backdrop));
            comp == 'bit' && canvases.push(...App.flipped.bit.map(b => E.canvas(`/x/img/bit/${b}.png`, backdrop, true)));
            let hashes = await Promise.all(canvases.map(prom => 
                prom.then(cvs => cvs && phash(cvs, 16)).then(hash => (App.state(3, '++'), hash))
            ));
            Q('input[name=comp]:checked').title = backdrop;
            App.state(3, 'done');
            return App.assets[comp] = hashes.map(hash => hash ? {hash} : {});
        },
        cutouts: () => COLLAGE.cutouts().then(bmps => Promise.all(bmps.map(bmp => {
            let cvs = E('canvas', {width: bmp.width, height: bmp.height});
            cvs.getContext('2d').drawImage(bmp, 0, 0, bmp.width, bmp.height);
            return phash(cvs, 16);
        })))
    }
    match = {by: {
        hash: (...hashes) => new ResultMatrix(...hashes)
            .compare('hash', (h1, h2) => h1.hammingDistance(h2)).label.from('min', 130).to.results()
    }}
}
export default App;
class ResultMatrix { //row: parts, col: boxes
    constructor(cutoutHashes, assetHashes = App.assets[App.comp]) {
        [this.R, this.C] = [assetHashes.length, cutoutHashes.length];
        [this.assetHashes, this.cutoutHashes] = [assetHashes, cutoutHashes];
        this.scores = new Uint8Array(this.R * this.C).fill(255);
        this.done = {rows: new Set()};
        this.deterministic = new Map();
    }
    compare (prop, comparer) {
        for (let [r, asset] of this.assetHashes.entries()) {
            if (!asset[prop]) continue;
            for (let [c, v] of this.cutoutHashes.entries())
                this.scores[r * this.C + c] = Math.min(255, comparer(v, asset[prop]));
        }
        return this;
    }
    entries = () => [...this.scores].map((v, i) => ({r: Math.floor(i / this.C), c: i % this.C, v}))
    label = {from: (optimum, limit) => {
        this.entries().sort((a, b) => optimum == 'min' ? a.v - b.v : b.v - a.v).forEach(({r, c, v}) => {
            if (this.done.rows.has(r) || this.deterministic.has(c) || (optimum == 'min' ? v > limit : v < limit)) return;
            Results.label(c, r);
            this.deterministic.set(c, r);
            this.done.rows.add(r);
        });
        return this;
    }}
    to = {results: () => new Results(this)}
}
class Results {
    constructor(matrix) {
        COLLAGE.boxes.then(boxes => this.boxes = boxes.map(([x0, y0, x1, y1], c) => {
            let scores = [];
            for (let r = 0; r < matrix.R; r++)
                scores.push({r, v: matrix.scores[r * matrix.C + c]});
            return {
                x0, y0, x1, y1,
                Parts: new Set(scores.sort((a, b) => a.v - b.v).map(({r}) => App.includes.flipped(r)).filter(P => P)), 
                determ: PARTS[App.comp][matrix.deterministic.get(c)]
            };
        }));
    }
    box(i) {
        let box;
        if (Array.isArray(i)) {
            let [x, y] = i;
            box = this.boxes.find(({x0, y0, x1, y1}) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
        } else
            box = this.boxes[i];
        if (!box) return;
        let actions = {
            correct: ev => {
                if (ev.target == Collage.cvs) {
                    return E(Q('#correct')).set(
                        [E('button', '🚫'), ...[...box.Parts].map(P => Object.assign(E(`img`, {src: `/x/img/${P.path.join('/')}.png`}), {Part: P}))], 
                        {classList: 'active', onclick: actions.correct}
                    );
                }
                if (!ev.target.Part) return;
                box.corrected = ev.target.Part;
                COLLAGE.draw(true);
                this.label();
            },
            preview: ev => {
                Q('aside.active', aside => aside.classList.remove('active'));
                return new Preview(['cell', 'tile'], {path: (box.corrected || box.determ).path}, ev);
            },
        };
        return actions;
    }
    label = () => this.boxes.forEach(({x0, y0, x1, y1, determ, corrected}) => 
        Results.label([x0, y0, x1, y1], corrected || determ)
    );
    static label (box, rP, lang = Q('input[name=lang]:checked').value) {
        typeof rP == 'number' && (rP = App.includes.flipped(rP));
        let label = Markup.hktw(lang, rP?.only.name() && Markup.clear(rP.names.chi) || rP?.abbr);
        rP && label && COLLAGE.label(box, label);
    }
}
