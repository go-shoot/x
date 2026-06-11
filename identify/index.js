import DB from "../include/DB.js";
import { Markup } from "../include/utilities.js";
import { Preview } from "../parts/bey.js";
import 'https://cdn.jsdelivr.net/npm/imagehash-web/dist/imagehash-web.min.js';
import PI from 'https://aeoq.github.io/pointer-interaction/script.js';

let PARTS, Controls = {el: Q('#controls')};
//const worker = new Worker('./worker.js');
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
class Collage {
    constructor(ev) {
        App.state(1, 'begun');
        return E.img(typeof ev == 'string' ? ev : URL.createObjectURL(ev.target.files[0]))
        .then(img => {
            [App.collage, this.img, Collage.cvs.width, Collage.cvs.height] = [this, img, img.width, img.height];
            this.draw();
            this.detect();
            App.state(1, 'done');
        });
    }
    draw (boxes, color = 'green', cvs = Collage.cvs, ctx = Collage.ctx) {
        if (!boxes) return ctx.drawImage(this.img, 0, 0);
        let [W, H, pad] = [cvs.width, cvs.height, 4];
        (boxes === true ? this.boxes : boxes).forEach(([x0, y0, x1, y1]) => {
            let [bx, by] = [Math.max(0, x0 - pad), Math.max(0, y0 - pad)];
            let [bw, bh] = [Math.min(W - bx, x1 - x0 + Controls.buffer * 2), Math.min(H - by, y1 - y0 + Controls.buffer * 2)];
            ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, Math.floor(W / 400));
            ctx.strokeRect(bx, by, bw, bh);
        });
    }
    tag ([x0, y0, x1, y1], tag, ctx = Collage.ctx) {
        if (!this.fontSize) {
            let widths =  [...this.boxes].map(points => (([x0, _, x1]) => x1 - x0)(points)).sort((a, b) => a - b);
            let middle = Math.floor(widths.length / 2);
            this.fontSize = Math.max(15, (widths.length % 2 !== 0 ? widths[middle] : (widths[middle - 1] + widths[middle]) / 2) / 4);
        }
        tag = Markup.hktw(Q('input[name=lang]:checked').value, tag);
        ctx.textAlign = 'center';
        let [{width: w}, h, pad] = [ctx.measureText(tag), this.fontSize, this.fontSize/10];
        let [x, y] = [x0 + (x1 - x0)/2, y0 < this.fontSize ? y0 + this.fontSize : y0];
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.fillRect(x - w/2 - pad, y - h + pad*3/4, w + pad*2, h + pad/2);
        ctx.font = `${this.fontSize}px Chiron GoRound TC`; ctx.fillStyle = 'rgb(127,127,127)'; 
        ctx.fillText(tag, x, y - pad/2);
    }
    likelyBackdrop () {
        let counts = [...this.boxes].map(points => Collage.rgba(...points)).reduce((report, rgba) => ({...report, [rgba]: (report[rgba] || 0) + 1}), {});
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 0);
    }
    detect (cvs = Collage.cvs, ctx = Collage.ctx) {
        this.draw();
        const [W, H] = [cvs.width, cvs.height];
        const side = {min: Math.min(W, H) * Controls.side_min/100, max: Math.min(W, H) * Controls.side_max/100};
        const data = ctx.getImageData(0, 0, W, H).data;
        const visited = new Uint8Array(W * H);

        const boxes = [];
        for (let y = 10; y < H - 10; y += 4)
            for (let x = 10; x < W - 10; x += 4) {
                const idx = y * W + x;
                if (visited[idx]) continue;
                let {chroma, luma} = Calculate.chroluma(data.slice(idx*4, idx*4 + 3));
                if (chroma > Controls.chroma || luma > Controls.luma_min && luma < Controls.luma_max) {
                    let {x0, y0, x1, y1, w, h} = Calculate.boundary(x, y, W, H, data, visited);
                    w >= side.min && h >= side.min && w <= side.max && h <= side.max 
                    && boxes.push([x0+1, y0+1, x1+2, y1+2]);
                }
            }
        const unnested = [];
        boxes.sort((a, b) => ((b[2] - b[0]) * (b[3] - b[1])) - ((a[2] - a[0]) * (a[3] - a[1])))
            .forEach(box => unnested.every(b => box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]) && unnested.push(box));
        this.boxes = unnested;
        this.draw(true);
    }
    tiers (x = .02, maxNoise = .03, minLength = .1, H = Collage.cvs.height) {
        [x, maxNoise, minLength] = [Collage.cvs.width * x, Math.floor(H * maxNoise), Math.floor(H * minLength)];
        let data = Collage.ctx.getImageData(x, 0, 1, H).data;
        let sameColor = (y1, y2) => (c2 => data.slice(y1*4, y1*4 + 3).every((v, i) => v === c2[i]))(data.slice(y2*4, y2*4 + 3));
        let [y, tiers] = [0, []];
        while (y < H) {
            let y0 = y;
            while (y < H) {
                if (sameColor(y, y0)) {
                    y++;
                    continue;
                }
                let [noise, resumed] = [0, false];
                for (let ahead = y; ahead < H && noise <= maxNoise; ahead++) {
                    resumed = sameColor(ahead, y0);
                    if (resumed == true) break;
                    noise++;
                }
                if (!resumed || noise > maxNoise) break;
                y += noise;
            }
            y - y0 >= minLength && tiers.push([y0, y]);
        }
        Q('textarea').innerHTML = tiers.map(([ty0, ty1]) => [
            App.results.filter(([[x0, y0, x1, y1]]) => y0 >= ty0 && y1 <= ty1)
            .map(([_, {determ, corrected}]) => corrected || PARTS[App.group][determ].abbr)
        ]).join('<br>');
    }
    static rgba = (x, y) => Collage.ctx.getImageData(x, y, 1, 1).data.join(',');
    static cvs = Q('canvas');
    static ctx = Q('canvas').getContext('2d');
}
const Calculate = {
    chroluma: ([r,g,b]) => ({
        chroma: Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r)),
        luma: 0.299 * r + 0.587 * g + 0.114 * b
    }),
    boundary (x, y, w, h, data, visited) {
        let [x0, x1, y0, y1] = [x, x, y, y];
        let stack = [[x0, y0]], b = Controls.buffer;
        while (stack.length > 0) {
            let [cx, cy] = stack.pop(), idx = cy * w + cx;
            if (cx < 0 || cx >= w || cy < 0 || cy >= h || visited[idx]) continue;
            visited[idx] = true;
            cx < x0 && (x0 = cx); cx > x1 && (x1 = cx); cy < y0 && (y0 = cy); cy > y1 && (y1 = cy);
    
            [[cx+b, cy], [cx-b, cy], [cx, cy+b], [cx, cy-b]/*, [cx+b,cy+b], [cx+b,cy-b], [cx-b,cy+b], [cx-b,cy-b]*/]
            .forEach(([nx, ny]) => {
                if (!(nx >= 0 && nx < w && ny >= 0 && ny < h)) return;
                let idx = (ny * w + nx)*4;
                let { chroma, luma } = Calculate.chroluma(data.slice(idx, idx + 3));
                (chroma > Controls.chroma || luma > Controls.luma_min && luma < Controls.luma_max) && !visited[ny * w + nx] 
                && stack.push([nx, ny]);
            });
        }
        return {x0, y0, x1, y1, w: x1-x0, h: y1-y0};
    },
};
const App = () => DB.get.essentials({flat: true})
    .then(Parts => {
        PARTS = Object.groupBy(Parts, P => P.path[2] ? P.path[1] : P.constructor.name.toLowerCase());
        App.events();
        Q(`input[value=${Storage('pref')?.lang || 'hk'}]`).click();
        Q('continuous-knob', knob => knob.dispatchEvent(new InputEvent('input', {bubbles: true})));
        Q('.loading', el => el.classList.remove('loading'));
    });window.App=App;
Object.assign(App, {
    autoflow: ({dataset: {url, comp, controls}}) => new Collage(url).then(async () => {
            Q(`input[name=comp][value=${comp}]`).checked = true;
            Object.entries(JSON.parse(controls)).forEach(([id, v]) => Q(`#${id}`).set.value({v}));
            return App.flow.prepare();
        }).then(() => App.flow.match())
    ,
    state (step, state) {
        if (Array.isArray(step)) return step.forEach(s => App.state(s, state));
        Q(`ol li:nth-child(${step})`).classList.add('loading');
        if (state == 'done') {
            Q(`ol li:nth-child(${step})`).classList.remove('loading');
            Q(`ol li:nth-child(${step+1})`)?.classList.remove('inactive');
        }
    },
    flow: {
        prepare () {
            App.assets ??= {};
            let checked = Q('input[name=comp]:checked'), backdrop = App.collage.likelyBackdrop();
            let {value: group, title: lastBackdrop} = checked;
            App.group = group;
            if (App.assets[group] && backdrop == lastBackdrop) return Promise.resolve();
            
            App.state(2, 'begun');
            let canvases = PARTS[group].map(P => E.canvas(`/x/img/${P.path.join('/')}.png`, backdrop));
            group == 'bit' && canvases.push(...App.flipped.bit.map(b => E.canvas(`/x/img/bit/${b}.png`, backdrop, true)));
            return Promise.all(canvases.map(prom => 
                prom.then(cvs => cvs ? phash(cvs, 16) : null).then(hash => {
                    E(Q('#step-2')).set({'--p': E(Q('#step-2')).get('--p') + 1}); 
                    return hash ? {hash} : {}
                })
            ))
            .then(hashes => {
                App.assets[group] = hashes;
                checked.title = backdrop;
                App.state([2,3], 'done');
            });
        },
        match () {
            App.state(4, 'begun');
            App.flow.prepare().then(() => App.flow.match.hash()).then(results => {
                App.results = results;
                App.state([4,5], 'done');
            });
        },
    },
    events () {
        Q('form button', button => button.type = 'button');
        Q('nav').onclick = ev => ev.target.dataset.url ? App.autoflow(ev.target) : '';        
        E(Q('main')).set({
            onchange (ev) {
                if (ev.target.type == 'file')
                    return new Collage(ev);
                if (ev.target.name == 'comp' && App.collage) {
                    App.collage.draw(true);
                    App.flow.prepare();
                }
            },
            onclick (ev) {
                Q('aside.active', aside => aside.classList.remove('active'));
                if (ev.target.closest('#step-3'))
                    return Controls.el.classList.toggle('active');
                if (ev.target.id == 'match')
                    return App.flow.match();
                if (ev.target.id == 'download')
                    return E('a', {href: Collage.cvs.toDataURL('image/jpeg'), download: `${App.group}辦認.jpg`}).click();
                if (ev.target.id == 'tier')
                    return App.collage.tiers();
                if (ev.target.name == 'mag')
                    return E(Q('div:has(canvas)')).set({
                        '--f': E(Q('div:has(canvas)')).get('--f') + (ev.target.value == '+' ? .1 : -.1)
                    });
            }
        });
        Controls.el.oninput = ev => (Controls[ev.target.id] = ev.target.value) && App.collage?.detect();
        Collage.cvs.onclick = ev => {
            ev.stopPropagation();
            if (!App.results || !App.results.length) return;
            let {left, top, width, height} = Collage.cvs.getBoundingClientRect();
            let [x, y] = [(ev.clientX - left) * Collage.cvs.width / width, (ev.clientY - top) * Collage.cvs.height / height];
            let b = App.results.findIndex(([[x0, y0, x1, y1]]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
            let {scores, determ, corrected} = App.results[b]?.[1] ?? {};
            if (!determ) return;
            Q('input[name=mode]:checked').value == 'preview' ? 
                App.events.preview(corrected || determ, ev) : App.events.correct(b, scores);
        };
        PI.events({'#correct': {scroll: {x: true}}});
        Q('#correct').onclick = ev => {
            if (!ev.target.matches('img[id]')) return;
            App.results[ev.target.closest('aside').title][1].corrected = ev.target.id;
            console.log(App.results);
            App.collage.draw();
            App.results.forEach(([box, {determ, corrected}]) => App.collage.tag(box, corrected ?? PARTS[App.group][determ].abbr));
        }
    },
    flipped: {bit: ['F','T','B','N','HN','LF']},
    includes: {flipped: i => App.group == 'bit' && i > PARTS.bit.length ? 
        PARTS.bit.find(P => P.abbr == App.flipped.bit[i - PARTS.bit.length]) : PARTS[App.group][i]
    }
});
Object.assign(App.events, {
    correct (b, scores) {
        E(Q('#correct')).set(scores
            .map((s, i) => ({s, i})).sort((a, b) => a.s - b.s)
            .map(({i}) => {
                let P = App.includes.flipped(i);
                return P ? E(`img#${P.abbr}`, {src: `/x/img/${P.path.join('/')}.png`}) : ''
            })
        , {classList: 'active', title: b});
    },
    preview (determ, ev) {
        Q('aside.active', aside => aside.classList.remove('active'));
        if (typeof determ == 'string')
            return new Preview(['cell', 'tile'], {path: PARTS[App.group].find(P => P.abbr == determ).path}, ev);
        let P = App.includes.flipped(determ);
        P && new Preview(['cell', 'tile'], {path: P.path}, ev);
    }
})
Object.assign(App.flow.match, {
    hash: (boxes = App.collage.boxes) => Promise.all(boxes.map(([x0, y0, x1, y1]) => 
        E.canvas({x: x0, y: y0, w: x1-x0, h: y1-y0}).then(cvs => phash(cvs, 16))
    )).then(hashes => 
        new ResultMatrix('hash', hashes, (h1, h2) => h1.hammingDistance(h2), 5, 'low')
        .fromOptimum((r, c) => {
            let P = App.includes.flipped(r);
            App.collage.tag(boxes[c], P.only.name() && Markup.clear(P.names.chi) || P.abbr);
        }, 150).toBoxMap()
    )
});
export default App;
class ResultMatrix {//row: parts  col: boxes
    constructor(prop, values, calculator, threshold, type) {
        this.type = type;
        rows: for (let [r, asset] of App.assets[App.group].entries()) {
            this.data[r] = [];
            if (!asset[prop]) continue rows;
            for (let [c, v] of values.entries()) {
                v = calculator(v, asset[prop]);
                this.data[r].push(v);
                if (type == 'low' && v < threshold || type == 'high' && v > threshold) {
                    this.done.rows.add(r) && this.done.cols.add(c);
                    continue rows;
                }
            }
        }
    }
    data = []
    done = {rows: new Set(), cols: new Set()}
    deterministic = new Map()
    entries = () => this.data.flatMap((cols, r) => cols.map((value, c) => ({r, c, value})))
    fromOptimum (callback, threshold) {
        let sorted = this.entries().sort((a, b) => a.value - b.value);
        sorted.forEach(({ r, c, value: v }) => {
            if (this.done.rows.has(r) || this.done.cols.has(c)) return;
            if (this.type == 'low' && v < threshold || this.type == 'high' && v > threshold) {
                this.deterministic.set(c, r);
                callback(r, c, v);
            }
            this.done.rows.add(r) && this.done.cols.add(c);
        });
        return this;
    }
    toBoxMap = () => App.collage.boxes.map((box, c) => [box, {scores: this.data.map(rows => rows[c]), determ: this.deterministic.get(c)}]);
}
