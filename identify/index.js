const thresholdSlider = document.getElementById('thresholdSlider');
const erosionSlider = document.getElementById('erosion');
const resultsGrid = document.getElementById('resultsGrid');

E.img = src => new Promise(res => E('img', {src, onload: function() {res(this);}}));
const Image = {
    paths: [
        '/x/img/bit/DB.png', // Transparent PNGs
        '/x/img/bit/Q.png',
        '/x/img/bit/C.png',
        '/x/img/bit/MN.png'
    ],
    collage: {
        matrix: null,
        canvas: Q('canvas'),
        background: Q('input[type=color]').value,
    },
    fill: {background (img) {
        let canvas = E('canvas', {width: img.width, height: img.height});
        let ctx = canvas.getContext('2d');
        ctx.fillStyle = Image.collage.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        img.embedding = App.model.infer(canvas, true);
        img.dataUrl = canvas.toDataURL();
        return img;
    }},
    box (src, ctx, cnt, pad) {
        let {x, y, width, height} = cv.boundingRect(cnt);
        [x, y] = [Math.max(0, x - pad), Math.max(0, y - pad)];
        [width, height] = [Math.min(src.cols - x, width + pad * 2), Math.min(src.rows - y, height + pad * 2)];

        ctx.strokeStyle = ctx.fillStyle = '#00FF55';
        ctx.lineWidth = Math.max(2, src.cols / 500);
        ctx.strokeRect(x, y, width, height);
        ctx.font = `bold ${Math.max(12, src.cols / 65)}px sans-serif`;
        ctx.fillText(`#${App.results.length}`, x + 4, y + Math.max(14, src.cols/60));
        return {x, y, width, height};
    },
    match (x, y, width, height) {
        let boxed = {canvas: E('canvas', {width, height})};
        boxed.canvas.getContext('2d').drawImage(Image.collage.canvas, x, y, width, height, 0, 0, width, height);
        boxed.embedding = App.model.infer(boxed.canvas, true);
        return App.assets.map(img => ({score: Image.compare(boxed.embedding, img.embedding), src: img.src}))
            .sort((...imgs) => imgs[1].score - imgs[0].score).slice(0, 5);
    },
    compare: (tensorA, tensorB) => tf.tidy(() => tf.sum(tf.mul(tensorA, tensorB)).div(tf.mul(tf.norm(tensorA), tf.norm(tensorB))).dataSync()[0])
}
const App = () => Promise.all([
    mobilenet.load({ version: 2, alpha: 1.0 }),
]).then(([model]) => {console.log(1);
    App.model = model;
    return Promise.all(Image.paths.map(src => E.img(src)));
}).then(imgs => {
    App.events();
    App.assets = imgs.map(Image.fill.background);
    Q('.loading')?.classList.remove('loading');
});
Object.assign(App, {
    events () {
        Q('input[type=file]').onchange = ev => E.img(URL.createObjectURL(ev.target.files[0])).then(img => {
            [Image.collage.canvas.width, Image.collage.canvas.height] = [img.width, img.height];
            cv.imshow(Image.collage.canvas, cv.imread(img));
            Image.collage.matrix?.delete();
            Image.collage.matrix = cv.imread(Image.collage.canvas);
            App.execute();
        });
        Q('input[type=color]').addEventListener('input', ev => (Image.collage.background = ev.target.value) && App.execute());
        thresholdSlider.addEventListener('input', () => App.execute());
        erosionSlider.addEventListener('input', () => App.execute());
        Image.collage.canvas.onclick = ev => {
            let rect = ev.target.getBoundingClientRect();
            let clickX = (ev.clientX - rect.left) * (ev.target.width / rect.width);
            let clickY = (ev.clientY - rect.top) * (ev.target.height / rect.height);
            console.log(App.results.find(([[x, y, width, height]]) =>
                clickX >= x && clickX <= x + width && clickY >= y && clickY <= y + height
            )?.[1]);
        };
    },
    execute () {
        if (!Image.collage.matrix) return;
        Q('p').classList.add('loading');
        resultsGrid.innerHTML = "";
        App.results = [];
        
        let rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(Image.collage.background);
        rgb = {r: parseInt(rgb[1], 16), g: parseInt(rgb[2], 16), b: parseInt(rgb[3], 16)};
        let matrix = Image.collage.matrix.clone();
        let thresh = new cv.Mat(), contours = new cv.MatVector(), hierarchy = new cv.Mat();

        let cutoff = parseInt(thresholdSlider.value);
        let low = [Math.max(0, rgb.r - cutoff), Math.max(0, rgb.g - cutoff), Math.max(0, rgb.b - cutoff), 0];
        let high = [Math.min(255, rgb.r + cutoff), Math.min(255, rgb.g + cutoff), Math.min(255, rgb.b + cutoff), 255];
        [low, high] = [cv.matFromArray(1, 4, cv.CV_8UC1, low), cv.matFromArray(1, 4, cv.CV_8UC1, high)];
        cv.inRange(matrix, low, high, thresh);
        cv.bitwise_not(thresh, thresh);

        let erodeSize = Q('#erosion').value;
        if (erodeSize > 0) {
            let M = cv.Mat.ones(erodeSize, erodeSize, cv.CV_8U);
            cv.erode(thresh, thresh, M, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
            M.delete();
        }
        cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        cv.imshow(Image.collage.canvas, matrix);

        const ctx = Image.collage.canvas.getContext('2d');
        let area = {min: matrix.cols * matrix.rows * .0004, max: matrix.cols * matrix.rows * .98};
        for (let i = 0; i < contours.size(); ++i) {
            let cnt = contours.get(i);
            if (cv.contourArea(cnt) <= area.min || cv.contourArea(cnt) >= area.max) {
                cnt.delete();
                continue;
            }
            let {x, y, width, height} = Image.box(matrix, ctx, cnt, erodeSize);
            let tops = Image.match(x, y, width, height);
            App.results.push([[x, y, width, height], tops]);
            cnt.delete();
        }
        [low, high, matrix, thresh, contours, hierarchy].forEach(_ => _.delete());
        Q('.loading')?.classList.remove('loading');
    }
});
export default App;