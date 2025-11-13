const Storage = (key, obj) => !obj ? 
    JSON.parse(localStorage[key] ?? 'null') : 
    localStorage[key] = Array.isArray(obj) ? JSON.stringify(obj) : typeof obj == 'object' ? JSON.stringify({...Storage(key), ...obj}) : obj;

const LINES = {
    CX: {color: "#e4007f", title: "Custom Line", divided: true},
    UX: {color: "#ee7800", title: "Unique Line"},
    BX: {color: "#71bce9", title: "Basic Line"}
};

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
    if (!Q('nav')) return;
    Menu.config();
    Menu.script();
    Menu.current();
    addEventListener('hashchange', Menu.current);
}
Object.assign(Menu, {
    config () {
        Q('nav').classList.toggle('bottom', !!Storage('pref')?.bottom);
        Q('nav').classList.toggle('right', !!Storage('pref')?.right);
        Q('nav menu')?.append(E('li>a', {href: '/x/', dataset: {icon: ''}}));
    },
    current () {
        Q('nav .current')?.classList.remove('current');
        Q('nav menu a')?.find(a => a.href == location.href)?.classList.add('current');
    },
    drag: {
        'nav menu': {
            drag: PI => {
                PI.drag.to.translate({x: false, y: Q('nav.bottom') ? 
                    {min: PI.target.parentElement.offsetHeight - PI.target.offsetTop - PI.target.offsetHeight + 4} : 
                    {max: PI.target.offsetTop * -1 - 4} 
                });
                PI.drag.to.select(
                    {y: Q('nav.bottom') ? innerHeight : 0}, 
                    [...PI.target.children].filter(child => !child.matches(':has(.current),:last-child'))
                );
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
    (Q('style', [])[0] ?? Q('head').appendChild(E('style'))).innerText += new O(LINES).flatMap(([line, {color}]) => 
        `.${line}, a[href*=${line}] {--line: ${color}; --img-line: url(/x/img/lines.svg#${line});}`
    ).join('');
    window.addEventListener('pageswap', ev => {
        new URL(ev.activation.entry.url).pathname === '/x/' && 
        (console.log('swap')??ev.viewTransition.types.add("reverse"));
    });
    window.addEventListener("pagereveal", ev =>
        new URL(navigation.activation.entry.url).pathname === '/x/' && 
        (console.log('reveal')??ev.viewTransition.types.add("reverse"))
    );
});
