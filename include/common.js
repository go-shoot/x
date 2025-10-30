const Storage = (key, obj) => !obj ? 
    JSON.parse(localStorage[key] ?? 'null') : 
    localStorage[key] = typeof obj == 'object' ? JSON.stringify({...Storage(key), ...obj}) : obj;

Storage('line', {
    CX: {color: "#71bce9", title: "Custom Line", divided: true},
    UX: {color: "#ee7800", title: "Unique Line"},
    BX: {color: "#e4007f", title: "Basic Line"}
});
   
(() => {
    const unsupported = document.head.appendChild(document.createElement('style'));
    unsupported.textContent = `
html::before {
    content: '請重新整理\\A如問題持續，需更新／換瀏覽器';
    color: white; transition: color .5s 1.5s;
    font-size: 3em; white-space: pre-wrap;
    display: flex; justify-content: center; align-items: center;
    background: black; 
    position: fixed; inset: 0;
    z-index: 9;
    @starting-style {color: black;}
}`;
    navigator.serviceWorker?.register('/x/worker.js', {scope: '/x/'})
    .then(() => {
        if (!document.querySelector('link[href$="common.css"]')) return Promise.reject();
        document.title += ' ■ 戰鬥陀螺 X⬧爆旋陀螺 X⬧ベイブレード X⬧Beyblade X';
        unsupported.remove();
    }).catch(() => (sessionStorage.reloaded ||= 0) < 2 && ++sessionStorage.reloaded && setTimeout(() => location.reload(), 500));
})();

const Menu = () => {
    let menu = Q('nav menu');
    if (!menu) return;
    menu.append(E('li>a', {href: '/x/', dataset: {icon: ''}}));
    Menu.script();
    Menu.current();
    addEventListener('hashchange', Menu.current);
}
Object.assign(Menu, {
    current () {
        Q('menu .current')?.classList.remove('current');
        Q('menu li a')?.find(a => new URL(a.href, document.baseURI).href == location.href)?.classList.add('current');
    },
    drag: {
        'nav menu': {
            drag: PI => {
                PI.drag.to.translate({ x: false, y: { max: Q('nav menu').offsetTop * -1 - 4 } });
                PI.drag.to.select({ y: 0 }, [...PI.target.children].filter(child => !child.matches(':has(.current),:last-child')));
            },
            lift: PI => Q('.PI-selected') && (location.href = PI.target.Q('.PI-selected a').href)
        }
    },
    script: () => document.head.append(E('script', {type: 'module'}, `
import PointerInteraction from 'https://aeoq.github.io/pointer-interaction/script.js';
PointerInteraction.events(Menu.drag)` 
    ))
});

addEventListener('DOMContentLoaded', () => {
    Menu();
    Q('[popover=auto]')?.addEventListener('click', ev => ev.currentTarget.hidePopover());
    (Q('style') ?? Q('head').appendChild(E('style'))).innerText += new O(Storage('line')).flatMap(([line, {color}]) => 
        `.${line}, a[href*=${line}] {--line: ${color}; --img-line: url(/x/img/lines.svg#${line});}`
    ).join('');
});
