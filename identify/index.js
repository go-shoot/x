import DB from "../include/DB.js";
import 'https://cdn.jsdelivr.net/npm/imagehash-web/dist/imagehash-web.min.js';

let PARTS;
E.img = src => new Promise(res => E('img', {src, onload: function() {res(this)}, onerror: () => res(null)}));
E.canvas = async (img, bg = 'rgb(246,245,250)') => {
    typeof img == 'string' && (img = await E.img(img));
    let cvs = E('canvas', {width: img.w ?? img.width, height: img.h ?? img.height});
    let ctx = cvs.getContext('2d');
    if (img.x) {
        ctx.drawImage(Image.collage.img, img.x, img.y, img.w, img.h, 0, 0, img.w, img.h);
    } else {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, img.width, img.height);
        ctx.drawImage(img, 0, 0, img.width, img.height);
    }
    return cvs;
}
//asset ready first
const worker = new Worker('worker.js');
class Collage {
    constructor(ev) {
        return E.img(URL.createObjectURL(ev.target.files[0])).then(img => {
            [this.img, Collage.cvs.width, Collage.cvs.height] = [img, img.width, img.height];
            this.draw();
            let colored = cv.imread(img);
            let grayed = new cv.Mat();
            cv.cvtColor(colored, grayed, cv.COLOR_RGBA2GRAY);
            colored.delete();
            this.matrix = grayed;
            //createImageBitmap(Collage.cvs).then(bitmap => worker.postMessage({collage: bitmap}, [bitmap]));
            return this;
        });
    }
    boxes = new Set();
    draw (box, color = 'red', cvs = Collage.cvs, ctx = Collage.ctx) {
        box || ctx.drawImage(this.img, 0, 0);
        let [W, H, pad] = [cvs.width, cvs.height, 4];
        (box ? [box] : this.boxes).forEach(points => {
            let [x0, y0, x1, y1] = points.split(',');
            let [bx, by] = [Math.max(0, x0 - pad), Math.max(0, y0 - pad)];
            let [bw, bh] = [Math.min(W - bx, x1 - x0 + App.extend * 2), Math.min(H - by, y1 - y0 + App.extend * 2)];
            ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, Math.floor(W / 400));
            ctx.strokeRect(bx, by, bw, bh);
        });
    }
    tag ({x0, y0}, abbr, ctx = Collage.ctx) {
        ctx.font = '20px Arial', ctx.fillStyle = 'blue';
        ctx.fillText(abbr, x0, y0);
    }
    likelyBackdrop () {
        let counts = [...this.boxes].map(points => Collage.rgba(...points.split(','))).reduce((report, rgba) => ({...report, [rgba]: (report[rgba] || 0) + 1}), {});
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    }
    static rgba = (x, y) => Collage.ctx.getImageData(x, y, 1, 1).data.join(',');
    static cvs = Q('canvas');
    static ctx = Q('canvas').getContext('2d');
}
const Image = {
    assets: [],
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
                if (chroma > App.chroma || luma > App.luma_min && luma < App.luma_max) {
                    let bounds = Image.calculate.boundary(x, y, W, H, data, visited);
                    let [w, h] = [bounds.x1 - bounds.x0, bounds.y1 - bounds.y0];
                    w > 25 && h > 25 && w < W * 0.2 && h < H * 0.2 && objects.push(bounds);
                }
            }
        const unnested = [];
        objects.sort((a, b) => ((b.x1 - b.x0) * (b.y1 - b.y0)) - ((a.x1 - a.x0) * (a.y1 - a.y0)))
            .forEach(obj => unnested.every(o => obj.x1 < o.x0 || obj.x0 > o.x1 || obj.y1 < o.y0 || obj.y0 > o.y1) && unnested.push(obj));
        return unnested;
    }
}
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
    
            [[cx + App.extend, cy], [cx - App.extend, cy], [cx, cy + App.extend], [cx, cy - App.extend]].forEach(([nx, ny]) => {
                if (!(nx >= 0 && nx < w && ny >= 0 && ny < h)) return;
                let idx = (ny * w + nx) * 4;
                let { chroma, luma } = Image.calculate.chroluma(data.slice(idx, idx + 3));
                (chroma > App.chroma || luma > App.luma_min && luma < App.luma_max) && !visited[ny * w + nx] && stack.push([nx, ny]);
            });
        }
        return { x0, x1, y0, y1, w: x1-x0, h: y1-y0 };
    },
    embedding: (img, i, backdrop) => img && createImageBitmap(img).then(bitmap => new Promise(res => {
        let handler = ({data}) => i === data.i && [worker.removeEventListener('message', handler), res()];
        worker.addEventListener('message', handler);
        worker.postMessage({i, img: bitmap, backdrop}, [bitmap]) 
    }))
}
const App = () => App.model() && DB.get.essentials({flat: true})
    .then(Parts => {
        PARTS = Parts.filter(P => P.constructor.name == 'Bit');
        App.events();
        Q('continuous-knob', knob => knob.dispatchEvent(new InputEvent('input', {bubbles: true})));
        return Promise.all(PARTS.map(P => E.img(`/x/img/${P.path.join('/')}.png`)));
    })
    .then(imgs => Promise.all(imgs.map(async img => {
        if (!img) return {};
        let hash = E.canvas(img).then(cvs => phash(cvs, 16));

        let colored = cv.imread(img), grayed = new cv.Mat(), rgba = new cv.MatVector();
        cv.cvtColor(colored, grayed, cv.COLOR_RGBA2GRAY);
        cv.split(colored, rgba);
        let mask = rgba.get(3);//cv.threshold(mask, mask, 50, 255, cv.THRESH_BINARY);
        colored.delete(); rgba.delete();

        let scale = .6;
        let [w, h] = [Math.floor(grayed.cols * scale), Math.floor(grayed.rows * scale)];
        let resized = {image: new cv.Mat(), mask: new cv.Mat()};
        cv.resize(grayed, resized.image, new cv.Size(w, h), 0, 0, cv.INTER_AREA);
        cv.resize(mask, resized.mask, new cv.Size(w, h), 0, 0, cv.INTER_NEAREST);
        grayed.delete(); mask.delete();

        return {...resized, hash: await hash};
    })))
    .then(assets => {
        console.log(Image.assets = assets);
        Q('.loading')?.classList.remove('loading');
    });

Object.assign(App, {
    model: () => new Promise(res => worker.onmessage = ev => {
        if (ev.data.status !== 'READY') return;
        Q('#match').classList = 'model-ready';
        App.model = true;
        res();
    }),
    events () {
        Q('input[type=file]').onchange = ev => new Collage(ev).then(collage => (Image.collage = collage) && App.bound());
        Q('main').oninput = ev => {
            App[ev.target.id] = ev.target.value;
            App.bound();
        }
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
    bound () {Image.collage.boxes=new Set();
        Image.collage.draw();
        App.detected = Image.detect();
        App.detected.forEach(obj => {
            Image.collage.draw(`${obj.x0},${obj.y0},${obj.x1},${obj.y1}`, 'green');
            Image.collage.boxes.add(`${obj.x0},${obj.y0},${obj.x1},${obj.y1}`);
        });
        let backdrop = Image.collage.likelyBackdrop();
        if (Image.backdrop != backdrop) {
            Image.backdrop = backdrop;
            Q('#match').classList.remove('embed-ready');
            Promise.all(Image.assets.map((img, i) => Image.calculate.embedding(img, i, backdrop)))
            .then(() => Q('#match').classList.add('embed-ready'));
        }
    },
    match () {
        Q('p').classList.add('loading');
        App.results = [];
        //App.match.template();
        App.match.hash(App.detected);
        Q('.loading')?.classList.remove('loading');
    }
});
App.match.template = () => Image.assets.forEach(({image, mask}, i) => {
    if (!image) return;
    let result = new cv.Mat();
    cv.matchTemplate(Image.collage.matrix, image, result, cv.TM_CCOEFF_NORMED, mask);
    let {maxVal, maxLoc} = cv.minMaxLoc(result);
    if (maxVal > .4) {
        App.results.push({
            x: maxLoc.x, y: maxLoc.y, w: image.cols, h: image.rows,
            score: maxVal.toFixed(3),
            src: image.src
        });
        setTimeout(() => {
            Image.collage.draw(`${maxLoc.x},${maxLoc.y},${maxLoc.x+image.cols},${maxLoc.y+image.rows}`);
            Image.collage.tag({x0: maxLoc.x, y0: maxLoc.y}, PARTS[i].abbr);
        });
    }
    console.log(App.results.at(-1));
    result.delete();
});

App.match.hash = boxes => Promise.all(boxes.map(box => 
    E.canvas({x: box.x0, y: box.y0, w: box.w, h: box.h}).then(cvs => phash(cvs, 16))
)).then(hashes => 
    new ResultMatrix('hash', hashes, (h1, h2) => h1.hammingDistance(h2), 5, 'low')
    .fromOptimum((r, c) => Image.collage.tag(boxes[c], PARTS[r].abbr))
);

App.match.model = boxes => Promise.all(boxes.map((box, b) => 
    new Promise(res => {
        let handler = ({data}) => b === data.b && [worker.removeEventListener('message', handler), res(data.result)];
        worker.addEventListener('message', handler);
        worker.postMessage({b, box: [box.x0, box.y0, box.w, box.h]}); 
    }).then(result => {
        Image.collage.tag(box, PARTS[result[0].p].abbr);
        App.results.push([[box.x0, box.y0, box.w, box.h], ...result.map(({p, score}) => [PARTS[p], score])])
    })
));
export default App;
class ResultMatrix {//row: parts  col: boxes
    constructor(prop, values, calculator, threshold, type) {
        rows: for (let [r, asset] of Image.assets.entries()) {
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
    }
    toBoxMap () {
        
    }
}
