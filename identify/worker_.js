importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet');

let MODEL, COLLAGE, EMBEDDINGS = [], HASHES = [];
mobilenet.load({version: 2, alpha: 1.0}).then(model => {
    MODEL = model;
    MODEL.compare = (a, b) => tf.tidy(() => tf.sum(tf.mul(a, b)).div(tf.mul(tf.norm(a), tf.norm(b))).dataSync()[0]),
    self.postMessage({ status: 'READY' });
}).catch(er => {
    console.error(er);
    self.postMessage({ status: 'ERROR' });
});

self.onmessage = async ({data}) => {
    if (!MODEL) return self.postMessage({ status: 'ERROR' });
    if (data.collage) {
        return COLLAGE = data.collage;
    }
    if (data.box) {
        let [x, y, w, h] = data.box;
        let cvs = new OffscreenCanvas(w, h);
        cvs.getContext('2d').drawImage(COLLAGE, x, y, w, h, 0, 0, w, h);
        let embedding = MODEL.infer(cvs, true);
        let result = EMBEDDINGS.map((em, i) => ({p: i, score: MODEL.compare(embedding, em)})).sort((a, b) => b.score - a.score);
        return self.postMessage({b: data.b, result});
    }
    if (data.img) {console.log(data.i);
        let canvas = new OffscreenCanvas(data.img.width, data.img.height);
        let ctx = canvas.getContext('2d');
        data.backdrop && (ctx.fillStyle = `rgba(${data.backdrop})`);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(data.img, 0, 0);
        data.img.close();
        EMBEDDINGS[data.i] = MODEL.infer(canvas, true);
        return self.postMessage({i: data.i});
    }
};