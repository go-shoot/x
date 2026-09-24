import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import PI from 'https://aeoq.github.io/pointer-interaction.mjs';window.PI=PI;

class Model {
    static observer = new IntersectionObserver(entries => entries.forEach(en => 
        en.isIntersecting ? en.target.Model.render() : en.target.Model.destroy()
    ), {threshold: .1});
    constructor(code, comp, canvas) {
        this.code = code, this.comp = comp;
        this.#setup.canvas(Array.isArray(code) ? canvas : undefined);
    }
    #setup = {
        canvas: canvas => {
            this.canvas = canvas ? 
                Object.assign(canvas, {Model: this}) :
                Object.assign(E('canvas'), {Model: this, classList: this.comp, title: this.code});
            Model.observer.observe(this.canvas);
        },
        single: () => {
            let box = new THREE.Box3().setFromObject(this.scene);
            if (box.isEmpty()) return;
            let size = Math.max(...Object.values(box.getSize(new THREE.Vector3()))), fov = 45;
            let distance = Math.abs(size / 2 / Math.tan(fov * Math.PI / 180 / 2)) * 1.25 / (Model.scale[this.canvas.classList] ?? 1);
            let center = box.getCenter(new THREE.Vector3());

            let camera = this.camera = new THREE.PerspectiveCamera(fov, 1, distance / 100, distance * 100);
            camera.position.set(center.x, center.y + size * .2, center.z + distance);
            camera.updateProjectionMatrix();

            let controls = this.controls = new OrbitControls(this.camera, this.canvas);
            controls.enableDamping = true; // Smooth rotation/panning
            controls.target.copy(center);
            controls.update();
        },
        multiple: (z = 1) => {
            this.camera = new THREE.OrthographicCamera(-z * this.code.length, z * this.code.length, z, -z, 0.1, 1000);
            this.camera.position.z = 100;
        }
    }
    #transform = {
        single: (model, group) => {
            const {center} = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
            model.position.copy(center).negate();
            //group.scale.setScalar(0.07 * (Model.scale[this.canvas.classList] ?? 1));
        },
        multiple: (model, group, i, z = 1) => {
            const box = new THREE.Box3(), sphere = new THREE.Sphere();
            box.setFromObject(model);
            box.getBoundingSphere(sphere);
            model.position.sub(sphere.center);
            box.setFromObject(group);
            box.getBoundingSphere(sphere);
            group.scale.multiplyScalar(z / sphere.radius);
            group.position.x = z * (2 * i - this.code.length + 1);
        },
        bey: (models = this.models) => {
            models.ratchet.position.y += (models.bit.y.max - models.ratchet.y.min) - 1.5;
            if (models.assist) {
                models.assist.position.y += (models.ratchet.y.max - models.assist.y.min) - 5.5;
                if (models.main) {
                    models.main.position.y += (models.assist.y.max - models.main.y.min) - 4.5;
                }
                if (models.metal) {
                    models.metal.position.y += (models.assist.y.max - models.metal.y.min) - 5.5;
                }
                if (models.over) {
                    models.over.position.y += (models.assist.y.max - models.over.y.min) - 5.5;
                }
                if (models.chip) {
                    models.chip.rotation.y += Math.PI / 3;
                    models.chip.position.y += (models.assist.y.max - models.chip.y.min) - 5;
                }
            } else if (models.blade) {
                models.blade.position.y += (models.ratchet.y.max - models.blade.y.min) - 5.5;
            }
        }
    }
    #events = {
        multiple: () => {
            this.canvas.onclick = ev => {
                ev.stopPropagation();
                let {x, width: w} = this.canvas.getBoundingClientRect();
                let i = Math.floor((ev.clientX - x) / w * this.code.length);
                let code = (this.sortedGroups ?? this.groups)[i].$code.innerText;
                Q('#preview x-part')?.act.model(null, code);
                Q(`#preview [id='${code}']`)?.Row.select(this.comp);
            }
            PI.events([[this.canvas.parentElement, {scroll: {x: true}}]]);
        }
    }
    async render () {console.log('r',this.canvas.title||'multi')
        this.renderer = new THREE.WebGPURenderer({alpha: true, antialias: true, canvas: this.canvas});
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.scene = new THREE.Scene();
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.2));
        [[0,5,0],[0,0,5],[0,-5,0],[-5,0,0],[5,0,0]].forEach(point => {
            let light = new THREE.DirectionalLight(0xffffff, 2);
            light.position.set(...point);
            light.target.position.set(0, 0, 0);
            this.scene.add(light);
            this.scene.add(light.target); 
        });
        const {clientHeight: H} = this.canvas.parentElement ?? this.canvas;
        if (Array.isArray(this.code)) {
            E(this.canvas.parentElement).set({'--count': this.code.length});
            this.renderer.setSize(H * this.code.length, H);
            this.#setup.multiple();
            this.groups = (await Promise.allSettled(this.code.map((c, i) => this.#fetch('multiple', c, i)))).map(p => p.value);
            this.#events.multiple();
            this.#render();
            return this;
        } 
        this.renderer.setSize(H, H);
        if (typeof this.code == 'object') {
            let models = await Promise.all(
                Object.entries(this.code).map(([comp, code]) => Model.fetch(`/x-model/${code}/${comp}.glb`))
            );
            let bitAnchor = Model.getSubPart(models.at(-1), 'Bit_part01', 'Bit_parts01');
            models.forEach((model, i) => {
                this.scene.add(model);
                let box = new THREE.Box3().setFromObject(i == models.length - 1 ? bitAnchor : model);
                model.y = {max: box.max.y, min: box.min.y};
            });
            this.models = {...new O(this.code).map(([comp], i) => [comp, models[i]])};
            this.#transform.bey();
        } else {
            this.group = await this.#fetch('single', this.code);
            this.group.type || this.canvas.replaceWith(E('span', '未有模型', {title: this.canvas.title}));
        }
        this.#setup.single();
        const animate = () => {
            this.animation = requestAnimationFrame(animate);
            this.group && this.speed && (this.group.rotation.y += this.speed);
            this.controls?.update();
            this.#render();
        }
        animate();
        return this;
    }
    #render = () => this.renderer.init().then(r => r.render(this.scene, this.camera));
    destroy () {
        if (!this.canvas.dataset.engine) return;console.log('d',this.canvas.title||'multi')
        this.animation &&= cancelAnimationFrame(this.animation);
        this.controls?.dispose();
        this.scene.traverse(child => {
            child.geometry?.dispose();
            [child.material ?? []].flat().forEach(material => material.dispose());
        });
        this.renderer.dispose();
        this.renderer.forceContextLoss?.();
        Model.observer.unobserve(this.canvas);
        let old = this.canvas;
        this.#setup.canvas(Array.isArray(this.code) ? E('canvas') : undefined);
        old.replaceWith(this.canvas);
    }
    spin = (speed = 0.01) => this.speed = speed
    reorder (by, z = 1) { 
        this.sortedGroups = by == '$color' ?
            this.groups.toSorted((m, n) => m?.[by] == null ? 1 : n?.[by] == null ? -1 : (m[by][0] || 0) - (n[by][0] || 0)) :
            this.groups;
        this.sortedGroups.forEach((g, i) => g.position && (g.position.x = z * (2 * i - this.code.length + 1)));
        this.#render();
        this.canvas.parentElement?.replaceChildren(this.canvas, ...this.sortedGroups.map(g => g.$code));
    }
    #code = i => this.canvas.parentElement?.children[i+1]
    #fetch = (mode, code, i) => Model.fetch(`/x-model/${code.replace('-', '')}/${this.comp}.glb`)
        .then(model => {
            model.updateMatrixWorld(true);
            const group = new THREE.Group();
            group.add(model);
            this.#transform[mode](model, group, i);
            Object.assign(group.rotation, Model.rotate[this.comp ?? this.canvas.classList] ?? Model.rotate.blade);
            this.scene.add(group);
            group.$code = this.#code(i);
            Model.color(model).then(color => group.$color = color).catch(console.error);
            return group;
        }).catch(er => `${er}`.includes('404') ? Promise.resolve({$code: this.#code(i)}) : console.error(er))

    static fetch = url => new Promise((res, rej) => Model.loader.load(url, gltf => res(gltf.scene), null, er => rej(er)))
    static getSubPart (model, ...names) {
        for (let n of names) {
            let p = model.getObjectByName(n);
            if (p) return p;
        }
    }
    static color = model => new Promise(res => {
        let colors = new Set();
        model.traverse(child => 
            child.isMesh && (({h, s}) => colors.add(s > 0 && h))(child.material?.color?.getHSL({}) ?? {})
        );
        res([...colors].sort((a, b) => a === false ? 1 : b === false ? -1 : 0));
    });
    static scale = {chip: 0.8, bit: 1.2}
    static rotate = {
        blade: {x: Math.PI/2, y: Math.PI},
        ratchet: {x: -Math.PI/3},
        bit: {x: -Math.PI/6, z: -Math.PI/12}
    }
    static {
        const draco = new DRACOLoader();
        draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        Model.loader = new GLTFLoader();
        Model.loader.setDRACOLoader(draco);
    }
}
Model.cylinder = object => {
    let box = new THREE.Box3().setFromObject(object), sum = {x: 0, z: 0, count: 0}, v = new THREE.Vector3();
    object.traverse(child => {
        if (!child.isMesh || !child.geometry) return; 
        const position = child.geometry.attributes.position;
        sum.count += position.count;
        for (let i = 0; i < position.count; i++) {
            v.fromBufferAttribute(position, i);
            v.applyMatrix4(child.matrixWorld);
            sum.x += v.x; sum.z += v.z;
        }
    });
    let axis = {}, maxR2 = 0;
    ['x','z'].forEach(a => axis[a] = sum.count > 0 ? sum[a] / sum.count : (box.min[a] + box.max[a]) / 2);
    sum.count > 0 && object.traverse(child => {
        if (!child.isMesh || !child.geometry) return; 
        const position = child.geometry.attributes.position;
        for (let i = 0; i < position.count; i++) {
            v.fromBufferAttribute(position, i);
            v.applyMatrix4(child.matrixWorld);
            const dist = (v.x - axis.x) ** 2 + (v.z - axis.z) ** 2;
            if (dist > maxR2) maxR2 = dist;
        }
    });
    return {
        axis: new THREE.Vector2(axis.x, axis.z),
        radius: Math.sqrt(maxR2),
        topY: box.max.y,
        bottomY: box.min.y,
        height: box.max.y - box.min.y
    };
}
Model.color.distance = (...colors) => {
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
        return v;
    });
    return colors[0].distanceTo(colors[1]);
};window.Model=Model;
export default Model;