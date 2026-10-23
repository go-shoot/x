import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import PI from 'https://aeoq.github.io/pointer-interaction.mjs';

class Model {
    static observer = new IntersectionObserver(entries => entries.forEach(en => 
        en.isIntersecting ? en.target.Model.render().then(M => M.onIntersect?.()) : en.target.Model.dispose()
    ), {threshold: .1});
    #type; #initiation; #animation;
    constructor(data, options = {}) {
        Object.assign(this, options);
        if (Array.isArray(data)) {
            this.#type = 'bey';
            this.beys = data.map(parts => new Model.Bey(this, parts));
        } else {
            data = Object.entries(data);
            this.#type = Array.isArray(data[0][1]) ? 'list' : 'part';
            data.length === 1 && ([this.comp, this.code] = data[0]);
        }
        this.setup.canvas(Array.isArray(this.code) ? Q('#models canvas') ?? options.canvas : undefined);
    }
    setup = {
        canvas: canvas => {
            this.canvas = canvas ?? E('canvas');
            Object.assign(this.canvas, {Model: this, ...this.#type == 'part' ? {classList: this.comp, title: this.code} : {}});
            Model.observer.observe(this.canvas);
            this.#type == 'list' && this.canvas.parentElement?.append(...this.code.map(c => E('code', c)));
        },
        scene: () => {
            this._renderer = new THREE.WebGPURenderer({alpha: true, antialias: true, canvas: this.canvas});
            this._renderer.setPixelRatio(window.devicePixelRatio);
            this.#initiation = this._renderer.init();
            this._scene = new THREE.Scene().add(
                new THREE.AmbientLight(0xffffff, 0.2),
                ...[[0,5,0], [0,-5,0], [-1,1,5], [1,-1,-5]].map((point, i) => {
                    let light = new THREE.DirectionalLight(0xffffff, 2 + i % 2);
                    light.position.set(...point);
                    return light;
                })
            );
        },
        camera: (group = this.group, V = new THREE.Vector3()) => {
            let box = new THREE.Box3().setFromObject(group);
            let size = Math.max(...Object.values(box.getSize(V)));
            group.updateMatrixWorld(true);
            let center = box.getCenter(V);
            if (this._camera) {
                this._camera.position.y += center.y - (this._camera.$lastY ?? center.y);
            } else {
                let distance = Math.abs(size / 2 / Math.tan(Math.PI / 4 / 2)) * 1.25 / (Model.#scale[this.comp] ?? 1);
                this.#type == 'bey' && (distance *= Math.max(innerWidth / innerHeight, innerHeight / innerWidth));
                this._camera = new THREE.PerspectiveCamera();
                this._camera.position.set(center.x, center.y, center.z + distance);
            }
            this._camera.$lastY = center.y;
            this._camera.updateProjectionMatrix();
            return center;
        },
        orbital: () => {
            let center = this.setup.camera(this.beys?.[0].group);
            let controls = this._controls ??= new OrbitControls(this._camera, this.canvas);
            controls.enableDamping = true;
            controls.target.copy(center);
            this.#type == 'bey' && controls.pan(0, 20);
        },
    }
    fetch = (code, {i, comp} = {}) => Model.fetch(/^.X/.test(code) ? 
            `/x-model/${code.replace('-', '')}/${this.comp || comp}.glb` : 
            `/x-model/hasbro/${code}.glb`
        ).then(model => {
            model.$comp = this.comp || comp;
            this.#prepare.for[this.#type]?.(model, i);
            this.#render();
            return model;
        }).catch(er => `${er}`.includes('404') ?
            this.#type == 'part' ? this.canvas.replaceWith(E('span', '未有模型', {title: this.canvas.title})) : '' :
            console.error(er)
        )
    #prepare = {for: {
        part: model => {
            this.#transform(model, 1);
            this._scene.add(this.group = model);
        },
        list: (model, i, z = 1) => {
            this.#transform(model, z * .8, z * (2 * i - this.models.length + 1));
            model.$codeNode = this.list.code(i);
            Model.get.color(model).then(color => model.$color = color).catch(console.error);
            this._scene.add(model);
        },
        bey: (model, i = 0) => this.beys[i].group.add(model)
    }}
    #transform (model, scale, x = 0, V = new THREE.Vector3()) {
        const box = new THREE.Box3().setFromObject(model);
        scale *= 2 / Math.max(...Object.values(box.getSize(V)));
        model.scale.multiplyScalar(scale);
        Object.assign(model.rotation, Model.#rotate[this.comp] ?? Model.#rotate.blade);
        model.position.set(x, 0, 0).sub(box.getCenter(V).multiplyScalar(scale).applyEuler(model.rotation));
    }
    list = {
        setup: (count, H, z = 1) => {
            E(this.canvas.parentElement).set({'--count': count});
            this._renderer.setSize(H * count, H);
            this._camera = new THREE.OrthographicCamera(-z * count, z * count, z, -z);
            Object.assign(this._camera, {left: -z * count, right: z * count});
            this._camera.position.z = 100;
        },
        code: i => this.canvas.parentElement?.children[i + 1],
        events: () => {
            this.canvas.onclick = ev => {
                ev.stopPropagation();
                let {x, width: w} = this.canvas.getBoundingClientRect();
                let i = Math.floor((ev.clientX - x) / w * this.models.length);
                this.onclick(this.list.code(i).innerText);
            }
            PI.events([[this.canvas.parentElement, {scroll: {x: true}}]]);
        },
        reorder: (by, z = 1) => {
            let sorted = by == '$color' ?
                this.models.toSorted((m, n) => m?.[by] == null ? 1 : n?.[by] == null ? -1 : (m[by][0] || 0) - (n[by][0] || 0)) :
                this.models;
            sorted.forEach((g, i) => g.position && (g.position.x = z * (2 * i - this.models.length + 1)));
            this.canvas.parentElement?.replaceChildren(this.canvas, ...sorted.map(g => g.$codeNode));
            this.#render();
        }
    }
    async render () {
        this.setup.scene();
        const {clientHeight: H} = this.canvas.parentElement ?? this.canvas;
        if (this.#type == 'list') {
            this.list.setup(this.code.length, H);
            this.list.events();
            this.models = this.code.map((c, i) => this.fetch(c, {i}));
            this.models = (await Promise.allSettled(this.models)).map(p => p.value).filter(model => model);
            this.list.setup(this.models.length, H);
            this.list.reorder();
        } else {
            this._renderer.setSize(H, H);
            if (this.#type == 'part')
                this.fetch(this.code);
            else if (this.#type == 'bey')
                await Promise.all(this.beys.map(bey => bey.fetching))
                .then(() => this.beys.forEach((bey, i) => this._scene.add(bey.group) && bey.assemble(i)));
        }
        return this;
    }
    #render () {
        if (this.#type == 'list') 
            return requestAnimationFrame(() => this.#initiation.then(r => r.render(this._scene, this._camera)));
        this.setup.orbital();
        this.#animation ?? this.#animate();
    }
    #animate () {
        this.#animation = requestAnimationFrame(() => this.#animate());
        this._controls?.update();
        if (typeof this.beys?.[0].bit == 'object') {
            this.opened ??= 0;
            let delta = this.open === true && this.opened < 7 ? .2 : this.open === false && this.opened > 0 ? -.2 : 0;
            this.opened += delta;
            this.beys.forEach(bey => bey.transform({spread: delta, rotate: this.speed}));
        }
        this.#initiation.then(r => r.render(this._scene, this._camera));
    }
    dispose () {
        if (!this.canvas.dataset.engine) return;
        this.#animation &&= cancelAnimationFrame(this.#animation);
        this._scene?.traverse(child => this.#dispose(child));
        this._scene?.clear();
        this.#dispose('_controls', '_renderer');
        Model.observer.unobserve(this.canvas);
        let old = this.canvas;
        this.setup.canvas(Array.isArray(this.code) ? E('canvas') : undefined);
        old.replaceWith(this.canvas);
    }
    #dispose = (...items) => items.forEach(item => 
        typeof item == 'string' ? this[item] = this[item]?.dispose() : Model.dispose(item)
    )
    static dispose (item) {
        [item.geometry, item.material].flat().forEach(item => {
            item?.dispose();
            Object.values(item ?? {}).forEach(item => item?.isTexture && item.dispose());
        });
        item.geometry = item.material = null;
    }
    static fetch = url => new Promise((res, rej) => Model.loader.load(url, gltf => res(gltf.scene), null, er => rej(er)))
    static get = {
        child (model, ...names) {
            if (!model) return;
            for (let n of names) {
                let child = model.getObjectByName(n);
                child?.updateWorldMatrix(true, true);
                if (child) return child;
            }
        },
        color: model => new Promise(res => {
            let colors = new Set();
            model.traverse(child => child.isMesh && (({h, s}) => colors.add(s > 0 && h))(child.material?.color?.getHSL({}) ?? {}));
            res([...colors].sort((a, b) => a === false ? 1 : b === false ? -1 : 0));
        })
    }
    static #scale = {chip: 0.8, bit: 1.2}
    static #rotate = {
        blade: {x: Math.PI/2, y: Math.PI},
        ratchet: {x: -Math.PI/3},
        bit: {x: -Math.PI/6, z: -Math.PI/12}
    }
    static meta = {}
    static {
        const draco = new DRACOLoader();
        draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
        Model.loader = new GLTFLoader();
        Model.loader.setDRACOLoader(draco);
        Model.meta.CXX = new Set(['over', 'metal']);
        Model.meta.CX = new Set(['chip', ...Model.meta.CXX, 'main', 'assist']);
    }
}
Model.Bey = class {
    #Parent;
    constructor(parent, parts) {
        this.#Parent = parent;
        let fetching = Promise.all(Object.entries(parts).map(async ([comp, p]) =>
            this[comp] = new Model.BeyPart(this, {model: await parent.fetch(p.code || p.abbr, {comp}), ...p})
        ));
        Object.defineProperties(this, {
            group: {value: new THREE.Group()},
            specs: {value: [], writable: true}, 
            fetching: {value: fetching}
        });
    }
    async replace (comp, after) {
        typeof after == 'string' && (after = await this.#Parent.fetch(after, {comp}));
        if (!after) return {};
        after = new Model.BeyPart(this, {model: after});
        let removal = comp == 'blade' ? new Set([...Model.meta.CX]) : new Set();
        if (comp == 'blade' && after.fused) {
            removal.add('ratchet');
            this.bit?.fused && removal.add('bit');
        } else if (Model.meta.CX.has(comp)) {
            comp == 'main' ? removal = Model.meta.CXX : Model.meta.CXX.has(comp) && removal.add('main');
            removal.add('blade');
        } else if (comp == 'bit' && after.fused) {
            removal.add('ratchet');
            this.blade?.fused && removal.add('blade');
        } else if (comp == 'ratchet') {
            this.blade?.fused && removal.add('blade');
            this.bit?.fused && removal.add('bit');
        }
        removal.add(comp).forEach(c => this[c]?.remove());
        return this[comp] = after;
    }
    assemble (i) {
        if (!this.bit) return;
        let assembly = new Model.BeyAssembly(this).stack('bit').mode().place('ratchet').stack();
        if (this.blade) {
            assembly.place('blade').mode();
        } else if (this.assist) {
            assembly = assembly.place('assist').stack().mode();
            (this.metal ? ['metal','over'] : ['main']).reduce((chain, c) => chain.place(c).mode(), assembly).place('chip');
        }
        let x = this.group.position.x;
        i !== false && this.compute();
        this.transform({x: typeof i == 'number' ? i * 50 : x});
        this.#Parent.onAssemble?.();
    }
    transform ({spread = this.#Parent.opened, rotate, x}) {
        if (spread) {
            ['ratchet','blade','assist','main','metal','over','chip']
            .filter(c => this[c]?.model).forEach((c, i) => this[c].model.position.y += (i + 1) * spread);
            this.#Parent.setup.camera(this.group);
        }
        rotate && (this.group.rotation.y += rotate);
        x && (this.group.position.x = x);
    }
    compute () {
        let metals = [];
        this.group.position.x = 0; //for computation
        this.group.updateMatrixWorld(true);
        this.group.traverse(child => 
            [child.name, child.material?.name].some(n => /^BXH14|metal/i.test(n)) && child.geometry
            && metals.push(Model.Bey.compute.gravity(child))
        );
        let [area, moment2] = ['area', 'moment2'].map(p => Math.sumPrecise(metals.map(part => part[p])));
        let [x, y, z] = ['x', 'y', 'z'].map(p => Math.sumPrecise(metals.map(item => item.area / area * item[p])));
        this.specs = [
            new THREE.Box3().setFromObject(this.group).getSize(new THREE.Vector3()).y,
            y, Math.hypot(x, z), Math.sqrt(moment2 / area)
        ];
    }
    static compute = {gravity (child, v = [...Array(5)].map(_ => new THREE.Vector3())) {
        let {attributes: {position}, index} = child.geometry;
        let cloned = position;
        if (child.applyBoneTransform) {
            cloned = position.clone();
            for (let i = 0; i < position.count; i++)
                cloned.setXYZ(i, ...child.applyBoneTransform(i, v[3].fromBufferAttribute(position, i)));
        }
        let center = v[4].set(0, 0, 0), totalArea = 0, moment2 = 0;
        for (let i = 0; i < index.count / 3; i++) {
            for (let j = 0; j < 3; j++)
                v[j].fromBufferAttribute(cloned, index.getX(i * 3 + j)).applyMatrix4(child.matrixWorld);
            let area = v[3].crossVectors(v[1].clone().sub(v[0]), v[2].clone().sub(v[0])).length() / 2;
            totalArea += area;
            center.add(v[0].clone().add(v[1]).add(v[2]).multiplyScalar(area / 3));
            moment2 += (Math.pow(v[0].x + v[1].x + v[2].x, 2) + Math.pow(v[0].z + v[1].z + v[2].z, 2)) * area / 9;
        }
        center.divideScalar(totalArea);
        return {
            name: child.name,
            area: totalArea,
            moment2, ...center
        };
    }}
}
Model.BeyPart = class {
    #model; #adjust; #Bey;
    constructor(bey, {adjust, ...rest}) {
        this.#Bey = bey;
        Object.assign(this, rest);
        this.#adjust = adjust ?? {rotation: 0};
    }
    get model() {return this.#model;}
    set model(model) {
        this.#model && (this.#adjust = {rotation: 0}) && this.remove(false);
        this.#Bey.group.add(this.#model = model);
    }
    get adjust() {return this.#adjust;}
    set adjust(adjust) {
        this.#adjust = adjust;
        this.#Bey.assemble(false);
    }
    get fused() {
        let model = this.model.$comp == 'bit' && Model.get.child(this.model, 'Bit_part01', 'Bit_parts01') || this.model;
        return new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y > 20;
    }
    remove (del = true) {
        this.#Bey.group.remove(this.model) && this.model.traverse(child => Model.dispose(child));
        if (del) delete this.#Bey[this.model.$comp];
    }
}
Model.BeyAssembly = class {
    constructor(parts, adjust) {
        this.bey = parts, this.adjust = adjust;
        this.stackHeight = 0;
    }
    #model = comp => (comp ? this.comp = comp : comp = this.comp) && this.bey[comp] || {}
    place (comp) {
        let {model, adjust} = this.#model(comp);
        if (!model) return this;
        model.position.y = 0; //init
        model.position.y = this.stackHeight - new THREE.Box3().setFromObject(model).min.y;
        model.position.y += ({main: .6, metal: .6, over: .6, chip: -1.3}[comp] ?? 0);
        model.rotation.y = (adjust?.rotation ?? 0) / -180 * Math.PI;
        return this;
    }
    stack (comp) {
        let {model} = this.#model(comp);
        if (!model) return this;
        this.stackHeight = new THREE.Box3().setFromObject(
            comp == 'bit' && Model.get.child(model, 'Bit_part01', 'Bit_parts01') || model
        ).max.y; //evaluate only until now
        this.stackHeight > 20 && (comp = 'ratchet');
        this.stackHeight += ({bit: -1.7, ratchet: -4.1}[comp] ?? 0);
        return this;
    }
    mode (comp) {
        let {model, adjust: {abbr, mode} = {}} = this.#model(comp) ?? {};
        if (!abbr) return this;
        let param = Model.BeyAssembly.modes[this.comp]?.find(abbr);
        if (!param) return this;
        Array.isArray(param) ?
            [param].flat().forEach(([bone, prop, axis, amount]) => 
                Model.get.child(model, bone)[prop][axis] += (mode ? 1 : -1) * amount
            ) :
            this.stackHeight += param[mode];
        delete this.#model(comp).adjust.abbr;
        return this;
    }
    static modes = {
        bit: new O([
            [/^T[A-Z]/, {true: -2, false: 0}]
        ]),
        assist: new O([
            [['D','T'], [['AssistBlade_Mode_Bone', 'rotation', 'z', Math.PI]]]
        ]),
        main: new O({
            Ec: [['Blade_Mode_Bone', 'rotation', 'z', Math.PI], ['Blade_Mode_Bone', 'position', 'y', -.2]]
        }),
        blade: new O({
            ScSp: [['Gimmickblade_Bone', 'rotation', 'y', Math.PI]], 
            HlNt: [['Base_Switch_Bone', 'position', 'y', -5.5]]
        })
    }
}
export default Model;
