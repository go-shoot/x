import DB from '../include/DB.js'
import PI from 'https://aeoq.github.io/pointer-interaction/script.js';

navigator.storage.persist();
E.img = src => new Promise(res => E('img', {src, onload: function() {res(this);}}));
const DESIGN = location.search.substring(1);
const MAIN = {ctx: Q('canvas').getContext('2d', {alpha: false})};
const FORM = {nav: Q('nav form'), main: Q('main form')};
Q('nav').classList = DESIGN;

const App = () => {
    App.loading(true);
    App.events();
    Promise.try(() => DESIGN == 'sheet' ? E.img('./sheet.png') : {naturalHeight: 300, naturalWidth: 300})
    .then(img => {
        MAIN.W = MAIN.ctx.canvas.width = img.naturalWidth, MAIN.H = MAIN.ctx.canvas.height = img.naturalHeight;
        MAIN.hW = MAIN.W/2, MAIN.hH = MAIN.H/2;
        img instanceof Node && (Layers.frame = img);
        Design.load(location.hash ||= '#1');
    });
    FORM.nav.scale.value = Storage('pref')?.print || 100;
    PDFLib.A4 = PDFLib.PageSizes.A4.sort((a, b) => a - b); //portrait
}
Object.assign(App, {
    loading: flag => Q('summary').classList[flag ? 'add' : 'remove']('loading'),
    warn () {
        Q('summary em').hidden = false;
        setTimeout(() => Q('summary em').hidden = true, 2000);
    },
    events () {
        PI.events([
            ['#layers label', {click: click => click.for(2).to(() => Layer.solo())}],
            [FORM.nav.sample, {hold: hold => hold.for(2).to(() => Design.import('sample'))}],
            [FORM.main.delete, {hold: hold => hold.for(2).to(() => Layer.delete())}]
        ]);
        E(FORM.main).set({
            oncontextmenu: () => false,
            onclick: ev => ev.target.matches('button.type') ? Layer.set({type: ev.target.id}) : null
        });
        E(FORM.main.layer).set({
            onchange: ev => ev.target.labels[0].layer.select(),
            onpointerdown: ev => ev.target.id == 'delete' && App.warn(ev),
            onclick: ev => ev.target.id == 'create' ? new Layer() : 
                ['up', 'down'].includes(ev.target.id) ? Layer.move(ev.target.id) : '',
        });
        E(FORM.main['control-image']).set({
            oninput: Inputs.get,
            onchange: Inputs.image,
            onclick (ev) {
                if (!ev.target.popoverTargetElement) return;
                ev.preventDefault();
                Q('#picker img') || App.picker();
                Q('#picker').showPopover();
            }
        });
        E(FORM.nav).set({
            onpointerdown: ev => ev.target.id == 'sample' && Layers.length > 1 ? App.warn() : '',
            onclick: ev => 
                ev.target.id == 'sample' && Layers.length <= 1 ? Design.import('sample') :
                ev.target.id == 'export' ? Design.export('json') :
                ev.target.id == 'print' ? Design.export('pdf') : ''
            ,
            onchange: ev => ev.target.id == 'import' && Design.import(ev),
            oninput (ev) {
                if (ev.target.name != 'scale') return;
                Storage('pref', {print: ev.target.value});
                FORM.nav.print.classList.toggle('accent', ev.target.value > 100);
            },
        });
        FORM.main['control-color'].oninput = FORM.main.control.oninput = Inputs.get;

        onkeydown = ev => 
            ev.key == 'Control' ? FORM.main.fine.click() : 
            ev.key == 'ArrowUp' ? Layer.active.previousSibling?.click() :
            ev.key == 'ArrowDown' ? Layer.active.nextSibling?.click() : null;        
        onhashchange = Design.switch;
    }
});
const Design = {
    links: Q('nav menu a[href^="#"]').reverse(),
    reset () {
        Layers.set(DESIGN == 'emblem' ? JSON.parse(Q(`#template`).innerText) : undefined);
        Inputs.set();
    },
    switch (ev) {
        Layer.solo(false);
        typeof ev == 'object' && Design.stage(Q(`a[href='${new URL(ev.oldURL).hash}']`));
        /^#[1-6]$/.test(location.hash) ? Design.load(location.hash) : location.href = '#1';
    },
    async load (hash) {
        App.loading(true);
        let layers = await DB.get('user', `${DESIGN}-${hash.substring(1)}`);
        layers ? Layers.set(layers) : Design.reset();
        App.loading(false);
    },
    save: () => console.log('save')??DB.put('user', {[`${DESIGN}-${location.hash.substring(1)}`]: Layers.get()}),
    import (ev) {
        if (DESIGN == 'emblem' && ev == 'sample') return Design.reset();
        App.loading(true);
        Layer.solo(false);
        let layers = ev == 'sample' ? 
            fetch('./sheet-sample.json').then(resp => resp.json()) : ev.target.files[0]?.text().then(JSON.parse);
        layers.then(Layers.set).then(App.loading);
        ev == 'sample' || gtag('event', 'IMPORT-JSON');
    },
    async stage (anchor) {
        if (!anchor) return;console.log('stage',anchor)
        if (anchor !== true) {
            anchor.canvas ??= MAIN.ctx.canvas.cloneNode(true);
            return anchor.canvas.getContext('2d').drawImage(MAIN.ctx.canvas, 0, 0);
        }
        Design.stage(Q('nav a.current'));
        for (const a of Design.links) {
            if (a.canvas) continue;
            await Design.load(a.getAttribute('href'));
            await new Promise(res => setTimeout(() => res(Design.stage(a))));
        }
        return Design.links.map(a => a.canvas);
    },
    async export (type) {
        if (type == 'json')
            return E('a', {
                href: `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(Layers.get()))}`,
                download: `${DESIGN}.json`
            }).click() ?? gtag('event', 'EXPORT-JSON');

        App.loading(true);
        Layer.solo(false);
        let tab = window.open('about:blank', '_blank');
        let perDesign = [...FORM.nav.amount.value].map(n => parseInt(n));  
        let [perPage, perRow, y0, scale] = DESIGN == 'sheet' ? [12, 6, 84.5, .291] : [81, 9, 700, .168];
        let pages = Math.ceil(perDesign.reduce((sum, n) => sum += n, 0)/perPage);

        let [pdf, canvases] = await Promise.all([PDFLib.PDFDocument.create(), Design.stage(true)]);
        for (let i = 0; i < pages; i++) pdf.addPage(PDFLib.A4);
        
        (await Promise.all(canvases.map(cvs => pdf.embedPng(cvs.toDataURL("image/png", 1)))))
        .flatMap((image, i) => Array(perDesign[i]).fill({image, ...image.scale(scale * FORM.nav.scale.value / 100)}))
        .forEach(({image, width, height}, i) => {
            let [x, y] = [16 + i % perRow * (11 + width), y0 + (1 - Math.floor(i/perRow) % (perPage/perRow)) * (20 + height)];
            pdf.getPage(Math.floor(i/perPage)).drawImage(image, {x, y, width, height});
        });
        tab.location.href = URL.createObjectURL(new Blob([await pdf.save()], {type: 'application/pdf'}));
        Design.switch(location.hash);
        gtag('event', 'EXPORT-PDF', {SCALE: FORM.nav.scale.value});
    },
}
const Inputs = {
    knobs: Q('main drag-knob'),
    set ({type, ...data} = {}) {
        FORM.main.color1.value = FORM.main.color2.value = FORM.main.color3.value = '#000000';
        FORM.main.gradient[0].checked = FORM.main.shape[0].checked = true;
        FORM.main.classList = type || '';
        Inputs.knobs.forEach(knob => (knob.pause = true) && knob.formResetCallback());
        type && new O(data).each(([n, v]) => FORM.main[n] && (FORM.main[n].value = v));
        Inputs.knobs.forEach(knob => knob.pause = false);
    },
    get (ev) {
        if (ev.target.id == 'fine') 
            return Q('drag-knob', knob => knob.classList.toggle('fine', ev.target.checked));
        if (!ev.target.name || ev.target.tagName != 'DRAG-KNOB' && !ev.isTrusted) return;
        Layer.set({[ev.target.name]: ev.target.value});
    },
    image (ev) {
        App.loading(true);
        let reader = new FileReader;
        reader.readAsDataURL(ev.target.files[0]);
        reader.onload = () => Layer.set({image: reader.result});
        reader.onloadend = () => (App.loading(false), ev.target.value = '');
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
        Inputs.set(this.label.dataset);
        Layer.soloing && Draw();
    }
    set ({type, image, ...data} = {}, draw = true) {
        if (type) {
            this.label.dataset.type = type;
            this.label.append(this.img = type == 'image' ? 
                E('img') : E('svg', {viewBox: `-${MAIN.hW} -${MAIN.hW} ${MAIN.W} ${MAIN.W}`}, E('path'))
            );
            Inputs.set({type});
        }
        if (image) {
            this.img.src = image;
            this.dirty = true;
            return this.load = new Promise(res => this.img.onload = () => res(this.set(data, type ? false : true)));
        }
        data && Object.assign(this.label.dataset, data) && (this.dirty = true);
        this.label.classList.toggle('dirty', this.dirty);
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
        let before = Layer.soloing;
        Layer.soloing = flag == null ? !Layer.soloing : flag;
        FORM.main.layer[0]?.classList.toggle('solo', Layer.soloing);
        (flag == null || before === true) && Draw();
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
        layer.dirty = false;
        setTimeout(() => layer.label.classList.remove('dirty'), 500);
    });
    DESIGN == 'sheet' && Draw.frame();
    all || (App.timer = setTimeout(Design.save, 500));
}
Object.assign(Draw, {
    clear (context) {
        if (context) return context.clearRect(0, 0, MAIN.W, MAIN.H);
        MAIN.ctx.fillStyle = DESIGN == 'sheet' ? 'silver' : 'white';
        MAIN.ctx.fillRect(0, 0, MAIN.W, MAIN.H);
    },
    frame: () => MAIN.ctx.drawImage(Layers.frame, 0, 0, MAIN.W, MAIN.H),
    transform (ctx, {sk, sc, ro, st, x, y, w, h}, img) { //translate -> skew -> scale -> rotate -> stretch
        sk ??= 0, sc ??= 1, ro ??= 0, st ??= 1, x ??= 0, y ??= 0, w = h = MAIN.W;
        x /= 100; y /= 100;
        if (img)
            if (img.naturalWidth / img.naturalHeight < MAIN.W / MAIN.H) {
                h = MAIN.H;
                w = h * img.naturalWidth / img.naturalHeight;
            } else {
                w = MAIN.W;
                h = w * img.naturalHeight / img.naturalWidth;
            }
        x = -x * (MAIN.hW + w/2) - MAIN.hW, y = y * (MAIN.hH + h/2) - MAIN.hH;
        const [cos, sin, tan] = [Math.cos(ro*Math.PI), Math.sin(ro*Math.PI), Math.tan(sk*Math.PI)];
        ctx.setTransform(sc*cos, sc*st*sin, sc*(cos*tan-sin), sc*st*(sin*tan+cos), x*sc*cos+y*sc*(cos*tan-sin)-x, x*sc*st*sin+y*sc*st*(sin*tan+cos)-y);
        return [x + w/2, y + h/2].map(v => (img ? 0 : MAIN.hW) - v).concat(w, h).map(Math.round);
    },
    image (layer) {
        let {img, cvs, ctx, dataset: {sc, ro, st, x, y, opacity, bl, sh, co, fl}} = layer, w, h;
        Draw.clear(ctx);
        ctx.save();
        [x, y, w, h] = Draw.transform(ctx, {sc, ro, st, x, y}, img);
        ctx.shadowColor = '#010101';
        ctx.shadowBlur = sh || 0, ctx.shadowOffsetX = 0, ctx.shadowOffsetY = 0;
        ctx.filter = `blur(${bl || 0}px) contrast(${co || 1})`;
        ctx.globalAlpha = opacity ?? 1;
        fl == 'x' ? ctx.translate(x, y + h) : fl == 'y' ? ctx.translate(x + w, y) : null;
        fl == 'x' ? ctx.scale(1, -1) : fl == 'y' ? ctx.scale(-1, 1) : null;
        ctx.translate(x, y);
		ctx.drawImage(img, 0, 0, w, h);
        ctx.restore();
        layer.bitmap?.close() || (layer.bitmap = null);
        createImageBitmap(cvs).then(bm => layer.bitmap = bm);
    },
    color (layer) {
        let {ctx, dataset: {path, shape, side, gradient: type, sk, sc, ro, x, y, angle}} = layer;
        Draw.clear(ctx);
        ctx.save();
        path = Draw.polygon(shape ?? 'regular', side ?? 0);
        let [gradient, colors] = Draw.gradient(type ??= 'Linear', angle ?? 0, layer);
        layer.style.background = `${type}-gradient(${colors.join(',')}),white`;
        layer.img.firstChild.setAttribute('d', path);
        [x, y] = Draw.transform(ctx, {sk, sc, ro, x, y});
        ctx.translate(x, y); 
        ctx.fillStyle = gradient;
        ctx.fill(new Path2D(path));
        ctx.restore();
    },
    gradient (type, angle, {ctx, dataset}) {
        angle = (angle - 1/2) * Math.PI;
        let [x, y] = ['cos', 'sin'].map(f => MAIN.hW * Math[f](angle));
        let gradient = 
            type == 'Linear' ? ctx.createLinearGradient(x, y, -x, -y) :
            type == 'Radial' ? ctx.createRadialGradient(0, 0, 0, 0, 0, MAIN.hW) :
            type == 'Conic' ? ctx.createConicGradient(angle, 0, 0) : null;
        let format = (color, opacity = 1) => (color + Math.round(opacity * 255).toString(16).padStart(2, '0'));
        let colors = [1,2,3].map(i => format(dataset[`color${i}`], dataset[`opacity${i}`])).filter(c => c.length == 9);
        (colors.length === 1 || type == 'Conic') && colors.push(colors[0]);
        colors.forEach((c, i, ar) => gradient.addColorStop(i / (ar.length - 1), c));
        return [gradient, colors];
    },
    polygon (shape, side, r = MAIN.hW) {
        side = parseInt(side);
        if (side === 0) 
            return `M 0 ${-r} A ${r} ${r} 0 1 0 0 ${r} A ${r} ${r} 0 1 0 0 ${-r} Z`;
        let path = [];
        if (shape == 'regular')
            for (let i = 0; i < side; i++) {
                let [cos, sin] = ['cos', 'sin'].map(f => r * Math[f](2*Math.PI/side*i - Math.PI/2));
                path.push((i === 0 ? 'M' : 'L') + ` ${cos} ${sin}`);
            }
        else if (shape == 'star')
            for (let i = 0; i < side*2; i++) {
                let [cos, sin] = ['cos', 'sin'].map(f => (i % 2 === 0 ? r : r*.5) * Math[f](Math.PI/side*i - Math.PI/2));
                path.push((i === 0 ? 'M' : 'L') + ` ${cos} ${sin}`);
            }
        return path.concat('Z').join(' ');
    }
});
export {App}
