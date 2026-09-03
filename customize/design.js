import DB from '../include/DB.js'
import PI from 'https://aeoq.github.io/pointer-interaction.mjs';

navigator.storage.persist();
E.img = src => new Promise(res => E('img', {src, onload: function() {res(this);}}));
const DESIGN = location.search.substring(1);
const MAIN = {}, FORM = {nav: Q('nav form'), main: Q('main form')};
Q('nav').classList = DESIGN;

const App = () => {
    App.loading(true);
    App.events();
    Promise.try(() => DESIGN == 'sheet' ? E.img('./sheet.png') : {naturalHeight: 300, naturalWidth: 300})
    .then(img => {
        MAIN.W = img.naturalWidth, MAIN.H = img.naturalHeight;
        MAIN.hW = MAIN.W/2, MAIN.hH = MAIN.H/2;
        img instanceof Node && (Layers.frame = img);
        location.hash ? Design.load(location.hash) : location.hash ||= '#1';
    });
    FORM.nav.scale.value = Storage('pref')?.print || 100;
    PDFLib.A4 = PDFLib.PageSizes.A4.sort((a, b) => a - b); //portrait
}
Object.assign(App, {
    loading: flag => Q('[popovertarget=reminder]').classList[flag ? 'add' : 'remove']('loading'),
    warn () {
        Q('[popovertarget=reminder] em').hidden = false;
        setTimeout(() => Q('[popovertarget=reminder] em').hidden = true, 2000);
    },
    events () {
        const holder = new O({
            delete: () => Layer.delete(), create: () => Layer.active.clone(), 
            down: () => Layer.move('down', true), up: () => Layer.move('up', true),
        }, [[FORM.nav.sample, () => Design.import('sample')]]);
        const clicker = new O({
            delete: () => App.warn(), create: () => new Layer(), 
            down: () => Layer.move('down'), up: () => Layer.move('up'),
        });
        const bypassHolding = (ev, action) => ev.isTrusted ? App.holding ? App.holding = false : action?.(ev) : '';
        PI.events(
            [...holder].map(([k, f]) => [typeof k == 'string' ? FORM.main[k] : k, {
                hold: hold => hold.for(1.5).to(() => (App.holding = true) && f())
            }]), {
            '#layers label': {
                click: click => click.for(2).to(() => Layer.solo()),
                hold: hold => hold.for(1).to((_, target) => E('a', {href: target.Q('img').src, download: 'layer'}).click())
            }
        });
        E(FORM.main).set({
            onchange: ev => ev.target.id == 'fine' ? 
                Q('drag-knob', knob => knob.classList.toggle('fine', ev.target.checked)) : 
                ev.target.name == 'layer' || Layer.active.undo({[ev.target.name]: ev.target.value}),
            oncontextmenu: () => false,
            onclick: ev => ev.target.matches('button.type') ? Layer.set({type: ev.target.id}) : ''
        });
        E(FORM.main.layer).set({
            onchange: ev => ev.target.labels[0].layer.select(),
            onclick: ev => bypassHolding(ev, clicker[ev.target.id])
        });
        E(FORM.main['control-image']).set({
            oninput: Inputs.get,
            onchange: ev => ev.target.type == 'file' && Inputs.image(ev),
            onclick (ev) {
                if (!ev.target.popoverTargetElement) return;
                ev.preventDefault();
                Q('#picker img') || App.picker();
                Q('#picker').showPopover();
            }
        });
        E(FORM.nav).set({
            onclick: ev => ({
                sample: () => bypassHolding(ev, () => Layers.length > 1 ? App.warn() : Design.import('sample')),
                export: () => Design.export('json'),
                print: () => Design.export('pdf')
            })[ev.target.id]?.(),
            onchange: ev => ev.target.id == 'import' && Design.import(ev),
            oninput (ev) {
                if (ev.target.name != 'scale') return;
                Storage('pref', {print: ev.target.value});
                FORM.nav.print.classList.toggle('accent', ev.target.value > 100);
            },
        });
        FORM.main['control-color'].oninput = FORM.main.control.oninput = Inputs.get;

        onkeyup = ev => ev.key == 'Control' ? App.undo ? App.undo = false : FORM.main.fine.click() : '';
        onkeydown = ev => 
            (ev.ctrlKey || ev.metaKey) && /^z$/i.test(ev.key) ? (App.undo = true) && Layer.active.undo() :
            ev.key == 'ArrowUp' ? Layer.active.previousSibling?.click() :
            ev.key == 'ArrowDown' ? Layer.active.nextSibling?.click() : '';        
        onhashchange = Design.load;
    }
});
const Design = {
    canvases: Q('canvas'),
    reset () {
        Layers.set(DESIGN == 'emblem' ? JSON.parse(Q(`#emblem`).innerText) : undefined);
        Inputs.set();
    },
    async load (ev, force) {
        App.loading(true);
        Layer.solo(false);
        let id = ev.newURL?.at(-1) ?? ev.substring(1);
        let cvs = Design.canvases[id - 1];
        let drawn = !!cvs.getAttribute('width');
        MAIN.ctx = cvs.getContext('2d', {alpha: false});
        drawn || ([cvs.width, cvs.height] = [MAIN.W, MAIN.H]);
        if (typeof ev == 'object' || force || !drawn) {
            let layers = await DB.get('user', `${DESIGN}-${id}`);
            layers ? await Layers.set(layers) : Design.reset();
        }
        App.loading(false);
    },
    save: () => DB.put('user', {[`${DESIGN}-${location.hash.substring(1)}`]: Layers.get(true)}),
    async import (ev) {
        if (DESIGN == 'emblem' && ev == 'sample') return Design.reset();
        App.loading(true);
        Layer.solo(false);
        if (ev != 'sample')
            return ev.target.files[0]?.text().then(JSON.parse).then(Layers.set).then(App.loading) && gtag('event', 'IMPORT-JSON');
        let layers;
        if (Math.random() > .9) {
            layers = JSON.parse(Q(`#sheet`).innerText).reverse();
            for (let i = 0; i <= 10; i++) { 
                let scale = Math.random(), op = Math.random() * 70 + 30;
                let scales = layers.slice(1, 4).map(({sc}) => sc * scale);
                let x = (Math.random()*2 - 1) * 100, y = (Math.random()*2 - 1) * MAIN.hH * 100; 
                layers.push(
                    {...layers[1], x: x/(1 + scales[0]), y: y/(MAIN.hH + MAIN.hW*scales[0]), sc: scales[0], op1: op}, 
                    {...layers[2], x: x/(1 + scales[1]), y: y/(MAIN.hH + MAIN.hW*scales[1]), sc: scales[1], op1: op}, 
                    {...layers[3], x: x/(1 + scales[2]), y: y/(MAIN.hH + MAIN.hW*scales[2]), sc: scales[2], op1: op}
                );
            }
            layers.reverse();
        } else
            layers = await fetch('./sheet-sample.json').then(resp => resp.json());
        Layers.set(layers).then(App.loading);
    },
    async export (type) {
        if (type == 'json')
            return E('a', {
                href: `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(Layers.get(true)))}`,
                download: `${DESIGN}.json`
            }).click() ?? gtag('event', 'EXPORT-JSON');

        App.loading(true);
        Layer.solo(false);
        let tab = window.open('about:blank', '_blank');
        let perDesign = [...FORM.nav.amount.value].map(n => parseInt(n));  
        let [perPage, perRow, y0, scale] = DESIGN == 'sheet' ? [12, 6, 84.5, .291] : [81, 9, 700, .168];
        let pages = Math.ceil(perDesign.reduce((sum, n) => sum += n, 0)/perPage);
        let pdf = await PDFLib.PDFDocument.create();
        for (let i = 0; i < pages; i++) pdf.addPage(PDFLib.A4);

        let images = [];
        for (const i of [0,1,2,3,4,5]) {
            let cvs = Design.canvases[i];
            cvs.getAttribute('width') || await Design.load(`#${i+1}`);
            images[i] = await pdf.embedPng(cvs.toDataURL("image/png", 1));
        }
        let {width: w, height: h} = images[0].scale(scale * FORM.nav.scale.value / 100);
        images.flatMap((image, i) => Array(perDesign[i]).fill(image)).forEach((image, i) => {
            let [x, y] = [16 + i % perRow * (11 + w), y0 + (1 - Math.floor(i/perRow) % (perPage/perRow)) * (20 + h)];
            pdf.getPage(Math.floor(i/perPage)).drawImage(image, {x, y, width: w, height: h});
        });
        tab.location.href = URL.createObjectURL(new Blob([await pdf.save()], {type: 'application/pdf'}));
        setTimeout(() => URL.revokeObjectURL(tab.location.href), 30000);
        Design.load(location.hash, true);
        gtag('event', 'EXPORT-PDF', {SCALE: FORM.nav.scale.value});
    },
};
const Inputs = {
    knobs: Q('main drag-knob'),
    set ({type, path, ...data} = {}) {
        FORM.main.color1.value = FORM.main.color2.value = FORM.main.color3.value = '#000000';
        FORM.main.gradient[0].checked = true;
        FORM.main.classList = type || '';
        FORM.main.shape.forEach(input => input.checked = !(input.disabled = path));
        Inputs.knobs.forEach(knob => {
            knob.pauseEvent = true;
            data[knob.name] ? knob.value = data[knob.name] : knob.formResetCallback();
            knob.pauseEvent = false;
            delete data[knob.name];
        });
        Object.entries(data).forEach(([n, v]) => FORM.main[n] && (FORM.main[n].value = v));
    },
    get (ev) {
        ev.target.name && (ev.target.tagName == 'DRAG-KNOB' || ev.isTrusted) && Layer.set({[ev.target.name]: ev.target.value});
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
        if (Layer.active) {
            Layer.active.before(this.label);
            this.label.click();
        } else 
            Layers.append(this.label);
        if (dataset.type) {
            this.set(dataset, !!Layer.active);
            this.undo({...this.label.dataset}); //remove type, image
        }
        return this.label.layer;
    }
    select () {
        Layer.active = this.label.layer;
        Inputs.set(this.label.dataset);
        Layer.soloing && Draw();
    }
    set ({type, image, node, ...data} = {}, draw) {
        if (type) {
            this.label.dataset.type = type;
            node ??= type == 'image' ? 
                E('img') : E('svg', {viewBox: `-${MAIN.hW} -${MAIN.hW} ${MAIN.W} ${MAIN.W}`}, E('path'));
            draw !== false && this.undo({shape: 'regular', gradient: 'linear'}) && Inputs.set({type});
        }
        node && this.label.append(this.img = node);
        if (Object.keys(data).length) {
            Object.assign(this.label.dataset, data);
            this.dirty = true;
            draw ??= true;
        }
        if (image) {
            this.img.src = image;
            this.dirty = true;
            return this.load = new Promise(res => this.img.onload = () => res(this.set({}, draw ?? true)));
        }
        this.label.classList.toggle('dirty', !!this.dirty);
        draw && Draw();
    }
    undo (dataset) {
        if (dataset) {
            this.undos ??= [];
            return JSON.stringify(dataset) == JSON.stringify(this.undos.at(-1)) ? '' : this.undos.push(dataset);
        }
        if (this.undos.length === 1) return;
        let name = Object.keys(this.undos.pop())[0];
        let value = this.undos.findLast(dataset => dataset[name] != null)?.[name], input = FORM.main[name];
        input.value = value == null ? '' : value;
        input.tagName != 'DRAG-KNOB' && this.set({[name]: value});
    }
    move (dir, end) {
        let {scrollTop} = FORM.main.layer;
        end ? 
            Layers[dir == 'up' ? 'prepend' : 'append'](this.label) :
            this.#adjacent(dir)?.[dir == 'up' ? 'before' : 'after'](this.label);
        FORM.main.layer.scrollTop = scrollTop;
        Draw();
    }
    clone = () => new Layer({...this.label.dataset, node: this.img?.cloneNode(true)})
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
    prepend: () => label => div.prepend(label),
    set: () => async (layers = []) => {
        Layer.active = null;
        div.replaceChildren('');
        layers.length ? await Promise.all(layers.map(layer => new Layer(layer).load)) : new Layer();
        Layers[0].click();
        Draw(true);
    },
    get: target => (save = false) => [...target]
        .map(({layer}) => ({...layer.dataset, ...save && layer.img ? {image: layer.img.src} : {}}))
        .filter(obj => Object.keys(obj).length)
}, true)))();

const Draw = all => {
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
        x = -x * (MAIN.hW + w*sc/2) - MAIN.hW, y = y * (MAIN.hH + h*sc/2) - MAIN.hH;
        const [cos, sin, tan] = [Math.cos(ro*Math.PI), Math.sin(ro*Math.PI), Math.tan(sk*Math.PI)];
        ctx.setTransform(sc*cos, sc*st*sin, sc*(cos*tan-sin), sc*st*(sin*tan+cos), x*sc*cos+y*sc*(cos*tan-sin)-x, x*sc*st*sin+y*sc*st*(sin*tan+cos)-y);
        return [x + w/2, y + h/2].map(v => (img ? 0 : MAIN.hW) - v).concat(w, h).map(Math.round);
    },
    image (layer) {
        let {img, cvs, ctx, dataset: {op, bl, sh, co, fl, ...transform}} = layer;
        Draw.clear(ctx);
        ctx.save();
        ctx.shadowColor = '#010101';
        ctx.shadowBlur = sh || 0, ctx.shadowOffsetX = 0, ctx.shadowOffsetY = 0;
        ctx.filter = `blur(${bl || 0}px) contrast(${co || 1})`;
        ctx.globalAlpha = (op ?? 100)/100;
        let [x, y, w, h] = Draw.transform(ctx, transform, img);
        fl == 'x' ? ctx.translate(x, y + h) : fl == 'y' ? ctx.translate(x + w, y) : null;
        fl == 'x' ? ctx.scale(1, -1) : fl == 'y' ? ctx.scale(-1, 1) : null;
        ctx.translate(x, y);
		ctx.drawImage(img, 0, 0, w, h);
        ctx.restore();
        layer.bitmap?.close() || (layer.bitmap = null);
        createImageBitmap(cvs).then(bm => layer.bitmap = bm);
    },
    color (layer) {
        let {ctx, dataset: {path, stroke, shape, side, gradient: type, angle, ...transform}} = layer;
        Draw.clear(ctx);
        ctx.save();
        path ??= Draw.polygon(shape ?? 'regular', side ?? 0);
        E(layer.img.firstChild).set({d: path, ...stroke ? {'stroke-width': stroke, stroke: 'black', fill: 'none'} : {}});
        let [gradient, colors] = Draw.gradient(type ??= 'linear', angle ?? 0, layer);
        layer.img.removeAttribute('style');
        E(layer.img).set({style: {
            maskImage: `url('data:image/svg+xml,${layer.img.outerHTML}')`,
            background: `${type}-gradient(${colors.join(',')}),white`
        }});
        let [x, y] = Draw.transform(ctx, transform);
        ctx.translate(x, y); 
        stroke && (ctx.lineWidth = stroke);
        ctx[stroke ? 'strokeStyle' : 'fillStyle'] = gradient;
        ctx[stroke ? 'stroke' : 'fill'](new Path2D(path));
        ctx.restore();
    },
    gradient (type, angle, {ctx, dataset}) {
        angle = (angle - 1/2) * Math.PI;
        let [x, y] = ['cos', 'sin'].map(f => MAIN.hW * Math[f](angle));
        let gradient = 
            /linear/i.test(type) ? ctx.createLinearGradient(x, y, -x, -y) :
            /radial/i.test(type) ? ctx.createRadialGradient(0, 0, 0, 0, 0, MAIN.hW) :
            /conic/i.test(type) ? ctx.createConicGradient(angle, 0, 0) : null;
        let format = (color, opacity = 100) => (color + Math.round(opacity*255/100).toString(16).padStart(2, '0'));
        let colors = [1,2,3].map(i => format(dataset[`color${i}`], dataset[`op${i}`])).filter(c => c.length == 9);
        (colors.length === 1 || type == 'conic') && colors.push(colors[0]);
        colors.forEach((c, i, ar) => gradient?.addColorStop(i / (ar.length - 1), c));
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
                let [cos, sin] = ['cos', 'sin'].map(f => (i % 2 === 0 ? r : r*.4) * Math[f](Math.PI/side*i - Math.PI/2));
                path.push((i === 0 ? 'M' : 'L') + ` ${cos} ${sin}`);
            }
        return path.concat('Z').join(' ');
    }
});
export {App}
