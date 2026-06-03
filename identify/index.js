import DB from "../include/DB.js";
let PARTS;
E.img = src => new Promise(res => E('img', {src, onload: function() {res(this)}, onerror: () => res(null)}));
//asset ready first
const worker = new Worker('worker.js');
class Collage {
    constructor(ev) {
        return E.img(URL.createObjectURL(ev.target.files[0])).then(img => {
            [this.img, Collage.cvs.width, Collage.cvs.height] = [img, img.width, img.height];
            this.draw();
            createImageBitmap(Collage.cvs).then(bitmap => worker.postMessage({collage: bitmap}, [bitmap]));
            return this;
        });
    }
    boxes = new Set();
    draw (cvs = Collage.cvs, ctx = Collage.ctx) {
        ctx.drawImage(this.img, 0, 0);
        let [W, H, pad] = [cvs.width, cvs.height, 4];
        this.boxes.forEach(points => {
            let [x0, y0, x1, y1] = points.split(',');
            let [bx, by] = [Math.max(0, x0 - pad), Math.max(0, y0 - pad)];
            let [bw, bh] = [Math.min(W - bx, x1 - x0 + App.extend * 2), Math.min(H - by, y1 - y0 + App.extend * 2)];
            ctx.strokeStyle = '#ff3366', ctx.lineWidth = Math.max(2, Math.floor(W / 400));
            ctx.strokeRect(bx, by, bw, bh);
        });
    }
    tag ({minX, maxY}, abbr, ctx = Collage.ctx) {
        ctx.font = '20px Arial', ctx.fillStyle = 'blue';
        ctx.fillText(abbr, minX, maxY+20);
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
                    let [w, h] = [bounds.maxX - bounds.minX, bounds.maxY - bounds.minY];
                    w > 25 && h > 25 && w < W * 0.2 && h < H * 0.2 && objects.push(bounds);
                }
            }
        const unnested = [];
        objects.sort((a, b) => ((b.maxX - b.minX) * (b.maxY - b.minY)) - ((a.maxX - a.minX) * (a.maxY - a.minY)))
            .forEach(obj => unnested.every(o => obj.maxX < o.minX || obj.minX > o.maxX || obj.maxY < o.minY || obj.minY > o.maxY) && unnested.push(obj));
        return unnested;
    }
}
Image.calculate = {
    chroluma: ([r,g,b]) => ({
        chroma: Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r)),
        luma: 0.299 * r + 0.587 * g + 0.114 * b
    }),
    boundary (startX, startY, w, h, data, visited) {
        let [minX, maxX, minY, maxY] = [startX, startX, startY, startY];
        let stack = [[startX, startY]];
        while (stack.length > 0) {
            let [cx, cy] = stack.pop(), idx = cy * w + cx;
            if (cx < 0 || cx >= w || cy < 0 || cy >= h || visited[idx]) continue;
            visited[idx] = 1;
            cx < minX && (minX = cx); cx > maxX && (maxX = cx); cy < minY && (minY = cy); cy > maxY && (maxY = cy);
    
            [[cx + App.extend, cy], [cx - App.extend, cy], [cx, cy + App.extend], [cx, cy - App.extend]].forEach(([nx, ny]) => {
                if (!(nx >= 0 && nx < w && ny >= 0 && ny < h)) return;
                let idx = (ny * w + nx) * 4;
                let { chroma, luma } = Image.calculate.chroluma(data.slice(idx, idx + 3));
                (chroma > App.chroma || luma > App.luma_min && luma < App.luma_max) && !visited[ny * w + nx] && stack.push([nx, ny]);
            });
        }
        return { minX, maxX, minY, maxY };
    },
    embedding: (img, i, backdrop) => img && createImageBitmap(img).then(bitmap => new Promise(res => {
        let handler = ({data}) => i === data.i && [worker.removeEventListener('message', handler), res()];
        worker.addEventListener('message', handler);
        worker.postMessage({i, img: bitmap, backdrop}, [bitmap]) 
    }))
}
const App = () => App.model() && DB.get.essentials()
    .then(([_, Parts]) => {
        let flatten = Parts => Parts instanceof O ? [...Parts.values()].map(flatten).flat() : Parts;
        PARTS = flatten(Parts).filter(P => P.constructor.name == 'Bit');
        App.events();
        Q('continuous-knob', knob => knob.dispatchEvent(new InputEvent('input', {bubbles: true})));
        return Promise.all(PARTS.map(P => E.img(`/x/img/${P.path.join('/')}.png`)));
    }).then(imgs => {
        Image.assets = imgs;
        Q('.loading')?.classList.remove('loading');
    }).catch(console.error);

Object.assign(App, {
    results: [],
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
            console.log(App.results.find(([[x, y, width, height]]) =>
                clickX >= x && clickX <= x + width && clickY >= y && clickY <= y + height
            )?.map((r) => r?.[0].abbr));
        };
        Q('#match').onclick = () => App.match();
    },
    bound () {Image.collage.boxes=new Set();
        Image.collage.draw();
        App.detected = Image.detect();
        App.detected.forEach(obj => Image.collage.boxes.add(`${obj.minX},${obj.minY},${obj.maxX},${obj.maxY}`));
        Image.collage.draw();
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
        Promise.all(App.detected.map((box, b) => 
            new Promise(res => {
                let handler = ({data}) => b === data.b && [worker.removeEventListener('message', handler), res(data.result)];
                worker.addEventListener('message', handler);
                worker.postMessage({b, box: [box.minX, box.minY, box.maxX-box.minX, box.maxY-box.minY]}); 
            }).then(result => {
                Image.collage.tag(box, PARTS[result[0].p].abbr);
                App.results.push([[box.minX, box.minY, box.maxX-box.minX, box.maxY-box.minY], ...result.map(({p, score}) => [PARTS[p], score])])
            }))
        ).then(() => console.log(App.results));
        Q('.loading')?.classList.remove('loading');
    }
});
export default App;