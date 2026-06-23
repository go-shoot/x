import DB from '../include/DB.js'
import PI from 'https://aeoq.github.io/pointer-interaction/script.js';

navigator.storage.persist();
E.img = src => new Promise(res => E('img', {src, onload: function() {res(this);}}));
const DESIGNING = location.search.substring(1);
Q('nav').classList = DESIGNING;
const [MAIN, FORM] = [{ctx: Q('canvas').getContext('2d', {alpha: false})}, {nav: Q('nav form'), main: Q('main form')}];
const App = () => {
    App.loading(true);
    Controls.show(null);
    Q('form button', button => button.type = 'button');
    App.events();
    Promise.try(() => DESIGNING == 'sheet' ? E.img('./sheet.png') : {naturalHeight: 300, naturalWidth: 300}).then(img => {
        MAIN.W = MAIN.ctx.canvas.width = img.naturalWidth, MAIN.H = MAIN.ctx.canvas.height = img.naturalHeight;
        MAIN.hW = MAIN.W/2, MAIN.hH = MAIN.H/2;
        img instanceof Node && (Layers.frame = img);
        return App.load(location.hash ||= '#1');
    }).then(App.loading);
    FORM.nav.scale.value = Storage('pref')?.print || 100;
    PDFLib.A4 = PDFLib.PageSizes.A4.sort((a, b) => a - b);
}
Object.assign(App, {
    get designs () {return Q('nav menu a[href^="#"]').reverse()},
    reset () {
        DESIGNING == 'emblem' && Layers.put(JSON.parse(Q(`#template`).innerText));
        Controls.reset();
        Layers.reset();
        App.loading(false);
        Draw();
    },
    loading: loading => Q('summary').classList[loading ? 'add' : 'remove']('loading'),
    save: () => Layers.modified && DB.put('user', {[`${DESIGNING}-${location.hash.substring(1)}`]: Layers.get()}),
    load: hash => DB.get('user', `${DESIGNING}-${hash.substring(1)}`).then(layers => layers ? Layers.put(layers) : App.reset()),
    stage (design) {
        if (design === true) 
            return Promise.all(App.designs.map(a => a.canvas ? 
                a.href == location.href && App.stage(a) :
                App.load(a.getAttribute('href')).then(() => App.stage(a))
            ));
        (design.canvas ??= MAIN.ctx.canvas.cloneNode(true)).getContext('2d').drawImage(MAIN.ctx.canvas, 0, 0);
    },
    switch (ev) {
        App.loading(true);
        Layers.solo(false);
        typeof ev == 'object' && App.stage(Q(`a[href='${new URL(ev.oldURL).hash}']`));
        /^#[1-6]$/.test(location.hash) ? App.load(location.hash).then(App.loading) : location.href = '#1'
    },
    export () {
        E('a', {
            href: `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(Layers.get()))}`,
            download: `${DESIGNING}.json`
        }).click();
        gtag('event', 'EXPORT-JSON');
    },
    import (ev) {
        App.loading(true);
        Layers.solo(false);
        let reader = new FileReader;
        reader.readAsText(ev.target.files[0]);
        reader.onload = () => Layers.put(JSON.parse(reader.result)).then(App.loading);
        gtag('event', 'IMPORT-JSON');
    },
    sample () {
        if (DESIGNING == 'emblem') return App.reset();
        App.loading(true);
        Layers.solo(false);
        fetch('./sheet-sample.json').then(resp => resp.json()).then(Layers.put).then(App.loading);    
    },
    print () {
        App.loading(true);
        Layers.solo(false);
        let perDesign = [...FORM.nav.amount.value];  
        let [perPage, perRow, y0, scale] = DESIGNING == 'sheet' ? [12, 6, 84.5, .291] : [81, 9, 700, .168];
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
            ['#layers label', {click: click => click.for(2).to(() => Layers.solo(true))}],
            [FORM.nav.sample, {hold: hold => hold.for(2).to(App.sample)}],
            [FORM.main.delete, {hold: hold => hold.for(2).to(Layers.delete)}]
        ]);
        E(FORM.main).set({
            oncontextmenu: () => false,
            onpointerup: App.save,
            onclick: ev => ev.target.matches('button.type') ? Controls.chooseType(ev) : null
        });
        E(FORM.main.layer).set({
            onchange: Layers.switch,
            onpointerdown: ev => ev.target.id == 'delete' && App.warn(ev),
            onclick (ev) {
                if (ev.target.id == 'create') return Layers.create(ev);
                ['up', 'down'].includes(ev.target.id) && Layers.move(ev);
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
            onpointerdown: ev => ev.target.id == 'sample' && Layers.labels.length > 1 && App.warn(),
            onclick (ev) {
                if (ev.target.id == 'sample' && Layers.labels.length <= 1) return App.sample();
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
            ev.key == 'ArrowUp' ? Layers.selected.previousSibling?.click() :
            ev.key == 'ArrowDown' ? Layers.selected.nextSibling?.click() : null;
        }
        onhashchange = App.switch;
    }
});
const Controls = {
    show: type => FORM.main.classList = type || '',
    reset () {
        Q('input[type=color]', input => input.value = '#000000');
        FORM.main.gradient[0].checked = true;
        FORM.main.shape[0].checked = FORM.main.shape[1].checked = false;
        Q('continuous-knob', knob => knob.set.value({v: knob.getAttribute('value')}));
    },
    put () {
        let {type, ...controls} = Layers.selected.dataset;
        Controls.reset();
        Controls.show(type);
        FORM.main.shape.forEach(input => (input.disabled = controls.path) && (input.checked = false));
        new O(controls).each(([n, v]) => {
            Q(`continuous-knob[name=${n}]`)?.set.value({v});
            FORM.main[n] && (FORM.main[n].value = v);
        });
    },
    get (ev) {
        if (ev.target.id == 'fine') 
            return Q('continuous-knob', knob => knob.classList.toggle('fine', ev.target.checked));
        if (!Layers.selected || !ev.target.name) return;
        Layers.selected.dataset[ev.target.name] = ev.target.value;
        Layers.selected.dirty = true;
        Draw();
    },
    image (ev) {
        Layers.fieldset.disabled = true;
        App.loading(true);
        const reader = new FileReader;
        reader.readAsDataURL(ev.target.files[0]);
        reader.onload = () => E.img(reader.result).then(img => {
            Layers.selected.Q('img').replaceWith(Layers.selected.img = img);
            Layers.selected.dirty = true;
            Draw();
        });
        reader.onloadend = () => {
            Layers.fieldset.disabled = false;
            App.loading(false);
            ev.target.value = '';
        }
    },
    chooseType (ev) {
        Layers.selected.dataset.type = ev.target.id;
        ev.target.id == 'image' && Layers.selected.append(E('img'));
        Controls.show(ev.target.id);
    }
}
const Layers = {
    fieldset: FORM.main.layer,
    labels: Q('#layers').children,
    get modified () {return Layers.labels.length > 1 || Layers.labels[0]?.dataset.type},
    reset () {
        Q('#layers').replaceChildren(Layers.label());
        Layers.labels[0].click();
        Layers.solo(false);
    },
    label (dataset, img) {
        let label = E.radio({label: dataset ? {dataset} : {}, name: 'layer'});
        dataset?.type == 'image' && (label.img = label.appendChild(img ?? E('img')));
        label.cvs = new OffscreenCanvas(MAIN.W, MAIN.H);
        label.ctx = label.cvs.getContext('2d');
        label.dirty = true;
        return label;
    },
    switch (ev) {
        FORM.main.delete.disabled = Layers.labels.length === 1;
        Layers.selected = ev.target.parentElement;
        Layers.selected.dataset.type ? Controls.put() : Controls.show(0);
        Q('.solo') && Draw();
    },
    create () {
        let label = Layers.label();
        Layers.labels[0].before(label);
        label.click();
        FORM.main.delete.disabled = false;
        Controls.reset();
        Controls.show(0);
    },
    delete () {
        Layers.selected.remove();
        Layers.labels[0].click();
        Draw();
    },
    move (ev) {
        let current = Layers.selected, scrollTop = Layers.fieldset.scrollTop;
        let sibling = current[`${ev.target.id == 'up' ? 'previous' : 'next'}ElementSibling`];
        sibling?.tagName == 'LABEL' && sibling[ev.target.id == 'up' ? 'before' : 'after'](current);
        Layers.fieldset.scrollTop = scrollTop;
        Draw();
    },
    solo (go) {
        Layers.fieldset.classList.toggle('solo', go === true ? undefined : false);
        (go || !Q('.solo')) && Draw();
    },
    async put (layers) {
        DB._tx = null;
        const labels = await Promise.all(layers.map(({image, ...others}) => image ?
            E.img(image).then(img => Layers.label(others, img)) : Layers.label(others)
        ));
        Q('#layers').replaceChildren(...labels);
        labels[0]?.click();
        Draw(true);
    },
    get: () => [...Layers.labels]
        .map(label => ({...label.dataset, ...label.img ? {image: label.img.src} : {}}))
        .filter(obj => Object.keys(obj).length)
};
const Draw = all => {
    clearTimeout(App.timer);
    Draw.clear();
    [...Layers.labels].reverse().forEach(label => {
        if (all || Layers.selected === label) {
            label.img?.src && label.dirty && Draw.image(label);
            label.dataset.type == 'color' && Draw.color(label);
        }
        (!Q('.solo') || label.control.checked) && MAIN.ctx.drawImage(label.bitmap ?? label.cvs, 0, 0);
    });
    Layers.frame && Draw.frame();
    App.timer = setTimeout(App.save, 1000);
}
Object.assign(Draw, {
    clear (context) {
        if (context) return context.clearRect(0, 0, MAIN.W, MAIN.H);
        MAIN.ctx.fillStyle = DESIGNING == 'sheet' ? 'silver' : 'white';
        MAIN.ctx.fillRect(0, 0, MAIN.W, MAIN.H);
    },
    frame: () => MAIN.ctx.drawImage(Layers.frame, 0, 0, MAIN.W, MAIN.H),
    transform (ctx, {sk, sc, ro, st, x, y}, img) { //translate -> skew -> scale -> rotate -> stretch
        sk ??= 0, sc ??= 1, ro ??= 0, st ??= 1, x ??= 0, y ??= 0;
        x /= 100; y /= 100;
        let drawing = img ? {W: img.naturalWidth, H: img.naturalHeight} : {W: MAIN.H, H: MAIN.H};
        if (img) {
            img.fit ??= Draw.transform.fit(drawing, {xW: drawing.W - MAIN.W, xH: drawing.H - MAIN.H});
            drawing.W *= img.fit, drawing.H *= img.fit;
        }
        drawing.hW = drawing.W/2, drawing.hH = drawing.H/2;

        let cos = Math.cos(ro*Math.PI), sin = Math.sin(ro*Math.PI), tan = Math.tan(sk*Math.PI);
        x = -x*(MAIN.hW+drawing.hW)-MAIN.hW, y = y*(MAIN.hH+drawing.hH)-MAIN.hH;
        ctx.setTransform(sc*cos, sc*st*sin, sc*(cos*tan-sin), sc*st*(sin*tan+cos), x*sc*cos+y*sc*(cos*tan-sin)-x, x*sc*st*sin+y*sc*st*(sin*tan+cos)-y);
        return {x: Math.round(-x-drawing.hW), y: Math.round(-y-drawing.hH), W: drawing.W, H: drawing.H};
    },
    image (label) {
        let {img, cvs, ctx, dataset: {sc, ro, st, x, y, opacity, bl, sh, co, fl}} = label, W, H;
        Draw.clear(ctx);
        ctx.save();
        ({x, y, W, H} = Draw.transform(ctx, {sc, ro, st, x, y}, img));
        (parseFloat(bl) || parseFloat(sh) || parseFloat(co) != 1) &&
            (ctx.filter = `blur(${bl || 0}px) drop-shadow(0 0 ${sh || 0}px #010101) contrast(${co || 1})`);
        ctx.globalAlpha = opacity ?? 1;
        if (fl == 1) {
            ctx.translate(x + W, y);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, W, H);
        } else
		    ctx.drawImage(img, x, y, W, H);
        ctx.restore();
        label.bitmap?.close() || (label.bitmap = null);
        createImageBitmap(cvs).then(bm => [label.bitmap, label.dirty] = [bm, false]);
    },
    color (label) {
        let {ctx, dataset: {path, shape, side, gradient: type, sk, sc, ro, x, y, angle}} = label;
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

        let colors = [1,2,3].map(i => Draw.color.format(label.dataset[`color${i}`], label.dataset[`opacity${i}`])).filter(c => c);
        (colors.length === 1 || type == 'Conic') && colors.push(colors[0]);
        colors.forEach((c, i, ar) => gradient.addColorStop(i / (ar.length - 1), c));
        label.style.background = `${type}-gradient(${colors.join(',')}),white`;

        ctx.fillStyle = gradient;
        path = path ? new Path2D(path) : shape ? Draw.polygon(x, y, shape, side) : null;
        path ? ctx.fill(path) : ctx.fillRect(x, y, MAIN.H, MAIN.H);
        ctx.restore();
    },
    polygon (x, y, shape, side, r = MAIN.hH) {
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
