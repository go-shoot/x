import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import PI from 'https://aeoq.github.io/pointer-interaction.mjs';window.PI=PI;

class Model {
    static observer = new IntersectionObserver(entries => entries.forEach(en => 
        en.isIntersecting ? en.target.Model.render() : en.target.Model.destroy()
    ), {threshold: .1});
    constructor(code, comp) {
        this.url = `/x-model/${code.replace('-', '')}/${comp}.glb`;
        this.canvas = this.makeCanvas(code, comp);
    }
    render () {
        const {clientWidth: w, clientHeight: h} = this.canvas;
        const renderer = this.renderer = new THREE.WebGLRenderer({alpha: true, antialias: true, canvas: this.canvas});
        renderer.setSize(w, h);
        renderer.setPixelRatio(window.devicePixelRatio);

        const scene = this.scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight(0xffffff, 1.5));
        let light = new THREE.DirectionalLight(0xffffff, 2);
        light.position.set(5, -10, 7);
        scene.add(light);
        light = new THREE.DirectionalLight(0xffffff, 2);
        light.position.set(5, 10, 7);
        scene.add(light);
        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
        camera.position.set(0, 0, 5);
        const controls = this.controls = new OrbitControls(camera, this.canvas);
        controls.enableDamping = true; // Smooth rotation/panning

        Model.fetch(this.url).then(model => {
            model.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(model);
            const [size, center] = ['Size','Center'].map(f => box[`get${f}`](new THREE.Vector3()));
            const height = 2 * camera.position.z * Math.tan(camera.fov * Math.PI / 180 / 2);
            const width = height * camera.models.length;
            const scale = Math.min(width / size.x, height / size.y) * .75 * (Model.scale[this.canvas.classList] ?? 1);
            model.position.copy(center).negate();
            const group = this.group = new THREE.Group();
            group.add(model);
            group.scale.set(scale, scale, scale);
            Object.assign(group.rotation, Model.transform[this.canvas.classList] ?? {});
            scene.add(group);
            controls.target.set(0, 0, 0);
            controls.update();
            renderer.render(scene, camera);
        }).catch(er => `${er}`.includes('404') ? 
            this.canvas.replaceWith(E('span', '未有模型', {title: this.canvas.title})) : console.error(er)
        );
        const animate = () => {
            this.animation = requestAnimationFrame(animate);
            this.group && this.speed && (this.group.rotation.y += this.speed);
            controls.update();
            renderer.render(scene, camera);
        }
        animate();
    }
    destroy () {
        if (!this.canvas.dataset.engine) return;
        this.animation &&= cancelAnimationFrame(this.animation);
        this.controls?.dispose();
        this.renderer?.dispose();
        this.scene?.traverse(child => {
            if (!child.isMesh) return;
            child.geometry?.dispose();
            [child.material ?? []].flat().forEach(material => material.dispose());
        });
        Model.observer.unobserve(this.canvas);
        this.canvas.replaceWith(this.canvas = this.makeCanvas());
    }
    spin = (speed = 0.01) => this.speed = speed
    makeCanvas = (code = this.canvas.title, comp = this.canvas.classList) => {
        let canvas = Object.assign(E('canvas'), { Model: this, classList: comp, title: code });
        Model.observer.observe(canvas);
        return canvas;
    }
    static scale = {chip: .8}
    static scale_ = {bit: 1.2, ratchet: 1.1}
    static transform = {
        blade: {x: Math.PI/2, y: Math.PI},
        ratchet: {x: -Math.PI/3},
        chip: {z: Math.PI},
        bit: {x: -Math.PI/6, z: -Math.PI/12}
    }
    static fetch = url => new Promise((res, rej) => Model.loader.load(url, gltf => res(gltf.scene), null, er => rej(er)))
    static loader = new GLTFLoader()
}
Model.multiple = () => {
const canvas = Q('canvas');
const comp = location.search.substring(1);
const models = [
    `/x-model/BX01/${comp}.glb`,
    `/x-model/BX02/${comp}.glb`,
    `/x-model/BX03/${comp}.glb`
]
const scene = new THREE.Scene();
const dim = 5; 

const camera = new THREE.OrthographicCamera(-dim * models.length, dim * models.length, dim, -dim, 0.1, 1000);
camera.position.z = 100;
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
renderer.setSize(canvas.clientWidth * models.length, canvas.clientWidth);

const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const objects = [];
Promise.all(models.map((url, i, ar) => 
    Model.fetch(url).then(model => {
        model.updateMatrixWorld(true);
        const group = new THREE.Group();
        group.add(model);
        scene.add(group);

        let box = new THREE.Box3().setFromObject(model);
        model.position.sub(box.getCenter(new THREE.Vector3()));
        box.setFromObject(group);
        let size = box.getSize(new THREE.Vector3());
        group.scale.multiplyScalar(2 * dim * .8 / Math.max(size.x, size.y));
        Object.assign(group.rotation, Model.transform[comp] ?? {});

        let center = box.getCenter(new THREE.Vector3());        
        let squareCenter = dim * (2 * i - ar.length + 1);
        group.position.x = squareCenter - center.x;
        group.position.y = -center.y;
        group.position.z = 0;
        objects.push(group);
    })
));

let selected = null;
canvas.onpointermove = ev => {
    let {x, width: w} = canvas.getBoundingClientRect();
    selected = objects[Math.floor((ev.clientX - x) / w * models.length)];
}
canvas.onwheel = ev => 
    canvas.onpointermove(ev) ?? selected?.scale.setScalar(selected.scale.x * (ev.deltaY > 0 ? 0.95 : 1.05));
PI.events([[canvas, {
    drag: PI => {
        if (!selected) return;
        selected.rotation.y += PI.$drag.mx * 0.01;
        selected.rotation.x += PI.$drag.my * 0.01;
    }
}]]);

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();
}
export default Model;