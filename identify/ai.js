export class YoloDetectorApp {
    constructor() {
        this.confThreshold = 0.35;
        this.iouThreshold = 0.45;
        this.currentClasses = [];
    }
    async loadONNXModel(model, name) {
        this.session = await window.ort.InferenceSession.create(model, {executionProviders: ['wasm']});
        let detectedW = 640, detectedH = 640;
        const inputDetails = this.session.get_inputs?.() || [];
        if (inputDetails.length > 0 && inputDetails[0].shape?.length == 4) {
            let [, , h, w] = inputDetails[0].shape;
            typeof h === 'number' && h > 0 && (detectedH = h);
            typeof w === 'number' && w > 0 && (detectedW = w);
        }
        this.inputWidth = detectedW;
        this.inputHeight = detectedH;
    }
    preprocessImage(canvas, W, H) {
        let ctx = E('canvas', {width: W, height: H}).getContext('2d');
        ctx.drawImage(canvas, 0, 0, W, H);
        let data = ctx.getImageData(0, 0, W, H).data;
        let size = W * H;
        let chwData = new Float32Array(3 * size);
        for (let i = 0; i < size; i++) {
            chwData[i] = data[i*4] / 255.0;     // Red
            chwData[i+size] = data[i*4 + 1] / 255.0; // Green
            chwData[i+2*size] = data[i*4 + 2] / 255.0; // Blue
        }
        return chwData;
    }
    async runDetectionPipeline(img) {
        const cvs = E('canvas', {width: img.naturalWidth, height: img.naturalHeight});
        cvs.getContext('2d').drawImage(img, 0, 0);

        let input = this.preprocessImage(cvs, this.inputWidth, this.inputHeight);
        input = new window.ort.Tensor('float32', input, [1, 3, this.inputHeight, this.inputWidth]);
        const results = await this.session.run({images: input});
        return this.parseModelOutput(results.output0).map((det) => ({
            ...det,
            x1: det.x1 / this.inputWidth * img.naturalWidth,
            y1: det.y1 / this.inputHeight * img.naturalHeight,
            x2: det.x2 / this.inputWidth * img.naturalWidth,
            y2: det.y2 / this.inputHeight * img.naturalHeight
        }));
    }
    parseModelOutput({data, dims: [, amount]}, confThreshold = this.confThreshold, classNames = this.currentClasses) {
        const boxes = [];
        for (let d = 0; d < amount; d++) {
            const score = data[6*d + 4];
            if (score < confThreshold) continue;
            const classId = Math.round(data[6*d + 5]);
            boxes.push({
                x1: data[6*d], y1: data[6*d+1], x2: data[6*d+2], y2: data[6*d+3],
                score,
                classId,
                className: classId >= 0 && classId < classNames.length ? classNames[classId] : `class_${classId}`,
            });
        }
        return boxes;
    }
    getClassColor(classId) {
        const hues = [200, 340, 120, 45, 270, 15, 185, 300, 80, 220, 35, 105, 250];
        const hue = hues[classId % hues.length];
        return {
            border: `hsla(${hue}, 85%, 45%, 1)`,
            bg: `hsla(${hue}, 85%, 45%, 0.15)`,
            text: `hsla(${hue}, 85%, 40%, 1)`,
            tagBg: `hsla(${hue}, 85%, 45%, 0.1)`
        };
    }
}