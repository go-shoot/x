import * as Comlink from "https://unpkg.com/comlink/dist/esm/comlink.mjs";

let COLLAGE, KNOBS;
class Collage {
    static transferred = () => Collage.cvs ? true : false
    static take = knobs => KNOBS = knobs
    constructor(canvas, bitmap) {
        canvas && ([Collage.cvs, Collage.ctx] = [canvas, canvas.getContext('2d')]);
        [COLLAGE, this.bitmap] = [this, bitmap];
        [Collage.cvs.width, Collage.cvs.height] = [Collage.W, Collage.H] = [bitmap.width, bitmap.height];
        this.detect.boxes();
    }
    draw (boxes, color = 'green', cvs = Collage.cvs, ctx = Collage.ctx) {
        (boxes === true || !boxes) && ctx.drawImage(this.bitmap, 0, 0);
        if (!boxes) return;
        let [W, H, pad] = [cvs.width, cvs.height, 4];
        (boxes === true ? this.boxes : boxes).forEach(([x0, y0, x1, y1]) => {
            let [bx, by] = [Math.max(0, x0 - pad), Math.max(0, y0 - pad)];
            let [bw, bh] = [Math.min(W - bx, x1 - x0 + KNOBS.buffer * 2), Math.min(H - by, y1 - y0 + KNOBS.buffer * 2)];
            ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, Math.floor(W / 400));
            ctx.strokeRect(bx, by, bw, bh);
        });
    }
    detect = {
        boxes: (cvs = Collage.cvs, ctx = Collage.ctx) => {
            this.draw();
            let [W, H, pad, leap] = [cvs.width, cvs.height, 1/100, 1/300];
            [pad, leap] = [Math.floor(W*pad), 1/*Math.floor(Math.min(W, H)*leap)*/];
            let [{data}, colored] = [ctx.getImageData(0, 0, W, H), new Int8Array(W * H).fill(-1)]; //visited
            let boxes = [];
            for (let y = 0; y < H; y += leap)
                for (let x = pad; x < W; x += leap) {
                    let pixel = y * W + x;
                    if (colored[pixel] == -1 && Valid.color(data, pixel)) {
                        let {x0, y0, x1, y1, w, h} = Calculate.boundary(x, y, data, colored);
                        w && boxes.push([x0+1, y0+1, x1+1, y1+1]);
                    }
                }
            const unnested = [];
            boxes.sort((a, b) => (b[2] - b[0]) * (b[3] - b[1]) - (a[2] - a[0]) * (a[3] - a[1]))
                .forEach(box => unnested.every(b => box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]) && unnested.push(box));
            this.boxes = unnested;
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
    cutouts = () => 
        Promise.all(this.boxes.map(([x0, y0, x1, y1]) => createImageBitmap(Collage.cvs, x0, y0, x1-x0, y1-y0)))
        .then(bitmaps => Comlink.transfer(bitmaps, bitmaps))
    
    label (b, label, lang, ctx = Collage.ctx) {
        if (!label) return;
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
Comlink.expose(Collage);

const Valid = {
    color (data, pixel) {
        let {chroma, luma} = Calculate.chroluma(data, pixel);
        return chroma > KNOBS.chroma || luma > KNOBS.luma_min && luma < KNOBS.luma_max;
    },
    size: (w, h, type, W = Collage.W, H = Collage.H) => {
        let side = {min: Math.min(W, H) * KNOBS.side_min/100, max: Math.min(W, H) * KNOBS.side_max/100};
        return type == 'max' ? w <= side.max && h <= side.max : w >= side.min && h >= side.min;
    },
    position: (x, y, W = Collage.W, H = Collage.H) => x >= 0 && x < W && y >= 0 && y < H
}
const Calculate = {
    chroluma (data, pixel) {
        let [r, g, b] = data.slice(pixel * 4, pixel * 4 + 3);
        return {
            chroma: Math.max(r, g, b) - Math.min(r, g, b),
            luma: 0.2126 * r + 0.7152 * g + 0.0722 * b
        }
    },
    boundary (x, y, data, colored, W = Collage.W) {
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
