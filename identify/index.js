import DB from "../include/DB.js";
import { Markup } from "../include/utilities.js";
import { Preview } from "../parts/bey.js";
import 'https://cdn.jsdelivr.net/npm/imagehash-web/dist/imagehash-web.min.js';

let PARTS, Controls = {el: Q('#controls')};
E.img = src => new Promise(res => E('img', {
    src, crossOrigin: 'anonymous', referrerPolicy: 'no-referrer', 
    onload: function() {res(this)}, onerror: () => res(null)
}));
E.canvas = async (img, bg = '246,245,250', flip) => {
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
const worker = new Worker('./worker.js');
class Collage {
    constructor(ev) {
        App.state(1, 'begin');
        return E.img(typeof ev == 'string' ? ev : URL.createObjectURL(ev.target.files[0]))
        .then(img => {
            [this.img, Collage.cvs.width, Collage.cvs.height] = [img, img.width, img.height];
            this.draw();
            App.collage = this;
            App.bound();
            App.state(1, 'done');
        });
    }
    draw (box, color = 'green', cvs = Collage.cvs, ctx = Collage.ctx) {
        if (!box) return ctx.drawImage(this.img, 0, 0);
        let [W, H, pad] = [cvs.width, cvs.height, 4];
        (box === true ? this.boxes : [box]).forEach(([x0, y0, x1, y1]) => {
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
        let [{width: w}, h, pad] = [ctx.measureText(tag), this.fontSize, 2];
        let [x, y] = [x0 + (x1 - x0)/2, y0 < this.fontSize ? y0 + this.fontSize : y0];
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.fillRect(x - w/2 - pad, y - h + pad/2, w + pad*2, h + pad);
        ctx.font = `${this.fontSize}px Chiron GoRound TC`; ctx.fillStyle = 'rgb(127,127,127)'; 
        ctx.fillText(tag, x, y - pad/2);
    }
    likelyBackdrop () {
        let counts = [...this.boxes].map(points => Collage.rgba(...points)).reduce((report, rgba) => ({...report, [rgba]: (report[rgba] || 0) + 1}), {});
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    }
    detect (cvs = Collage.cvs, ctx = Collage.ctx) {
        const [W, H] = [cvs.width, cvs.height];
        const side = {min: Math.min(W, H) * Controls.side_min/100, max: Math.min(W, H) * Controls.side_max/100};
        const data = ctx.getImageData(0, 0, W, H).data;
        const visited = new Uint8Array(W * H);

        const boxes = [];
        for (let y = 10; y < H - 10; y += 4)
            for (let x = 1; x < W - 10; x += 4) {
                const idx = y * W + x;
                if (visited[idx]) continue;
                let {chroma, luma} = Calculate.chroluma(data.slice(idx * 4, idx * 4 + 3));
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
                let idx = (ny * w + nx) * 4;
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
    });
Object.assign(App, {
    autoflow: ({dataset: {url, comp, ...controls}}) => new Collage(url).then(async () => {
            Q(`input[name=comp][value=${comp}]`).checked = true;
            Object.entries(controls).forEach(([id, v]) => Q(`#${id}`).set.value({v: parseFloat(v)}));
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
            
            App.state(2, 'begin');
            let canvases = PARTS[group].map(P => E.canvas(`/x/img/${P.path.join('/')}.png`, backdrop));
            group == 'bit' && canvases.push(...App.flipped.bit.map(b => E.canvas(`/x/img/bit/${b}.png`, backdrop, true)));
            return Promise.all(canvases.map(prom => prom.then(async cvs => cvs ? {hash: await phash(cvs, 16)} : {})))
            .then(hashes => {
                App.assets[group] = hashes;
                checked.title = backdrop;
                App.state([2,3], 'done');
            });
        },
        match () {
            App.state(4, 'begin');
            App.flow.prepare().then(() => App.flow.match.hash()).then(results => {
                App.results = results;
                App.state(4, 'done');
            });
        },
    },
    events () {
        Q('form button', button => button.type = 'button');
        Q('nav').onclick = ev => {
            if (ev.target.dataset.url)
                return App.autoflow(ev.target);
            if (ev.target.id == 'download')
                return E('a', {
                    href: Collage.cvs.toDataURL("image/jpeg"),
                    download: `${App.group}辦認.jpg`
                }).click();
        }
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
                if (ev.target.name == 'mag')
                    return E(Q('div:has(canvas)')).set({
                        '--f': E(Q('div:has(canvas)')).get('--f') + (ev.target.value == '+' ? .1 : -.1)
                    });
                if (ev.target.closest('#adjust'))
                    return Controls.el.classList.toggle('active');
                if (ev.target.id == 'match') {
                    Controls.el.classList.remove('active');
                    App.flow.match();
                }
            }
        });
        Controls.el.oninput = ev => (Controls[ev.target.id] = ev.target.value) && App.bound();
        Collage.cvs.onclick = ev => {
            if (!App.results || !App.results.length) return;
            let rect = ev.target.getBoundingClientRect();
            let x = (ev.clientX - rect.left) * ev.target.width / rect.width;
            let y = (ev.clientY - rect.top) * ev.target.height / rect.height;
            let [box, {scores, determ}] = App.results.find(([[x0, y0, x1, y1]]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
            //App.events.preview(determ, ev);
            App.events.correct(box, scores);
        };
    },
    bound () {
        if (!App.collage) return;
        App.collage.draw();
        App.collage.detect();
        App.collage.boxes.forEach(box => App.collage.draw(box, 'green'));
    },
    flipped: {bit: ['F','T','B','N','HN','LF']}
});
Object.assign(App.events, {
    correct (box, scores, ev) {
        console.log(scores.map((s, i) => ({s, i})).sort((a, b) => a.s - b.s).map(({i}) => PARTS[App.group][i]));
    },
    preview (determ, ev) {
        let P = App.group == 'bit' && determ > PARTS.bit.length ? 
        PARTS.bit.find(P => P.abbr == App.flipped.bit[determ - PARTS.bit.length]) :
        PARTS[App.group][determ];
        new Preview(['cell', 'tile'], {path: P.path}, ev);
    }
})
Object.assign(App.flow.match, {
    hash: (boxes = App.collage.boxes) => Promise.all(boxes.map(([x0, y0, x1, y1]) => 
        E.canvas({x: x0, y: y0, w: x1-x0, h: y1-y0}).then(cvs => phash(cvs, 16))
    )).then(hashes => 
        new ResultMatrix('hash', hashes, (h1, h2) => h1.hammingDistance(h2), 5, 'low')
        .fromOptimum((r, c) => {
            let P = PARTS[App.group][r];
            let tag = App.group == 'bit' && r >= PARTS.bit.length ? 
                App.flipped.bit[r - PARTS.bit.length] : 
                P.only.name() && Markup.clear(P.names.chi) || P.abbr;            
            App.collage.tag(boxes[c], tag);
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
