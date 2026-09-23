import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
        single: (w, h) => {
            const camera = this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
            camera.position.set(0, 0, 5);
            const controls = this.controls = new OrbitControls(camera, this.canvas);
            controls.enableDamping = true; // Smooth rotation/panning
        },
        multiple: (z = 1) => {
            const camera = this.camera = new THREE.OrthographicCamera(-z * this.code.length, z * this.code.length, z, -z, 0.1, 1000);
            camera.position.z = 100;
        }
    }
    #transform = {
        single: (model, group) => {
            const {center} = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
            model.position.copy(center).negate();
            group.scale.setScalar(0.07 * (Model.scale[this.canvas.classList] ?? 1));
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
        this.scene.add(new THREE.AmbientLight(0xffffff, 2));
        let light = new THREE.DirectionalLight(0xffffff, 7);
        light.position.set(0,0,1);
        this.scene.add(light);
        const {clientHeight: H} = this.canvas.parentElement ?? this.canvas;

        if (Array.isArray(this.code)) {
            E(this.canvas.parentElement).set({'--count': this.code.length});
            this.renderer.setSize(H * this.code.length, H);
            this.#setup.multiple();
            this.groups = (await Promise.allSettled(this.code.map((c, i) => this.#fetch('multiple', c, i)))).map(p => p.value);
            this.#events.multiple();
            this.#render();
        } else {
            this.renderer.setSize(H, H);
            this.#setup.single(H, H);
            this.group = await this.#fetch('single', this.code);
            this.group.type || this.canvas.replaceWith(E('span', '未有模型', {title: this.canvas.title}));
            const animate = () => {
                this.animation = requestAnimationFrame(animate);
                this.group && this.speed && (this.group.rotation.y += this.speed);
                this.controls?.update();
                this.#render();
            }
            animate();
        }
        return this;
    }
    #render = () => this.renderer.init().then(r => r.render(this.scene, this.camera));
    destroy () {
        if (!this.canvas.dataset.engine) return;console.log('d',this.canvas.title||'multi')
        this.animation &&= cancelAnimationFrame(this.animation);
        this.controls?.dispose();
        this.scene.traverse(child => {
            child.geometry?.dispose();
            [child.material ?? []].flat().forEach(material => {
                Object.values(material).forEach(v => typeof v?.dispose == 'function' && v.dispose());
                material.dispose();
            });
        });
        this.renderer.dispose();
        this.renderer.forceContextLoss?.();
        Model.observer.unobserve(this.canvas);
        let old = this.canvas;
        this.#setup.canvas(E('canvas'));
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
    static fetch = url => new Promise((res, rej) => new GLTFLoader().load(url, gltf => res(gltf.scene), null, er => rej(er)))
    static color = model => new Promise(res => {
        let colors = new Set();
        model.traverse(child => 
            child.isMesh && (({h, s}) => colors.add(s > 0 && h))(child.material?.color?.getHSL({}) ?? {})
        );
        res([...colors].sort((a, b) => a === false ? 1 : b === false ? -1 : 0));
    });
    static scale = {chip: 1.5, bit: 1.6}
    static rotate = {
        blade: {x: Math.PI/2, y: Math.PI},
        ratchet: {x: -Math.PI/3},
        bit: {x: -Math.PI/6, z: -Math.PI/12}
    }
}
export default Model;