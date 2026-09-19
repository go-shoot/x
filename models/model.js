import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

class Model {
    static observer = new IntersectionObserver(entries => entries.forEach(en => 
        en.isIntersecting ? en.target.Model.render() : en.target.Model.destroy()
    ));
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

        new GLTFLoader().load(this.url, ({scene: sc}) => {
            sc.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(sc);
            const [size, center] = ['Size','Center'].map(f => box[`get${f}`](new THREE.Vector3()));
            const height = 2 * camera.position.z * Math.tan(camera.fov * Math.PI / 180 / 2);
            const width = height * camera.aspect;
            const scale = Math.min(width / size.x, height / size.y) * .75 * (Model.scale[this.canvas.classList] ?? 1);
            sc.position.copy(center).negate();
            const group = new THREE.Group();
            group.add(sc);
            group.scale.set(scale, scale, scale);
            Object.assign(group.rotation, Model.transform[this.canvas.classList] ?? {});
            scene.add(group);
            controls.target.set(0, 0, 0);
            controls.update();
            renderer.render(scene, camera);
        }, undefined, er => `${er}`.includes('404') ? 
            this.canvas.replaceWith(E('span', '未有模型', {title: this.canvas.title})) : console.error(er)
        );
        const animate = () => {
            this.animation = requestAnimationFrame(animate);
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
    makeCanvas = (code = this.canvas.title, comp = this.canvas.classList) => {
        let canvas = Object.assign(E('canvas'), { Model: this, classList: comp, title: code });
        Model.observer.observe(canvas);
        return canvas;
    }
    static scale = {chip: .8}
    static transform = {
        blade: {x: Math.PI/2, y: Math.PI},
        ratchet: {x: -Math.PI/3},
        chip: {z: Math.PI},
        bit: {x: -Math.PI/6, z: -Math.PI/12}
    }
}
export default Model;