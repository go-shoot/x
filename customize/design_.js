import DB from '../include/DB.js'
import PI from 'https://aeoq.github.io/pointer-interaction/script.js';

navigator.storage.persist();
E.img = src => new Promise(res => E('img', {src, onload: function() {res(this);}}));
const DESIGN = location.search.substring(1);
const MAIN = {ctx: Q('canvas').getContext('2d', {alpha: false})};
const FORM = {nav: Q('nav form'), main: Q('main form')};
Q('nav').classList = DESIGN;

const App = () => {
    App.load(true);
    Q('form button', button => button.type = 'button');
    App.events();
    Promise.try(() => DESIGN == 'sheet' ? E.img('./sheet.png') : {naturalHeight: 300, naturalWidth: 300}).then(img => {
        MAIN.W = MAIN.ctx.canvas.width = img.naturalWidth, MAIN.H = MAIN.ctx.canvas.height = img.naturalHeight;
        MAIN.hW = MAIN.W/2, MAIN.hH = MAIN.H/2;
        img instanceof Node && (Layers.frame = img);
        return App.load(location.hash ||= '#1');
    });
    FORM.nav.scale.value = Storage('pref')?.print || 100;
    PDFLib.A4 = PDFLib.PageSizes.A4.sort((a, b) => a - b);
}
Object.assign(App, {
    get designs () {return Q('nav menu a[href^="#"]').reverse()},
    reset () {
        DESIGN == 'emblem' && Layers.put(JSON.parse(Q(`#template`).innerText));
        Controls.set();
        Layers.set();
    },
    async load (hash) {
        Q('summary').classList[hash ? 'add' : 'remove']('loading');
        if (typeof hash != 'string') return;
        let layers = await DB.get('user', `${DESIGN}-${hash.substring(1)}`);
        layers ? Layers.set(layers) : App.reset();
        App.load(false);
    },
    save: () => DB.put('user', {[`${DESIGN}-${location.hash.substring(1)}`]: Layers.get()}),
    stage: design => design === true ?
        Promise.all(App.designs.map(a => a.canvas ? 
            a.href == location.href && App.stage(a) :
            App.load(a.getAttribute('href')).then(() => App.stage(a))
        )) :
        (design.canvas ??= MAIN.ctx.canvas.cloneNode(true)).getContext('2d').drawImage(MAIN.ctx.canvas, 0, 0)
    ,
    switch (ev) {
        Layer.solo(false);
        typeof ev == 'object' && App.stage(Q(`a[href='${new URL(ev.oldURL).hash}']`));
        /^#[1-6]$/.test(location.hash) ? App.load(location.hash) : location.href = '#1'
    },
    export () {
        E('a', {
            href: `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(Layers.get()))}`,
            download: `${DESIGN}.json`
        }).click();
        gtag('event', 'EXPORT-JSON');
    },
    import (ev) {
        App.load(true);
        Layer.solo(false);
        ev.target.files[0]?.text().then(JSON.parse).then(Layers.set).then(App.load);
        gtag('event', 'IMPORT-JSON');
    },
    sample () {
        if (DESIGN == 'emblem') return App.reset();
        App.load(true);
        Layer.solo(false);
        fetch('./sheet-sample.json').then(resp => resp.json()).then(Layers.set).then(App.load);    
    },
    print () {
        App.load(true);
        Layer.solo(false);
        let perDesign = [...FORM.nav.amount.value];  
        let [perPage, perRow, y0, scale] = DESIGN == 'sheet' ? [12, 6, 84.5, .291] : [81, 9, 700, .168];
        Promise.all([PDFLib.PDFDocument.create(), App.stage(true)]).then(([pdf]) => {
            let canvases = App.designs.map(a => a.canvas); //after staging
            perDesign = perDesign.map((n, i) => canvases[i] ? parseInt(n) : 0);
            for (let i = 0; i < Math.ceil(perDesign.reduce((sum, n) => sum += n, 0)/perPage); i++)
                pdf.addPage(PDFLib.A4);
            return Promise.all([pdf, ...canvases.map(cvs => cvs ? pdf.embedPng(cvs.toDataURL("image/png", 1)) : null)]);
        }).then(([pdf, ...images]) => {
            images.flatMap((image, i) => image ? Array(perDesign[i]).fill(image) : []).forEach((image, i) => {
                let {width, height} = image.scale(scale * FORM.nav.scale.value / 100);
                let [x, y] = [16 + i % perRow * (11 + width), y0 + (1 - Math.floor(i/perRow) % (perPage/perRow)) * (20 + height)];
                pdf.getPage(Math.floor(i/perPage)).drawImage(image, {x, y, width, height});
            });
            return pdf.save();
        }).then(pdf => {
            gtag('event', 'EXPORT-PDF', {SCALE: FORM.nav.scale.value});
            open(URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' })));
            App.switch(location.hash);
        }).catch(er => document.body.append(er) ?? console.error(er));
    },
    warn () {
        Q('.message').classList.add('active');
        setTimeout(() => Q('.active')?.classList.remove('active'), 2000);
    },
    events () {
        PI.events([
            ['#layers label', {click: click => click.for(2).to(() => Layer.solo())}],
            [FORM.nav.sample, {hold: hold => hold.for(2).to(App.sample)}],
            [FORM.main.delete, {hold: hold => hold.for(2).to(() => Layer.delete())}]
        ]);
        E(FORM.main).set({
            oncontextmenu: () => false,
            onpointerup: App.save,
            onclick: ev => ev.target.matches('button.type') ? Layer.set({type: ev.target.id}) : null
        });
        E(FORM.main.layer).set({
            onchange: ev => ev.target.labels[0].layer.select(),
            onpointerdown: ev => ev.target.id == 'delete' && App.warn(ev),
            onclick (ev) {
                if (ev.target.id == 'create') return new Layer();
                ['up', 'down'].includes(ev.target.id) && Layer.move(ev.target.id);
            },
        });
        E(FORM.main['control-image']).set({
            oninput: Controls.get,
            onchange: Controls.image,
            onclick (ev) {
                if (!ev.target.popoverTargetElement) return;
                ev.preventDefault();
                Q('#picker img') || App.picker();
                Q('#picker').showPopover();
            }
        });
        E(FORM.nav).set({
            onpointerdown: ev => ev.target.id == 'sample' && Layers.length > 1 ? App.warn() : '',
            onclick (ev) {
                if (ev.target.id == 'sample' && Layers.length <= 1) return App.sample();
                ['export', 'print'].includes(ev.target.id) && App[ev.target.id]();
            },
            oninput (ev) {
                if (ev.target.name != 'scale') return;
                Storage('pref', {print: ev.target.value});
                FORM.nav.print.classList.toggle('accent', ev.target.value > 100);
            },
            onchange: ev => ev.target.id == 'import' && App.import(ev)
        });
        FORM.main['control-color'].oninput = FORM.main.control.oninput = Controls.get;

        onkeydown = ev => {
            if (ev.target.tagName.includes('KNOB')) 
                return ev.key == 'Enter' ? ev.target.sQ('input').onblur() : '';
            ev.key == 'Control' ? FORM.main.fine.click() : 
            ev.key == 'ArrowUp' ? Layer.active.previousSibling?.click() :
            ev.key == 'ArrowDown' ? Layer.active.nextSibling?.click() : null;
        }
        onhashchange = App.switch;
    }
});
const Controls = {
    set ({type, ...data} = {}) {
        Q('input[type=color]', input => input.value = '#000000');
        Q('main drag-knob', knob => knob.value = knob.getAttribute('value'));
        FORM.main.gradient[0].checked = true;
        FORM.main.shape[0].checked = FORM.main.shape[1].checked = false;
        FORM.main.classList = type || '';
        if (!type) return;
        FORM.main.shape.forEach(input => (input.disabled = data.path) && (input.checked = false));
        new O(data).each(([n, v]) => FORM.main[n] && (FORM.main[n].value = v));
    },
    get (ev) {
        if (ev.target.id == 'fine') 
            return Q('drag-knob', knob => knob.classList.toggle('fine', ev.target.checked));
        if (!ev.target.name || 
            ev.target.tagName == 'DRAG-KNOB' && !ev.dragged ||
            ev.target.tagName != 'DRAG-KNOB' && !ev.isTrusted) return;
        Layer.set({[ev.target.name]: ev.target.value});
    },
    image (ev) {
        FORM.main.layer.disabled = true;
        App.load(true);
        const reader = new FileReader;
        reader.readAsDataURL(ev.target.files[0]);
        reader.onload = ev => E.img(reader.result).then(img => {
            let w, h;
            if (img.width / img.height < MAIN.W / MAIN.H) {
                w = Math.min(img.width, MAIN.W);
                h = Math.round(w * img.height / img.width);
            } else {
                h = Math.min(img.height, MAIN.H);
                w = Math.round(h * img.width / img.height);
            }
            let cvs = E('canvas', {width: w, height: h});
            cvs.getContext('2d').drawImage(img, 0, 0, w, h);
            Layer.set({image: cvs.toDataURL('image/png')});
        });
        reader.onloadend = () => {
            FORM.main.layer.disabled = false;
            App.load(false);
            ev.target.value = '';
        }
    },
}
Proxy.getter = (redirect, useTarget) => ({
    get(target, prop, receiver) {
        let [value, bound] = prop in target ? 
            [Reflect.get(target, prop, useTarget ? target : receiver), target] : typeof redirect == 'function' ? 
            [redirect(target)[prop], redirect(target)] : Object.getPrototypeOf(redirect) === Object.prototype ?
            [redirect[prop](target), redirect[prop]] :
            [redirect[prop], redirect];
        return bound ? typeof value == 'function' ? value.bind(bound) : value : undefined;
    }
});
const Layer = new Proxy(class {
    constructor (dataset = {}) {
        this.label = E('label>input', {type: 'radio', name: 'layer'});
        this.label.layer = new Proxy(this, Proxy.getter(this.label));
        this.cvs = new OffscreenCanvas(MAIN.W, MAIN.H);
        this.ctx = this.cvs.getContext('2d');
        if (dataset.type) {
            Layers.append(this.label);
            this.set(dataset, false);
        } else {
            Layer.active ? Layer.active.after(this.label) : Layers.append(this.label);
            this.label.click();
        }
        return this.label.layer;
    }
    select () {
        Layer.active = this.label.layer;
        Controls.set(this.label.dataset);
        Layer.soloing && Draw();
    }
    set ({type, image, ...data} = {}, draw = true) {
        if (type) {
            this.label.dataset.type = type;
            this.label.append(this.img = E(type == 'image' ? 'img' : 'svg'));
            Controls.set({type});
        }
        if (image) {
            this.img.src = image;
            this.dirty = true;
            return this.load = new Promise(res => this.img.onload = () => res(this.set(data, type ? false : true)));
        }
        data && Object.assign(this.label.dataset, data) && (this.dirty = true);
        draw && Draw();
    }
    move (dir) {
        let {scrollTop} = FORM.main.layer;
        this.#adjacent(dir)?.[dir == 'up' ? 'before' : 'after'](this.label);
        FORM.main.layer.scrollTop = scrollTop;
        Draw();
    }
    delete () {
        this.#adjacent()?.click();
        this.label.remove();
        Layers.length > 0 ? Draw() : Layers.set();
    }
    #adjacent (dir) {
        let priority = ['previousElementSibling', 'nextElementSibling'];
        dir != 'up' && priority.reverse();
        return this.label[priority[0]] ?? (dir === null ? null : this.label[priority[1]]);
    }
    static solo (flag) {
        Layer.soloing = flag == null ? !Layer.soloing : flag;
        FORM.main.layer[0].classList.toggle('solo', Layer.soloing);
        flag == null && Draw();
    }
    static soloing = false;
}, Proxy.getter(target => target.active?.layer));

const Layers = ((div = Q('#layers')) => new Proxy(div.children, Proxy.getter({
    append: () => label => div.append(label),
    set: () => async (layers = []) => {
        Layer.active = null;
        div.replaceChildren('');
        layers.length ? await Promise.all(layers.map(layer => new Layer(layer).load)) : new Layer();
        Layers[0].click();
        Draw(true);
    },
    get: target => () => [...target]
        .map(({layer}) => ({...layer.dataset, ...layer.img ? {image: layer.img.src} : {}}))
        .filter(obj => Object.keys(obj).length)
}, true)))();

const Draw = all => {console.log('draw');
    clearTimeout(App.timer);
    Draw.clear();
    [...Layers].reverse().forEach(({layer}) => {
        if (all || Layer.active == layer)
            layer.dirty && Draw[layer.dataset.type](layer);
        if (Layer.soloing === false || Layer.soloing && Layer.active == layer) 
            MAIN.ctx.drawImage(layer.bitmap ?? layer.cvs, 0, 0);
    });
    Layers.frame && Draw.frame();
    App.timer = setTimeout(App.save, 500);
}
Object.assign(Draw, {
    clear (context) {
        if (context) return context.clearRect(0, 0, MAIN.W, MAIN.H);
        MAIN.ctx.fillStyle = DESIGN == 'sheet' ? 'silver' : 'white';
        MAIN.ctx.fillRect(0, 0, MAIN.W, MAIN.H);
    },
    frame: () => MAIN.ctx.drawImage(Layers.frame, 0, 0, MAIN.W, MAIN.H),
    transform (ctx, {sk, sc, ro, st, x, y}, img) { //translate -> skew -> scale -> rotate -> stretch
        sk ??= 0, sc ??= 1, ro ??= 0, st ??= 1, x ??= 0, y ??= 0;
        x /= 100; y /= 100;
        let drawing = img ? {W: img.naturalWidth, H: img.naturalHeight} : {W: MAIN.W, H: MAIN.W};
        if (img) {
            img.fit ??= Draw.transform.fit(drawing, {xW: drawing.W - MAIN.W, xH: drawing.H - MAIN.H});
            drawing.W *= img.fit, drawing.H *= img.fit;
        }
        drawing.hW = drawing.W/2, drawing.hH = drawing.H/2;

        let [cos, sin, tan] = [Math.cos(ro*Math.PI), Math.sin(ro*Math.PI), Math.tan(sk*Math.PI)];
        x = -x*(MAIN.hW+drawing.hW)-MAIN.hW, y = y*(MAIN.hH+drawing.hH)-MAIN.hH;
        ctx.setTransform(sc*cos, sc*st*sin, sc*(cos*tan-sin), sc*st*(sin*tan+cos), x*sc*cos+y*sc*(cos*tan-sin)-x, x*sc*st*sin+y*sc*st*(sin*tan+cos)-y);
        return {x: Math.round(-x-drawing.hW), y: Math.round(-y-drawing.hH), W: drawing.W, H: drawing.H};
    },
    image (layer) {
        let {img, cvs, ctx, dataset: {sc, ro, st, x, y, opacity, bl, sh, co, fl}} = layer, W, H;
        Draw.clear(ctx);
        ctx.save();
        ({x, y, W, H} = Draw.transform(ctx, {sc, ro, st, x, y}, img));
        ctx.shadowColor = '#010101';
        ctx.shadowBlur = sh || 0, ctx.shadowOffsetX = 0, ctx.shadowOffsetY = 0;
        ctx.filter = `blur(${bl || 0}px) contrast(${co || 1})`;
        ctx.globalAlpha = opacity ?? 1;
        fl == 'x' ? ctx.translate(x, y + H) : fl == 'y' ? ctx.translate(x + W, y) : null;
        fl == 'x' ? ctx.scale(1, -1) : fl == 'y' ? ctx.scale(-1, 1) : null;
		ctx.drawImage(img, x, y, W, H);
        ctx.restore();
        layer.bitmap?.close() || (layer.bitmap = null);
        createImageBitmap(cvs).then(bm => layer.bitmap = bm, layer.dirty = false);
    },
    color (layer) {
        let {ctx, dataset: {path, shape, side, gradient: type, sk, sc, ro, x, y, angle}} = layer;
        Draw.clear(ctx);
        ctx.save();
        ({x, y} = Draw.transform(ctx, {sk, sc, ro, x, y}));

        angle = (angle ??= 0) * Math.PI - Math.PI / 2;
        let from = Draw.color.rotated(angle), to = Draw.color.rotated(angle + Math.PI);
        type ??= 'Linear';
        let gradient = 
            type == 'Linear' ? ctx.createLinearGradient(from.x + MAIN.hW - MAIN.hH, from.y, to.x + MAIN.hW - MAIN.hH, to.y) :
            type == 'Radial' ? ctx.createRadialGradient(x + MAIN.hH, y + MAIN.hH, 0, x + MAIN.hH, y + MAIN.hH, MAIN.hH) :
            type == 'Conic' ? ctx.createConicGradient(angle, x + MAIN.hH, y + MAIN.hH) : null;

        let colors = [1,2,3].map(i => Draw.color.format(layer.dataset[`color${i}`], layer.dataset[`opacity${i}`])).filter(c => c);
        (colors.length === 1 || type == 'Conic') && colors.push(colors[0]);
        colors.forEach((c, i, ar) => gradient.addColorStop(i / (ar.length - 1), c));
        layer.style.background = `${type}-gradient(${colors.join(',')}),white`;

        ctx.fillStyle = gradient;
        path = path ? new Path2D(path) : shape ? Draw.polygon(x, y, shape, side) : null;
        path ? ctx.fill(path) : ctx.fillRect(x, y, MAIN.H, MAIN.H);
        ctx.restore();
    },
    polygon (x, y, shape, side, r = MAIN.hW) {
        side = parseInt(side);
        x += r; y += r;
        if (side === 0) 
            return new Path2D(`M ${x} ${y - r} A ${r} ${r} 0 1 0 ${x} ${y + r} A ${r} ${r} 0 1 0 ${x} ${y - r} Z`);
        let path = [];
        if (shape == 'regular')
            for (let i = 0; i < side; i++) {
                let [cos, sin] = ['cos', 'sin'].map(f => r * Math[f](2*Math.PI/side*i - Math.PI/2));
                path.push((i === 0 ? 'M' : 'L') + ` ${cos + x} ${sin + y}`);
            }
        else if (shape == 'star')
            for (let i = 0; i < side*2; i++) {
                let [cos, sin] = ['cos', 'sin'].map(f => (i % 2 === 0 ? r : r*.382) * Math[f](Math.PI/side*i - Math.PI/2));
                path.push((i === 0 ? 'M' : 'L') + ` ${cos + x} ${sin + y}`);
            }
        return new Path2D(path.concat('Z').join(' '));
    }
});
Draw.transform.fit = (drawing, { xH, xW }) => xW > 0 && xH > 0 ? xW < xH ? MAIN.W / drawing.W : MAIN.H / drawing.H : 1;
Draw.color.format = (color, opacity) => color ? `rgba(${color.replaceAll(/[^#]{2}/g, c => parseInt(c, 16) + ',').substring(1)}${opacity ?? 1})` : null;
Draw.color.rotated = angle => {
    let ratio = {cos: Math.cos(angle), sin: Math.sin(angle)};
    let coor = ['cos', 'sin'].map(r => MAIN.H*Math.max(0, Math.min(Math.SQRT2/2*ratio[r] + .5, 1)));
    return {x: coor[0],y: coor[1]};
}
export {App, Layers}
