import DB from "../include/DB.js";
let PARTS;
E.img = src => new Promise(res => E('img', {src, onload: function() {res(this)}, onerror: () => res(null)}));

const worker = new Worker('worker.js');
const Image = {
    collage: {
        matrix: null,
        canvas: Q('canvas'),
        background: Q('input[type=color]').value,
    },
    chroluma: ([r,g,b]) => ({
        chroma: Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r)),
        luma: 0.299 * r + 0.587 * g + 0.114 * b
    }),
    floodFillExpand: (startX, startY, w, h, data, visited) => {
        let [minX, maxX, minY, maxY] = [startX, startX, startY, startY];
        let stack = [[startX, startY]];
        while (stack.length > 0) {
            let [cx, cy] = stack.pop(), idx = cy * w + cx;
            if (cx < 0 || cx >= w || cy < 0 || cy >= h || visited[idx]) continue;
            visited[idx] = 1;
            cx < minX && (minX = cx); cx > maxX && (maxX = cx); cy < minY && (minY = cy); cy > maxY && (maxY = cy);
    
            [[cx + 4, cy], [cx - 4, cy], [cx, cy + 4], [cx, cy - 4]].forEach(([nx, ny]) => {
                if (!(nx >= 0 && nx < w && ny >= 0 && ny < h)) return;
                let idx = (ny * w + nx) * 4;
                let { chroma, luma } = Image.chroluma(data.slice(idx, idx + 3));
                (chroma > App.chroma || luma > App.luma_min && luma < App.luma_max) && !visited[ny * w + nx] && stack.push([nx, ny]);
            });
        }
        return { minX, maxX, minY, maxY };
    },
    tag: ({minX, minY, maxX, maxY}, abbr, canvas = Image.collage.canvas) => {
        let [W, H, ctx] = [canvas.width, canvas.height, canvas.getContext('2d')];
        let pad = 4; // Margin safety buffer
        let [bx, by] = [Math.max(0, minX - pad), Math.max(0, minY - pad)];
        let [bw, bh] = [Math.min(W - bx, (maxX - minX) + pad * 2), Math.min(H - by, (maxY - minY) + pad * 2)];
        ctx.strokeStyle = '#ff3366';
        ctx.lineWidth = Math.max(2, Math.floor(W / 400));
        ctx.strokeRect(bx-1, by-1, bw+2, bh+2);
        ctx.font = '50px Arial';
        ctx.fillStyle = 'blue';
        abbr && ctx.fillText(abbr, minX, maxY);
    },    
    get: {embed: (img, i) => img && createImageBitmap(img)
        .then(bitmap => new Promise(res => {
            const handler = ({data}) => i === data.i && [worker.removeEventListener('message', handler), res()];
            worker.addEventListener('message', handler);
            worker.postMessage({i, img: bitmap, color: null}, [bitmap]) 
        }))
    }
}

const App = () => App.model() && DB.get.essentials()
    .then(([_, Parts]) => {
        let flatten = Parts => Parts instanceof O ? [...Parts.values()].map(flatten).flat() : Parts;
        PARTS = flatten(Parts);
        App.events();
        Q('continuous-knob', knob => knob.dispatchEvent(new InputEvent('input', {bubbles: true})));
        return Promise.all([
            App.model !== true && App.model(),
            ...PARTS.map(P => E.img(`/x/img/${P.path.join('/')}.png`))
        ]);
    }).then(([, ...imgs]) => Promise.all(imgs.map((img, i) => Image.get.embed(img, i))))
    .then(() => {
        Q('.loading')?.classList.remove('loading');
        Image.collage.img && App.execute();
    }).catch(console.error);

    Object.assign(App, {
        results: [],
        model: () => new Promise(res => worker.onmessage = ev => ev.data.status == 'READY' && res(App.model = true)),
        events () {
            Q('input[type=file]').onchange = ev => E.img(URL.createObjectURL(ev.target.files[0])).then(img => {
                [Image.collage.img, Image.collage.canvas.width, Image.collage.canvas.height] = [img, img.width, img.height];
                Image.collage.canvas.getContext('2d').drawImage(Image.collage.img, 0, 0);
                App.model === true && App.execute();
            });
            Q('main').oninput = ev => {
                App[ev.target.id] = ev.target.value;
                App.model === true && App.execute();
            }
            Image.collage.canvas.onclick = ev => {
                let rect = ev.target.getBoundingClientRect();
                let clickX = (ev.clientX - rect.left) * (ev.target.width / rect.width);
                let clickY = (ev.clientY - rect.top) * (ev.target.height / rect.height);
                console.log(App.results.find(([[x, y, width, height]]) =>
                    clickX >= x && clickX <= x + width && clickY >= y && clickY <= y + height
                )?.[1]);
            };
            Q('button').onclick = () => App.match();
        },
        execute () {
            Image.collage.canvas.getContext('2d').drawImage(Image.collage.img, 0, 0);
            Q('p').classList.add('loading');
            App.detected = detect();
            App.detected.forEach(obj => Image.tag(obj));
            Q('.loading')?.classList.remove('loading');
        },
        match () {
            Q('p').classList.add('loading');
            createImageBitmap(Image.collage.canvas).then(bitmap => new Promise(res => {
                worker.postMessage({
                    collage: bitmap,
                    boxes: App.detected.map(obj => [obj.minX, obj.minY, obj.maxX-obj.minX, obj.maxY-obj.minY]),
                }, [bitmap]);
                worker.onmessage = ev => res(ev.data);
            })).then(results => {
                console.log(results);
                App.results = App.detected.map((obj, i) => {
                    Image.tag(obj, PARTS[results[i][0].i].abbr);
                    return [
                        [obj.minX, obj.minY, obj.maxX-obj.minX, obj.maxY-obj.minY],
                        ...results[i].map(({i, score}) => [PARTS[i], score])
                    ];
                });
            });
            Q('.loading')?.classList.remove('loading');
        }
    });
const detect = (canvas = Image.collage.canvas) => {
    let [W, H] = [canvas.width, canvas.height];
    let data = canvas.getContext('2d').getImageData(0, 0, W, H).data;
    const visited = new Uint8Array(W * H);
    const objects = [];

    for (let y = 10; y < H - 10; y += 4) { 
        for (let x = Math.floor(W * 0.12); x < W - 10; x += 4) {
            const idx = y * W + x;
            if (visited[idx]) continue;

            let {chroma, luma} = Image.chroluma(data.slice(idx * 4, idx * 4 + 3));
            if (chroma > App.chroma || luma > App.luma_min && luma < App.luma_max) {
                const bounds = Image.floodFillExpand(x, y, W, H, data, visited);
                const [w, h] = [bounds.maxX - bounds.minX, bounds.maxY - bounds.minY];
                w > 25 && h > 25 && w < W * 0.2 && h < H * 0.2 && objects.push(bounds);
            }
        }
    }
    const unnested = [];
    objects.sort((a, b) => ((b.maxX - b.minX) * (b.maxY - b.minY)) - ((a.maxX - a.minX) * (a.maxY - a.minY)))
        .forEach(obj => unnested.every(o => obj.maxX < o.minX || obj.minX > o.maxX || obj.maxY < o.minY || obj.minY > o.maxY) && unnested.push(obj));
    return unnested;
}
export default App;