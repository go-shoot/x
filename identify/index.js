import DB from "../include/DB.js";
import { Markup } from "../include/utilities.js";
import { Preview } from "../parts/bey.js";
import 'https://cdn.jsdelivr.net/npm/imagehash-web/dist/imagehash-web.min.js';
import PI from 'https://aeoq.github.io/pointer-interaction/script.js';
import * as Comlink from "https://unpkg.com/comlink/dist/esm/comlink.mjs";

let PARTS, Controls = {};
Object.assign(E, {
    img: src => new Promise(res => E('img', {
        src, crossOrigin: 'anonymous', referrerPolicy: 'no-referrer', 
        onload: function() {res(this)}, onerror: () => res(null)
    })),
    canvas: async (img, change) => {
        if (!img) return;
        let cvs = img.tagName == 'CANVAS' ? img : E('canvas', {width: img.width, height: img.height});
        let ctx = cvs.getContext('2d');
        img.tagName == 'CANVAS' && (img = img.nextElementSibling);
        typeof change == 'string' && (ctx.fillStyle = `rgba(${change})`);
        ctx.fillRect(0, 0, img.naturalWidth, img.naturalHeight);
        if (change === true) {
            ctx.translate(img.naturalWidth, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
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
                WorkerCollage.take(Controls);
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
        if (!Analysis.result || !Analysis.result.boxes.length) return;
        let {left, top, width, height} = Collage.cvs.getBoundingClientRect();
        let [x, y] = [(ev.clientX - left) * Collage.cvs.width / width, (ev.clientY - top) * Collage.cvs.height / height];
        Analysis.result.box([x, y])?.[Q('input[name=mode]:checked').value](ev);
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
    createCanvasImg: (P, flipped) => 
        E.img(`/x/img/${typeof P == 'object' ? P.path.join('/') : `bit/${P}`}.png`)
        .then(img => Promise.all([E.canvas(img, flipped), Object.assign(img, flipped ? {classList: 'flipped'} : {})]))
    ,
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
        Q(`input[name=comp][value=${comp}]`).click();
        return new Collage(url).then(() => new Analysis());
    },
    events () {
        Q('form button', button => button.type = 'button');
        E(Q('nav')).set({
            onclick: ev => ev.target.dataset.url ? App.autoflow(ev.target) : '',
            onchange: () => Analysis.result?.label()
        });      
        E(Q('main')).set({
            onchange (ev) {
                if (ev.target.type == 'file') 
                    return new Collage(ev);
                if (ev.target.name == 'algo')
                    return Analysis.algo = ev.target.value;
                if (ev.target.name == 'comp') {
                    App.comp = ev.target.value;
                    App.state(3, 'done');
                    let pairs = PARTS[App.comp].map(P => App.createCanvasImg(P));
                    App.comp == 'bit' && pairs.push(...App.flipped.bit.map(abbr => App.createCanvasImg(abbr, true)));
                    Promise.all(pairs).then(pairs => Q('#correct').replaceChildren(
                        E('label>input', {type: 'radio', name: 'correction'}), 
                        ...pairs.map((pair, i) => Object.assign(
                            E('label', [E('input', {type: 'radio', name: 'correction', value: i}), ...pair])
                        , {Part: PARTS[App.comp][i]}))
                    ));
                }    
            },
            onclick (ev) {
                Q('aside.active', aside => aside.classList.remove('active'));
                if (ev.target.closest('#step-2'))
                    return Q('#controls').classList.toggle('active');
                if (ev.target.id == 'match')
                    return new Analysis();
                if (ev.target.id == 'download')
                    return gtag('event', 'IDENTIFY-DOWNLOAD') || 
                    E('a', {href: Collage.cvs.toDataURL('image/jpeg'), download: `${App.comp}辦認.jpg`}).click();
                if (ev.target.matches('[id|=tier]'))
                    return App.events.tiers(ev);
                if (ev.target.name == 'mag')
                    return E(Q('div:has(canvas)')).set({
                        '--f': E(Q('div:has(canvas)')).get('--f') + (ev.target.value == '+' ? .1 : -.1)
                    });
            }
        });
        Q('#controls').oninput = ev => {
            Analysis.result = null;
            Controls[ev.target.id] = ev.target.value;
            App.rafID ??= requestAnimationFrame(async () => {
                await WorkerCollage.take(Controls);
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
    tiers (ev) {
        let [textarea, confirm] = [Q('textarea'), Q('#tier-confirm')];
        if (ev.target.id == 'tier-list')
            return COLLAGE.detect.tiers().then(tiers => {
                textarea.value = tiers.map(([ty0, ty1], i) => `T${i*.5}: ` + [
                    Analysis.result.boxes.filter(({y0, y1}) => y0 >= ty0 - 5 && y1 <= ty1 + 5)
                    .map(({determ, corrected}) => (corrected || determ)?.abbr)
                ]).join('\n');
                textarea.hidden = false;
            });
        try {
            let obj = textarea.value.split('\n').map((str, i) => 
                str.split(':')[1].split(',').filter(a => a).reduce((obj, abbr) => ({ ...obj, [abbr.trim()]: i }), {})
            ).reduce((outer, inner) => ({ ...outer, ...inner }), {});
            DB.put('user', {[`tier-${App.comp}`]: obj})
            .then(() => (confirm.innerHTML = '&#xe014;') && setTimeout(() => confirm.innerHTML = '確認', 1000));
        }
        catch (er) {
            (confirm.innerHTML = '格式錯誤') && setTimeout(() => confirm.innerHTML = '確認', 1000)
        }
    }
});
class Analysis {
    constructor(comp = App.comp, lastBackdrop = Q('input[name=comp]:checked').title) {
        App.state(4, 'begun');
        App.assets ??= {};
        return COLLAGE.detect.backdrop()
            .then(backdrop => Promise.all([
                this.prepare.cutouts(),
                !App.assets[comp] || backdrop != lastBackdrop ? this.prepare.assets(backdrop) : undefined,
            ]))
            .then(hashes => this.match.by.hash(...hashes))
            .then(result => (Analysis.result = result) && App.state([4,5], 'done'))
            .catch(er => console.error(er) || Q('.loading', [])[0]?.append(`${er}`));
    }
    prepare = {
        assets: (backdrop, comp = App.comp) => {
            App.state(3, 'begun');
            return Promise.all(Q('#correct input[value]', []).sort((a, b) => a.value - b.value).map(input => 
                E.canvas(input.labels[0].Q('canvas'), backdrop)
                .then(cvs => cvs && window[Analysis.algo](cvs, 16))
                .then(hash => (App.state(3, '++'), hash))
            )).then(hashes => {
                Q('input[name=comp]:checked').title = backdrop;
                Q('#correct').style.background = `rgba(${backdrop})`;
                App.state(3, 'done');
                return App.assets[comp] = hashes.map(hash => hash ? {hash} : {});
            });
        },
        cutouts: () => COLLAGE.cutouts().then(bmps => Promise.all(bmps.map(bmp => {
            let cvs = E('canvas', {width: bmp.width, height: bmp.height});
            cvs.getContext('2d').drawImage(bmp, 0, 0, bmp.width, bmp.height);
            return window[Analysis.algo](cvs, 16);
        })))
    }
    match = {by: {
        hash: (...hashes) => new ScoreMatrix(...hashes)
            .compare('hash', (h1, h2) => h1.hammingDistance(h2)).label.from('min', 130).to.result()
    }}
    static algo = Q('input[name=algo]:checked').value
}
export default App;
class ScoreMatrix { //row: parts, col: boxes
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
        COLLAGE.draw(true);
        this.entries().sort((a, b) => optimum == 'min' ? a.v - b.v : b.v - a.v).forEach(({r, c, v}) => {
            if (this.done.rows.has(r) || this.deterministic.has(c) || (optimum == 'min' ? v > limit : v < limit)) return;
            Result.label(c, r);
            this.deterministic.set(c, r);
            this.done.rows.add(r);
        });
        return this;
    }}
    to = {result: () => new Result(this)}
}
class Result {
    constructor(matrix) {
        COLLAGE.boxes.then(boxes => this.boxes = boxes.map(([x0, y0, x1, y1], c) => {
            let scores = [];
            for (let r = 0; r < matrix.R; r++)
                scores.push({r, v: matrix.scores[r * matrix.C + c]});
            return {
                x0, y0, x1, y1,
                Parts: new Set(scores.sort((a, b) => a.v - b.v).map(({r}) => App.includes.flipped(r)).filter(P => P)), 
                determ: App.includes.flipped(matrix.deterministic.get(c))
            };
        }));
    }
    box (i) {
        let box = Array.isArray(i) ?
            this.boxes.find(({x0, y0, x1, y1}) => i[0] >= x0 && i[0] <= x1 && i[1] >= y0 && i[1] <= y1) :
            this.boxes[i];
        return box ? this.actions(box) : null;
    }
    actions = box => ({
        correct: ev => {
            if (ev.target != Collage.cvs) {
                box.corrected = ev.target.labels[0].matches(':first-child') ? '' : ev.target.labels[0].Part;
                COLLAGE.draw(true);
                Q('#tier-list')?.click();
                return gtag('event', 'IDENTIFY-CORRECT') || this.label();
            }
            let aside = Q('#correct');
            [...aside.children].find((label, i) => 
                box.corrected === '' ? i === 0 : label.Part == (box.corrected ?? box.determ)
            ).Q('input').checked = true;
            return E(aside).set(
                [...aside.children].sort((...labels) => 
                    [...box.Parts].indexOf(labels[0].Part) - [...box.Parts].indexOf(labels[1].Part)
                ),
                {classList: 'active', onchange: this.actions(box).correct}
            );
        },
        preview: ev => {
            if (box.corrected === '') return;
            Q('aside.active', aside => aside.classList.remove('active'));
            return new Preview(['cell', 'tile'], {path: (box.corrected ?? box.determ).path}, ev);
        }
    })
    label = () => this.boxes.forEach(({x0, y0, x1, y1, determ, corrected}) => 
        Result.label([x0, y0, x1, y1], corrected ?? determ)
    )
    static label (box, rP, lang = Q('input[name=lang]:checked').value) {
        typeof rP == 'number' && (rP = App.includes.flipped(rP));
        let label = rP ? Markup.hktw(lang, rP?.only.name() && Markup.clear(rP.names.chi) || rP?.abbr) : '';
        COLLAGE.label(box, label);
    }
}
