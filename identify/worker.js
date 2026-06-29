import * as Comlink from "https://unpkg.com/comlink/dist/esm/comlink.mjs";
import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.mjs';
let SESSION = './best.onnx', resize = 640; 
class Collage {
    static transferred = () => Collage.cvs ? true : false
    static colors = {blade: 'oklch(.8 .3 110)', ratchet: 'oklch(.8 .3 180)', bit: 'oklch(.8 .3 280)', CX: '#f42597'}// best.onnx only
    //static colors = {CX: '#f42597', bit: 'oklch(.8 .3 280)', blade: 'oklch(.8 .3 110)', ratchet: 'oklch(.8 .3 180)'}
    //static colors = {CX: '#f42597', blade: 'oklch(.8 .3 110)', bit: 'oklch(.8 .3 280)', ratchet: 'oklch(.8 .3 180)'} //best 1
    constructor(canvas, bitmap) {
        canvas && ([Collage.cvs, Collage.ctx] = [canvas, canvas.getContext('2d', {willReadFrequently: true})]);
        [Collage.cvs.width, Collage.cvs.height] = [Collage.W, Collage.H] = [bitmap.width, bitmap.height];
        this.bitmap = bitmap;
        this.detect.boxes();
    }
    draw (boxes, cvs = Collage.cvs, ctx = Collage.ctx) {
        (boxes === true || !boxes) && ctx.drawImage(this.bitmap, 0, 0);
        if (!boxes) return;
        let [W, H, pad] = [cvs.width, cvs.height, 4];
        (boxes === true ? this.boxes : boxes).forEach(box => {
            let [x0, y0, x1, y1] = box;
            let [bx, by] = [Math.max(0, x0 - pad), Math.max(0, y0 - pad)];
            let [bw, bh] = [Math.min(W - bx, x1 - x0), Math.min(H - by, y1 - y0)];
            ctx.strokeStyle = Collage.colors[box.class]; 
            ctx.lineWidth = Math.max(2, Math.floor(W / 400));
            ctx.strokeRect(bx, by, bw, bh);
        });
    }
    resize (rW, rH, cvs = Collage.cvs) {
        let resized = new OffscreenCanvas(rW, rH).getContext('2d');
        resized.drawImage(cvs, 0, 0, rW, rH);
        return {data: resized.getImageData(0, 0, rW, rH).data, area: rW * rH};
    }
    detect = {
        boxes: async () => {
            this.draw();
            let {data, area} = this.resize(resize, resize);
            let input = Format.input(data, area, resize, resize);
            let {output0: {data: output}} = await SESSION.run({images: input});
            this.boxes = Format.output(output, resize, resize);
            this.classes = new Set(this.boxes.map(b => b.class));
            this.draw(true);
        },
        backdrop: () => {
            let rgba = ([x, y]) => Collage.ctx.getImageData(x, y, 1, 1).data.join(',');
            let counts = this.boxes.map(rgba).reduce((obj, rgba) => ({...obj, [rgba]: (obj[rgba] || 0) + 1}), {});
            return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 0);
        },
        tiers: (x = .02, maxNoise = .03, minLength = .1, W = Collage.cvs.width, H = Collage.cvs.height) => {
            [x, maxNoise, minLength] = [W * x, Math.floor(H * maxNoise), Math.floor(H * minLength)];
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
            return tiers;
        }
    }
    cutouts = () => Promise.all(this.boxes.map(box => 
        createImageBitmap(Collage.cvs, box[0], box[1], box[2]-box[0], box[3]-box[1]).then(bmp => ({bmp, box}))
    )).then(objs => Comlink.transfer(objs, objs.map(({bmp}) => bmp)))
    
    label (b, label, ctx = Collage.ctx) {
        if (label == null) return;
        if (!this.fontSize) {
            let widths =  [...this.boxes].map(points => (([x0, _, x1]) => x1 - x0)(points)).sort((a, b) => a - b);
            let middle = Math.floor(widths.length / 2);
            this.fontSize = Math.max(15, (widths.length % 2 !== 0 ? widths[middle] : (widths[middle - 1] + widths[middle]) / 2) / 4);
        }
        let [x0, y0, x1, y1] = typeof b == 'number' ? this.boxes[b] : b;
        ctx.textAlign = 'center';
        let [{width: w}, h, pad] = [ctx.measureText(label), this.fontSize, this.fontSize/10];
        let [x, y] = [x0 + (x1 - x0)/2, y0 < this.fontSize ? y0 + this.fontSize : y0];
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.fillRect(x - w/2 - pad, y - h + pad*3/4, w + pad*2, h + pad/2);
        ctx.font = `${this.fontSize}px Chiron GoRound TC`; ctx.fillStyle = 'rgb(127,127,127)'; 
        ctx.fillText(label, x, y - pad/2);
    }
}
Comlink.expose({Collage, session: () => ort.InferenceSession.create(SESSION, {executionProviders: ['wasm']}).then(ss => SESSION = ss)});

const Format = {
    input (data, area, rW, rH) {
        let input = new Float32Array(3 * area);
        for (let i = 0; i < area; i++) {
            input[i] = data[i * 4] / 255.0;
            input[i + area] = data[i * 4 + 1] / 255.0;
            input[i + area * 2] = data[i * 4 + 2] / 255.0;
        }
        return new ort.Tensor('float32', input, [1, 3, rH, rW]);
    },
    output (output, rW, rH, W = Collage.cvs.width, H = Collage.cvs.height) {
        let boxes = [], unnested = [];
        for (let d = 0; d < output.length / 6; d++) {
            let [x0, y0, x1, y1, score, classID] = output.slice(6 * d, 6 * d + 6);
            let box = [x0 / rW * W + 1, y0 / rH * H + 1, x1 / rW * W + 1, y1 / rH * H + 1];
            box.class = Object.keys(Collage.colors)[Math.round(classID)];
            score >= .1 && boxes.push(box);
        }
        boxes.sort((a, b) => (b[2] - b[0]) * (b[3] - b[1]) - (a[2] - a[0]) * (a[3] - a[1]))
            .forEach(box => unnested.every(b => box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]) && unnested.push(box));
        return unnested;
    }
}