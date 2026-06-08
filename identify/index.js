import DB from "../include/DB.js";
import 'https://cdn.jsdelivr.net/npm/imagehash-web/dist/imagehash-web.min.js';

let PARTS, Controls = {};
E.img = src => new Promise(res => E('img', {src, onload: function() {res(this)}, onerror: () => res(null)}));
E.canvas = async (img, bg = 'rgb(246,245,250)') => {
    typeof img == 'string' && (img = await E.img(img));
    if (!img) return;
    let cvs = E('canvas', {width: img.w ?? img.width, height: img.h ?? img.height});
    let ctx = cvs.getContext('2d');
    if (img.x) {
        ctx.drawImage(App.collage.img, img.x, img.y, img.w, img.h, 0, 0, img.w, img.h);
    } else {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, img.width, img.height);
        ctx.drawImage(img, 0, 0, img.width, img.height);
    }
    return cvs;
}
const worker = new Worker('./worker.js', { type: 'module' });
class Collage {
    constructor(ev) {
        return E.img(URL.createObjectURL(ev.target.files[0])).then(img => {
            [this.img, Collage.cvs.width, Collage.cvs.height] = [img, img.width, img.height];
            this.draw();
            return this;
        });
    }
    draw (box, color = 'red', cvs = Collage.cvs, ctx = Collage.ctx) {
        if (!box) return ctx.drawImage(this.img, 0, 0);
        let [W, H, pad] = [cvs.width, cvs.height, 4];
        (box ? [box] : this.boxes).forEach(([x0, y0, x1, y1]) => {
            let [bx, by] = [Math.max(0, x0 - pad), Math.max(0, y0 - pad)];
            let [bw, bh] = [Math.min(W - bx, x1 - x0 + Controls.extend * 2), Math.min(H - by, y1 - y0 + Controls.extend * 2)];
            ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, Math.floor(W / 400));
            ctx.strokeRect(bx, by, bw, bh);
        });
    }
    tag ([x0, y0, x1], abbr, ctx = Collage.ctx) {
        if (!this.fontSize) {
            let widths =  [...this.boxes].map(points => (([x0, _, x1]) => x1 - x0)(points)).sort((a, b) => a - b);
            let middle = Math.floor(widths.length / 2);
            this.fontSize = (widths.length % 2 !== 0 ? widths[middle] : (widths[middle - 1] + widths[middle]) / 2) / 2;
        }
        ctx.font = `${this.fontSize}px Arial`; ctx.fillStyle = 'blue'; ctx.textAlign = "center";
        ctx.fillText(abbr, x0 + (x1 - x0)/2, y0);
    }
    likelyBackdrop () {
        let counts = [...this.boxes].map(points => Collage.rgba(...points)).reduce((report, rgba) => ({...report, [rgba]: (report[rgba] || 0) + 1}), {});
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    }
    detect (cvs = Collage.cvs, ctx = Collage.ctx) {
        let [W, H] = [cvs.width, cvs.height];
        let data = ctx.getImageData(0, 0, W, H).data;
        const visited = new Uint8Array(W * H);
        const objects = [];
    
        for (let y = 10; y < H - 10; y += 4)
            for (let x = Math.floor(W * 0.12); x < W - 10; x += 4) {
                const idx = y * W + x;
                if (visited[idx]) continue;
    
                let {chroma, luma} = Image.calculate.chroluma(data.slice(idx * 4, idx * 4 + 3));
                if (chroma > Controls.chroma || luma > Controls.luma_min && luma < Controls.luma_max) {
                    let [x0, y0, x1, y1] = Image.calculate.boundary(x, y, W, H, data, visited);
                    let [w, h] = [x1 - x0, y1 - y0];
                    w > 25 && h > 25 && w < W * 0.2 && h < H * 0.2 && objects.push([x0, y0, x1, y1]);
                }
            }
        const unnested = [];
        objects.sort((a, b) => ((b[2] - b[0]) * (b[3] - b[1])) - ((a[2] - a[0]) * (a[3] - a[1])))
            .forEach(box => unnested.every(b => box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]) && unnested.push(box));
        this.boxes = unnested;
    }
    static rgba = (x, y) => Collage.ctx.getImageData(x, y, 1, 1).data.join(',');
    static cvs = Q('canvas');
    static ctx = Q('canvas').getContext('2d');
}
const Image = {};
Image.calculate = {
    chroluma: ([r,g,b]) => ({
        chroma: Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r)),
        luma: 0.299 * r + 0.587 * g + 0.114 * b
    }),
    boundary (startX, startY, w, h, data, visited) {
        let [x0, x1, y0, y1] = [startX, startX, startY, startY];
        let stack = [[x0, y0]];
        while (stack.length > 0) {
            let [cx, cy] = stack.pop(), idx = cy * w + cx;
            if (cx < 0 || cx >= w || cy < 0 || cy >= h || visited[idx]) continue;
            visited[idx] = 1;
            cx < x0 && (x0 = cx); cx > x1 && (x1 = cx); cy < y0 && (y0 = cy); cy > y1 && (y1 = cy);
    
            [[cx + Controls.extend, cy], [cx - Controls.extend, cy], [cx, cy + Controls.extend], [cx, cy - Controls.extend]].forEach(([nx, ny]) => {
                if (!(nx >= 0 && nx < w && ny >= 0 && ny < h)) return;
                let idx = (ny * w + nx) * 4;
                let { chroma, luma } = Image.calculate.chroluma(data.slice(idx, idx + 3));
                (chroma > Controls.chroma || luma > Controls.luma_min && luma < Controls.luma_max) && !visited[ny * w + nx] && stack.push([nx, ny]);
            });
        }
        return [x0, y0, x1, y1];
    },
}
const App = () => DB.get.essentials({flat: true})
    .then(Parts => {
        PARTS = Object.groupBy(Parts, P => P.path[2] ? P.path[1] : P.constructor.name.toLowerCase());
        App.events();
        Q('continuous-knob', knob => knob.dispatchEvent(new InputEvent('input', {bubbles: true})));
        App.prepare('bit');
        //worker.postMessage({assets: PARTS.map(P => `/x/img/${P.path.join('/')}.png`)});
    })

Object.assign(App, {
    prepare (group) {
        App.group = group; App.assets ??= {};
        if (App.assets[group]) return;
        Q('summary').classList.add('loading');
        return Promise.all(
            PARTS[group].map(P => E.canvas(`/x/img/${P.path.join('/')}.png`).then(async cvs => cvs ? {hash: await phash(cvs, 16)} : {}))
        ).then(hashes => {
            App.assets[group] = hashes;
            Q('.loading')?.classList.remove('loading');
        });
    },
    events () {
        Q('form button', button => button.type = 'button');
        Q('input[type=file]').onchange = ev => new Collage(ev).then(collage => (App.collage = collage) && App.bound());
        Q('main').oninput = ev => {
            Controls[ev.target.id] = ev.target.value;
            App.collage && App.bound();
        }
        Q('main').onchange = ev => App.prepare(ev.target.value);
        Collage.cvs.onclick = ev => {
            let rect = ev.target.getBoundingClientRect();
            let clickX = (ev.clientX - rect.left) * (ev.target.width / rect.width);
            let clickY = (ev.clientY - rect.top) * (ev.target.height / rect.height);
            console.log(App.results.find(([[x0, y0, x1, y1]]) =>
                clickX >= x0 && clickX <= x1 && clickY >= y0 && clickY <= y1
            ));
        };
        Q('#match').onclick = () => App.match();
    },
    bound () {
        App.collage.draw();
        App.collage.detect();
        App.collage.boxes.forEach(box => App.collage.draw(box, 'green'));
    },
    match () {
        Q('summary').classList.add('loading');
        App.results = [];
        App.match.hash();
        Q('.loading')?.classList.remove('loading');
    }
});
App.match.hash = (boxes = App.collage.boxes) => Promise.all(boxes.map(([x0, y0, x1, y1]) => 
    E.canvas({x: x0, y: y0, w: x1-x0, h: y1-y0}).then(cvs => phash(cvs, 16))
)).then(hashes => 
    App.collage.results = new ResultMatrix('hash', hashes, (h1, h2) => h1.hammingDistance(h2), 5, 'low')
    .fromOptimum((r, c) => App.collage.tag(boxes[c], PARTS[App.group][r].abbr)).toBoxMap()
);
export default App;
class ResultMatrix {//row: parts  col: boxes
    constructor(prop, values, calculator, threshold, type) {
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
    done = {rows: new Set(), cols: new Set()};
    entries = () => this.data.flatMap((cols, r) => cols.map((value, c) => ({r, c, value})))
    fromOptimum (callback) {
        let sorted = this.entries().sort((a, b) => a.value - b.value);
        sorted.forEach(({ r, c, value }) => {
            if (this.done.rows.has(r) || this.done.cols.has(c)) return;
            callback(r, c, value);
            this.done.rows.add(r) && this.done.cols.add(c);
        });
        return this;
    }
    toBoxMap = () => new Map(App.collage.boxes.map((box, c) => [
        box,
        this.data.map((rows, r) => ({r, value: rows[c]})).sort((a, b) => a.value - b.value).slice(0, 5).map(({r}) => PARTS[App.group][r].abbr)
    ]));
}
