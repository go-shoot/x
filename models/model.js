import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import PI from 'https://aeoq.github.io/pointer-interaction.mjs';window.PI=PI;

class Model {
    static observer = new IntersectionObserver(entries => entries.forEach(en => 
        en.isIntersecting ? en.target.Model.render().then(M => M.intersect?.()) : en.target.Model.dispose()
    ), {threshold: .1});
    #mode; #animation;
    constructor(parts, canvas, callbacks = {adjust: {}}) {
        Object.assign(this, callbacks);
        parts = Object.entries(this.parts = parts);
        this.#mode = parts.length > 1 ? 'bey' : Array.isArray(parts[0][1]) ? 'list' : 'part';
        parts.length === 1 && ([this.comp, this.code] = parts[0]);
        this.#setup.canvas(Array.isArray(this.code) ? canvas : undefined);
    }
    #setup = {
        canvas: canvas => {
            this.canvas = canvas ?? E('canvas');
            Object.assign(this.canvas, {Model: this, ...this.#mode == 'part' ? {classList: this.comp, title: this.code} : {}});
            Model.observer.observe(this.canvas);
            this.#mode == 'list' && this.canvas.parentElement?.append(...this.code.map(c => E('code', c)));
        },
        scene: () => {
            this._renderer = new THREE.WebGPURenderer({alpha: true, antialias: true, canvas: this.canvas});
            this._renderer.setPixelRatio(window.devicePixelRatio);
            this._renderer.init();
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
            let size = box.getSize(V);
            this.group.updateMatrixWorld(true);
            this.group.$height = size.y;
            size = Math.max(...Object.values(size));
            let center = box.getCenter(V);
            if (this._camera) {
                this._camera.position.y = center.y;
            } else {
                let distance = Math.abs(size / 2 / Math.tan(Math.PI / 4 / 2)) * 1.25 / (Model.#scale[this.comp] ?? 1);
                this.#mode == 'bey' && (distance *= Math.max(innerWidth / innerHeight, innerHeight / innerWidth));
                this._camera = new THREE.PerspectiveCamera();
                this._camera.position.set(center.x, center.y, center.z + distance);
            }
            this._camera.updateProjectionMatrix();
            return center;
        },
        orbital: () => {
            let center = this.#setup.camera();
            let controls = this._controls ??= new OrbitControls(this._camera, this.canvas);
            controls.enableDamping = true;
            controls.target.copy(center);
            controls.update();
        },
    }
    fetch = (code, iORcomp) => Model.fetch(/^.X/.test(code) ? 
            `/x-model/${code.replace('-', '')}/${this.comp || iORcomp}.glb` : 
            `/x-model/hasbro/${code}.glb`
        ).then(model => {
            model.$comp = this.comp || iORcomp;
            this.#prepare.for[this.#mode](model, iORcomp);
            this.#render();
            return model;
        }).catch(er => `${er}`.includes('404') ?
            this.#mode == 'part' ? this.canvas.replaceWith(E('span', '未有模型', {title: this.canvas.title})) : '' :
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
        bey: (model, code) => {
            let bitAnchor = model.$comp == 'bit' && Model.get.child(model, 'Bit_part01', 'Bit_parts01');
            let box = bitAnchor || new THREE.Box3().setFromObject(model);
            model.$height = box.getSize(new THREE.Vector3()).y;
            model.$y = box.min.y;
            model.$code = code;
            this.group.add(model);
        }
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
            this.#render();
            this.canvas.parentElement?.replaceChildren(this.canvas, ...sorted.map(g => g.$codeNode));
        }
    }
    bey = {
        replace: (comp, after) => {
            let before = this.parts[comp];
            before && this.group.remove(before) && before?.traverse(child => this.#dispose(child));
            (this.parts[comp] = after) && this.group.add(after);
        },
        adjust: (adjust = this.adjust, P = this.parts) => {
            adjust?.each(([comp, {rotation: angle}]) => 
                P[comp] && angle != null && (P[comp].rotation.y = angle * Math.PI)
            );
            let height = c => stackHeight - P[c].$y - Model.#lower[c] + (adjust[c]?.position ?? 0);
            let stackHeight = P.bit.$height;
            if (P.ratchet) {
                P.ratchet.position.y = height('ratchet');
                stackHeight += P.ratchet.$height + (adjust.ratchet?.position ?? 0);
            }
            if (P.blade) {
                P.blade.position.y = (/^.X-?\d/.test(P.blade.$code) || P.ratchet ? 0 : 4) + height('blade');
                this.group.$metalHeight = Model.get.child(P.blade, ...Model.#child.blade).min.y;
            } else if (P.assist) {
                P.assist.position.y = height('assist');
                stackHeight += P.assist.$height + (adjust.assist?.position ?? 0);;
                ['main', 'metal', 'over', 'chip'].forEach(c => P[c] && (P[c].position.y = height(c)));
                this.group.$metalHeight = Model.get.child(P.main || P.metal, ...Model.#child.blade).min.y;
            }
            this.#setup.camera();
        }
    }
    async render () {
        this.#setup.scene();
        const {clientHeight: H} = this.canvas.parentElement ?? this.canvas;
        if (this.#mode == 'list') {
            this.list.setup(this.code.length, H);
            this.list.events();
            this.models = this.code.map((c, i) => this.fetch(c, i));
            this.models = (await Promise.allSettled(this.models)).map(p => p.value).filter(model => model);
            this.list.setup(this.models.length, H);
            setTimeout(() => this.list.reorder());
        } else {
            this._renderer.setSize(H, H);
            if (this.#mode == 'part')
                this.fetch(this.code);
            else if (this.#mode == 'bey') {
                this._scene.add(this.group = new THREE.Group());
                let models = Object.entries(this.parts).map(([comp, code]) => this.fetch(code, comp));
                models = await Promise.all(models);
                this.parts = {...new O(this.parts).map(([comp], i) => [comp, models[i]])};
                this.bey.adjust();
            }
        }
        return this;
    }
    #render () {
        if (this.#mode == 'list') return this._renderer?.render(this._scene, this._camera);
        this.#setup.orbital();
        this.#animation ?? this.#animate();
    }
    #animate () {
        this.#animation = requestAnimationFrame(() => this.#animate());
        this.group && this.speed && (this.group.rotation.y += this.speed);
        this._controls?.update();
        this._renderer?.render(this._scene, this._camera);
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
    #dispose = (...items) => items.forEach(item => {
        if (typeof item == 'string') {
            this[item]?.dispose();
            return this[item] = null;
        }
        [item.geometry, item.material].flat().forEach(item => {
            item?.dispose();
            Object.values(item ?? {}).forEach(item => item?.isTexture && item.dispose());
        });
        item.geometry = item.material = null;
    })
    static fetch = url => new Promise((res, rej) => Model.loader.load(url, gltf => res(gltf.scene), null, er => rej(er)))
    static get = {
        child (model, ...names) {
            for (let n of names) {
                let child = model.getObjectByName(n);
                child?.updateWorldMatrix(true, true);
                if (child) return new THREE.Box3().setFromObject(child);
            }
        },
        color: model => new Promise(res => {
            let colors = new Set();
            model.traverse(child => child.isMesh && (({h, s}) => colors.add(s > 0 && h))(child.material?.color?.getHSL({}) ?? {}));
            res([...colors].sort((a, b) => a === false ? 1 : b === false ? -1 : 0));
        })
    }
    static #lower = {ratchet: 1.5, blade: 5.5, assist: 5.5, main: 9, metal: 9, over: 8.5, chip: 10.75}
    static #scale = {chip: 0.8, bit: 1.2}
    static #rotate = {
        blade: {x: Math.PI/2, y: Math.PI},
        ratchet: {x: -Math.PI/3},
        bit: {x: -Math.PI/6, z: -Math.PI/12}
    }
    static #child = {
        blade: ['Head_metal', 'Base_metal', 'Headparts_metal', 'Had_metal', 'Material_metal']
    }
    static {
        const draco = new DRACOLoader();
        draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        Model.loader = new GLTFLoader();
        Model.loader.setDRACOLoader(draco);
    }
}
Model.get.color.distance = (...colors) => {
    const M1 = new THREE.Matrix3().set(
        0.4122214708, 0.5363325363, 0.0514459929,
        0.2119034982, 0.6806995451, 0.1073969566,
        0.0883024619, 0.2817188376, 0.6299787005
    );
    const M2 = new THREE.Matrix3().set(
        0.2104542553,  0.7936177850, -0.0040720468,
        1.9779984951, -2.4285922050,  0.4505937099,
        0.0259040371,  0.7827717662, -0.8086757993
    );
    colors = colors.map(c => {
        c = new THREE.Color(c).convertSRGBToLinear();
        const v = new THREE.Vector3(c.r, c.g, c.b);
        v.applyMatrix3(M1);
        v.set(Math.cbrt(v.x), Math.cbrt(v.y), Math.cbrt(v.z));
        v.applyMatrix3(M2);
        return {L: v.x, C: Math.hypot(v.y, v.z), h: Math.atan2(v.z, v.y)};
    });
    const delta = new O(colors[0]).minus(colors[1]);
    delta.h = 2 * Math.sqrt(colors[0].C * colors[1].C) * Math.sin(Math.atan2(Math.sin(delta.h), Math.cos(delta.h)) / 2);
    return Math.sqrt(
        Math.pow(0 * delta.L, 2) +
        Math.pow(1 * delta.C, 2) +
        Math.pow(2 * delta.h, 2)
    );
};window.Model=Model;
export default Model;