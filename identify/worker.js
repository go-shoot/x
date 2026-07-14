import * as Comlink from "https://unpkg.com/comlink/dist/esm/comlink.mjs";
import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.mjs';
let SESSION = './0703.onnx', KNOBS, AI = {resize: 1280, threshold: .04}; 
class Collage {
    static colors = {CX: '#f42597', bit: 'oklch(.8 .3 280)', blade: 'oklch(.8 .3 110)', ratchet: 'oklch(.8 .3 180)'}
    constructor(cvs, bmp) {
        if (cvs) {
            Collage.cvs = cvs;
            Collage.ctx = cvs.getContext('2d', {willReadFrequently: true});
        }
        if (bmp) {
            Collage.bmp = bmp;
            Collage.cvs.width = Collage.W = bmp.width
            Collage.cvs.height = Collage.H = bmp.height;
        }
    }
    draw (boxes, {ctx, W, H, bmp} = Collage) {
        (boxes === true || !boxes) && ctx.drawImage(bmp, 0, 0);
        if (!boxes) return;
        let stroke = Math.max(2, Math.floor(W / 400));
        (boxes === true ? this.boxes : boxes).forEach(box => {
            let [x0, y0, x1, y1] = box;
            let [bx, by] = [Math.max(0, x0 - stroke), Math.max(0, y0 - stroke)];
            let [bw, bh] = [Math.min(W - bx, x1 - x0 + 2 * stroke), Math.min(H - by, y1 - y0 + 2 * stroke)];
            ctx.strokeStyle = Collage.colors[box.class] || 'gray';
            ctx.lineWidth = stroke;
            ctx.strokeRect(bx, by, bw, bh);
        });
    }
    resize (rW, rH, {cvs} = Collage) {
        let resized = new OffscreenCanvas(rW, rH).getContext('2d');
        resized.drawImage(cvs, 0, 0, rW, rH);
        return {data: resized.getImageData(0, 0, rW, rH).data, area: rW * rH};
    }
    setClasses = comp => this.classes = new Set([comp])
    detect = {
        boxes: async (AIorKnobs, {cvs, ctx, W, H} = Collage) => {
            this.draw();
            let boxes = [];
            if (AIorKnobs === true) {
                let {data, area} = this.resize(AI.resize, AI.resize);
                let input = Format.input(data, area);
                let {output0: {data: output}} = await SESSION.run({images: input});
                boxes = Format.output(output);
            } else {
                KNOBS = AIorKnobs;
                let [pad, leap] = [1/100, 1/300];
                [pad, leap] = [Math.floor(W*pad), 1/*Math.floor(Math.min(W, H)*leap)*/];
                let [{data}, colored] = [ctx.getImageData(0, 0, W, H), new Int8Array(W * H).fill(-1)]; //visited
                for (let y = 0; y < H; y += leap)
                    for (let x = pad; x < W; x += leap) {
                        let pixel = y * W + x;
                        if (colored[pixel] == -1 && Valid.color(data, pixel)) {
                            let {x0, y0, x1, y1, w, h} = Calculate.boundary(x, y, data, colored);
                            w && boxes.push([x0, y0, x1, y1]);
                        }
                    }
            }
            this.boxes = [];
            boxes.sort((a, b) => (b[2] - b[0]) * (b[3] - b[1]) - (a[2] - a[0]) * (a[3] - a[1])).forEach(box => 
                this.boxes.every(b => box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]) && this.boxes.push(box)
            );
            this.classes = new Set(this.boxes.map(b => b.class));
            this.draw(true);
        },
        backdrop: ({ctx} = Collage) => {
            let rgba = ([x, y]) => ctx.getImageData(x, y, 1, 1).data.join(',');
            let counts = this.boxes.map(rgba).reduce((obj, rgba) => ({...obj, [rgba]: (obj[rgba] || 0) + 1}), {});
            return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 0);
        },
        tiers: (x = .02, {ctx, W, H} = Collage) => {
            let maxNoise = .03, minLength = .1;
            [x, maxNoise, minLength] = [W * x, Math.floor(H * maxNoise), Math.floor(H * minLength)];
            let data = ctx.getImageData(x, 0, 1, H).data;
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
            return tiers;
        }
    }
    cutouts = ({cvs} = Collage) => Promise.all(this.boxes.map(box => 
        createImageBitmap(cvs, box[0], box[1], box[2]-box[0], box[3]-box[1]).then(bmp => ({bmp, box}))
    )).then(objs => Comlink.transfer(objs, objs.map(({bmp}) => bmp)))
    
    label (b, label, {ctx} = Collage) {
        if (label == null) return;
        if (!this.fontSize) {
            let widths =  [...this.boxes].map(points => (([x0, _, x1]) => x1 - x0)(points)).sort((a, b) => a - b);
            let middle = Math.floor(widths.length / 2);
            this.fontSize = Math.max(15, (widths.length % 2 > 0 ? widths[middle] : (widths[middle - 1] + widths[middle]) / 2) / 4);
        }
        let [x0, y0, x1, y1] = typeof b == 'number' ? this.boxes[b] : b;
        ctx.textAlign = 'center';
        ctx.font = `${this.fontSize}px Chiron GoRound TC`; 
        let [{width: w}, h, pad] = [ctx.measureText(label), this.fontSize, this.fontSize/10];
        let [x, y] = [x0 + (x1 - x0)/2, y0 < this.fontSize ? y0 + this.fontSize : y0];
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.fillRect(x - w/2 - pad, y - h + pad*3/4, w + pad*2, h + pad/2);
        ctx.fillStyle = 'rgb(127,127,127)'; 
        ctx.fillText(label, x, y - pad/2);
    }
}
Comlink.expose({
    Collage, 
    session: async () => SESSION = await ort.InferenceSession.create(SESSION, {executionProviders: ['wasm']})
});
const Format = {
    input (data, area, rW = AI.resize, rH = AI.resize) {
        let input = new Float32Array(3 * area);
        for (let i = 0; i < area; i++) {
            input[i] = data[i * 4] / 255.0;
            input[i + area] = data[i * 4 + 1] / 255.0;
            input[i + area * 2] = data[i * 4 + 2] / 255.0;
        }
        return new ort.Tensor('float32', input, [1, 3, rH, rW]);
    },
    output (output, rW = AI.resize, rH = AI.resize, {W, H} = Collage) {
        let boxes = [], pad = 0;
        for (let d = 0; d < output.length / 6; d++) {
            let [x0, y0, x1, y1, score, classID] = output.slice(6*d, 6*d+6);
            if (score < AI.threshold) continue;
            let box = [x0 / rW * W - pad, y0 / rH * H - pad, x1 / rW * W + pad, y1 / rH * H + pad];
            box.class = Object.keys(Collage.colors)[Math.round(classID)];
            boxes.push(box);
        }
        return boxes;
    }
}
const Valid = {
    color (data, pixel) {
        let {chroma, luma} = Calculate.chroluma(data, pixel);
        return chroma > KNOBS.chroma || luma > KNOBS.luma_min && luma < KNOBS.luma_max;
    },
    size: (w, h, type, {W, H} = Collage) => {
        let side = {min: Math.min(W, H) * KNOBS.side_min/100, max: Math.min(W, H) * KNOBS.side_max/100};
        return type == 'max' ? w <= side.max && h <= side.max : w >= side.min && h >= side.min;
    },
    position: (x, y, {W, H} = Collage) => x >= 0 && x < W && y >= 0 && y < H
}
const Calculate = {
    chroluma (data, pixel) {
        let [r, g, b] = data.slice(pixel * 4, pixel * 4 + 3);
        return {
            chroma: Math.max(r, g, b) - Math.min(r, g, b),
            luma: 0.2126 * r + 0.7152 * g + 0.0722 * b
        }
    },
    boundary (x, y, data, colored, {W} = Collage) {
        let [x0, x1, y0, y1] = [x, x, y, y];
        let stack = [[x0, y0]], b = KNOBS.buffer, downOnly = false;
        while (stack.length > 0) {
            let [x, y] = stack.pop(), pixel = y*W + x;
            if (colored[pixel] != -1 || !Valid.position(x, y)) continue;
            colored[pixel] = Valid.color(data, pixel);
            let neighbors = [[x, y+b], [x, y-b]];
            if (!downOnly) {
                // let lastColumn = [];
                // if (x - x0 > 10) {
                //     for (let y = y0; y <= y1; y++)
                //         lastColumn.push(colored[y*W + x1]);
                //     downOnly = lastColumn.filter(c => c === 1).length / lastColumn.length < .005;
                //}
                !downOnly && neighbors.push([x+b, y], [x-b, y]);
            }
            neighbors.forEach(([nx, ny]) => {
                let pixel = ny*W + nx;
                colored[pixel] == -1 && Valid.position(nx, ny) && Valid.color(data, pixel) && stack.push([nx, ny]);
            });
            [x0, x1, y0, y1] = [Math.min(x0, x), Math.max(x1, x), Math.min(y0, y), Math.max(y1, y)];
            if (!Valid.size(x1-x0, y1-y0, 'max')) break;
        }
        return Valid.size(x1-x0, y1-y0, 'min') ? {x0, y0, x1, y1, w: x1-x0, h: y1-y0} : {};
    },
};
