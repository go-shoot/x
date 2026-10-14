import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import PI from 'https://aeoq.github.io/pointer-interaction.mjs';window.PI=PI;

class Model {
    static observer = new IntersectionObserver(entries => entries.forEach(en => 
        en.isIntersecting ? en.target.Model.render().then(M => M.intersect?.()) : en.target.Model.dispose()
    ), {threshold: .1});
    #type; #initiation; #animation; #opened = 0;
    constructor(parts, options = {}) {
        Object.assign(this, options);
        parts = this.parts = Object.entries(parts);
        this.#type = parts.length > 1 ? 'bey' : Array.isArray(parts[0][1]) ? 'list' : 'part';
        parts.length === 1 && ([this.comp, this.code] = parts[0]);
        this.#setup.canvas(Array.isArray(this.code) ? Q('#models canvas') ?? options.canvas : undefined);
    }
    #setup = {
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
            this._scene = new THREE.Scene();
            this._scene.add(new THREE.AmbientLight(0xffffff, 0.2));
            [[0,5,0],[0,-5,0],[-1,0,5],[1,0,5]].forEach((point, i) => {
                let light = new THREE.DirectionalLight(0xffffff, 2 + i % 2);
                light.position.set(...point);
                light.target.position.set(0, 0, 0);
                this._scene.add(light, light.target); 
            });
        },
        camera: (V = new THREE.Vector3()) => {
            let box = new THREE.Box3().setFromObject(this.group);
            let size = Math.max(...Object.values(box.getSize(V)));
            this.group.updateMatrixWorld(true);
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
            let center = this.#setup.camera();
            let controls = this._controls ??= new OrbitControls(this._camera, this.canvas);
            controls.enableDamping = true;
            controls.target.copy(center);
            this.#type == 'bey' && controls.pan(0, 20);
            controls.update();
        },
    }
    fetch = (code, iORcomp) => Model.fetch(/^.X/.test(code) ? 
            `/x-model/${code.replace('-', '')}/${this.comp || iORcomp}.glb` : 
            `/x-model/hasbro/${code}.glb`
        ).then(model => {
            model.$comp = this.comp || iORcomp;
            this.#prepare.for[this.#type](model, iORcomp);
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
        bey: model => this.group.add(model)
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
            Object.assign(this._camera, { left: -z * count, right: z * count });
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
    bey = Object.defineProperties({}, {
        replace: {value: async (comp, after) => {
            typeof after == 'string' && (after = await this.fetch(after, comp));
            if (!after) return {};
            after = new Model.BeyPart(this, {model: after});
            let removal = comp == 'blade' ? Model.meta.CX : new Set();
            if (comp == 'blade' && after.fused) {
                removal.add('ratchet');
                this.bey.bit.fused && removal.add('bit');
            } else if (Model.meta.CX.has(comp)) {
                comp == 'main' ? removal = Model.meta.CXX : Model.meta.CXX.has(comp) && removal.add('main');
                removal.add('blade');
            } else if (comp == 'bit' && after.fused) {
                removal.add('ratchet');
                this.bey.blade.fused && removal.add('blade');
            } else if (comp == 'ratchet') {
                this.bey.blade?.fused && removal.add('blade');
                this.bey.bit?.fused && removal.add('bit');
            }
            removal.add(comp).forEach(c => this.bey[c]?.remove());
            return this.bey[comp] = after;
        }},
        assemble: {value: () => {console.log('assemble')
            if (!this.bey.bit) return;
            let assembly = new Model.Assembly(this.bey).stack('bit').mode().place('ratchet').stack();
            if (this.bey.blade) {
                assembly.place('blade').mode();
            } else if (this.bey.assist) {
                assembly = assembly.place('assist').stack().mode();
                (this.bey.metal ? ['metal','over'] : ['main']).reduce((chain, c) => chain.place(c).mode(), assembly).place('chip');
            }
            this.bey.compute().spread(this.#opened);
            this.assemble?.();
        }},
        spread: {value: amount => {
            if (!amount) return; 
            ['ratchet','blade','assist','main','metal','over','chip']
            .filter(c => this.bey[c]?.model).forEach((c, i) => this.bey[c].model.position.y += (i + 1) * amount);
            this.#setup.camera();
        }},
        compute: {value: () => {
            this.group.updateMatrixWorld(true);
            let metals = [];
            this.group.traverse(c => {
                if (!/metal/i.test(c.name) && !/metal/i.test(c.material?.name) || !c.geometry || !c.applyBoneTransform) return;
                let {center, volume} = Model.compute.gravity(c);
                metals.push({name: c.name, volume, x: center.x, y: center.y, z: center.z});
            });//console.log(metals);
            let totalVol = Math.sumPrecise(metals.map(part => part.volume))
            metals = ['x', 'y', 'z'].map(p => Math.sumPrecise(metals.map(item => item.volume / totalVol * item[p])));
            Object.assign(this.group, {
                $metalCenter: Math.hypot(metals[0], metals[2]),
                $metalHeight: metals[1],
                $height: new THREE.Box3().setFromObject(this.group).getSize(new THREE.Vector3()).y
            });
            return this.bey;
        }}
    })
    async render () {
        this.#setup.scene();
        const {clientHeight: H} = this.canvas.parentElement ?? this.canvas;
        if (this.#type == 'list') {
            this.list.setup(this.code.length, H);
            this.list.events();
            this.models = this.code.map((c, i) => this.fetch(c, i));
            this.models = (await Promise.allSettled(this.models)).map(p => p.value).filter(model => model);
            this.list.setup(this.models.length, H);
            this.list.reorder();
        } else {
            this._renderer.setSize(H, H);
            if (this.#type == 'part')
                this.fetch(this.code);
            else if (this.#type == 'bey') {
                this._scene.add(this.group = new THREE.Group());
                await Promise.all(this.parts.map(async([comp, d]) => 
                    this.bey[comp] = new Model.BeyPart(this, {model: await this.fetch(d.code || d.abbr, comp), ...d})
                ));
                this.bey.assemble();
            }
        }
        return this;
    }
    #render () {
        if (this.#type == 'list') 
            return requestAnimationFrame(() => this.#initiation.then(r => r.render(this._scene, this._camera)));
        this.#setup.orbital();
        this.#animation ?? this.#animate();
    }
    #animate () {
        this.#animation = requestAnimationFrame(() => this.#animate());
        this._controls?.update();
        this.group && this.speed && (this.group.rotation.y += this.speed);
        if (typeof this.bey.bit == 'object') {
            let amount = this.open === true && this.#opened < 7 ? .2 : this.open === false && this.#opened > 0 ? -.2 : 0;
            this.#opened += amount;
            this.bey.spread(amount);
        }
        this.#initiation.then(r => r.render(this._scene, this._camera));
    }
    dispose () {
        if (!this.canvas.dataset.engine) return;
        this.#animation &&= cancelAnimationFrame(this.#animation);
        this._scene?.traverse(child => this.#dispose(child));
        this.#dispose('_controls', '_renderer');
        Model.observer.unobserve(this.canvas);
        let old = this.canvas;
        this.#setup.canvas(Array.isArray(this.code) ? E('canvas') : undefined);
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
        draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        Model.loader = new GLTFLoader();
        Model.loader.setDRACOLoader(draco);
        Model.meta.CXX = new Set(['over', 'metal']);
        Model.meta.CX = new Set(['chip', ...Model.meta.CXX, 'main', 'assist']);
    }
}
Model.BeyPart = class {
    #model; #adjust;
    constructor(model, {adjust, ...rest}) {
        this.BeyModel = model;
        Object.assign(this, rest);
        this.#adjust = adjust ?? {rotation: 0};
    }
    get model() {return this.#model;}
    set model(model) {
        this.#model && (this.#adjust = {rotation: 0}) && this.remove(false);
        this.BeyModel.group.add(this.#model = model);
    }
    get adjust() {return this.#adjust;}
    set adjust(adjust) {
        this.#adjust = adjust;
        this.BeyModel.bey.assemble();
    }
    get fused() {
        let model = this.model.$comp == 'bit' && Model.get.child(this.model, 'Bit_part01', 'Bit_parts01') || this.model;
        return new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y > 20;
    }
    remove (del = true) {
        this.BeyModel.group.remove(this.model) && this.model.traverse(child => Model.dispose(child));
        if (del) delete this.BeyModel.bey[this.model.$comp];
    }
}
Model.Assembly = class {
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
        let param = Model.Assembly.modes[this.comp]?.find(abbr);
        if (!param) return this;
        if (Array.isArray(param)) {
            let [bone, prop, axis, amount] = param;
            Model.get.child(model, bone)[prop][axis] += (mode ? 1 : -1) * amount;
        } else
            this.stackHeight += param[mode];
        delete this.#model(comp).adjust.abbr;
        return this;
    }
    static modes = {
        bit: new O([
            [/^T[A-Z]/, {true: -2, false: 0}]
        ]),
        assist: new O([
            [['D','T'], ['AssistBlade_Mode_Bone', 'rotation', 'z', Math.PI]]
        ]),
        main: new O({
            Ec: ['Blade_Mode_Bone', 'rotation', 'z', Math.PI]
        }),
        blade: new O({
            ScSp: ['Gimmickblade_Bone', 'rotation', 'y', Math.PI], 
            HlNt: ['Base_Switch_Bone', 'position', 'y', -5.5]
        })
    }
}
Model.compute = {
    gravity (child, v = [...Array(4)].map(_ => new THREE.Vector3())) {
        let {position} = child.geometry.attributes, index;
        let skinnedPos = position.clone();
        for (let i = 0; i < position.count; i++) {
            v[3].fromBufferAttribute(position, i);
            child.applyBoneTransform(i, v[3]);
            skinnedPos.setXYZ(i, v[3].x, v[3].y, v[3].z);
        }
        let skinned = child.geometry.clone();
        skinned.setAttribute('position', skinnedPos);
        ({attributes: {position}, index} = skinned);
        let center = {x: 0, y: 0, z: 0}, totalVol = 0;
        for (let i = 0; i < index.count / 3; i++) {
            v.forEach((v, j) => v.fromBufferAttribute(position, index.getX(i * 3 + j)));
            v[3].crossVectors(v[1], v[2]);
            let vol = v[0].dot(v[3]) / 6;
            totalVol += vol;
            ['x', 'y', 'z'].forEach(a => center[a] += vol * Math.sumPrecise(v.slice(0, 3).map(v => v[a])) / 4);
        }
        return {
            center: new THREE.Vector3(...Object.values(center).map(c => c/totalVol)).applyMatrix4(child.matrixWorld),
            volume: Math.abs(totalVol)
        };
    },
};
export default Model;