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
    content: '請重新整理\\A如問題持續，需更新／換瀏覽器／iOS 系統\\A' attr(title);
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
    [Menu.nav, Menu.menu] = [Q('nav'), Q('nav menu')];
    if (!Menu.nav) return;
    Menu.config();
    Menu.current();
    addEventListener('hashchange', Menu.current);
}
Object.assign(Menu, {
    config () {
        let existing = Menu.menu.Q('a[href]', []);
        Menu.menu.append(E('li>a', {href: '/x/'}, ''));
        !Menu.menu.matches('.exclude') && Menu.menu.prepend(...Menu.links()
            .filter(a => a.pathname != location.pathname && !existing.map(a => a.href).includes(a.href)).map(a => E('li', a))
        );
        sessionStorage.menu = existing.map(a => a.pathname + a.search);
        Menu.nav.classList.toggle('bottom', !!Storage('pref')?.bottom);
        Menu.nav.classList.toggle('right', !!Storage('pref')?.right);
    },
    current () {
        Q('nav .current')?.classList.remove('current');
        Q('nav menu a')?.find(a => a.href == location.href)?.classList.add('current');
    },
    links: () => [
        E('a', {href: '/x/products/'}),
        E('a', {href: '/x/parts/?blade=CX'}),
        E('a', {href: '/x/prizes/'})
    ],
    lines: () => [...new O(LINES)]
        .filter(([_, {divided}]) => divided)
        .flatMap(([line]) => E('li>a.blade', {href: `?blade=${line}`}))
});

addEventListener('DOMContentLoaded', () => {
    Menu();
    document.head.append(E('style', new O(LINES).flatMap(([line, {color}]) => 
        `.${line}, a[href*=${line}] {--line: ${color}; --img-line: url(/x/img/lines.svg#${line});}`
    ).join('')));
    import('https://aeoq.github.io/pointer-interaction/script.js').then(({default: PI}) => PI.events({
        'nav menu': {
            drag: PI => {
                PI.drag.to.translate({x: false, y: Menu.nav.classList.contains('bottom') ? 
                    {min: PI.target.parentElement.offsetHeight - PI.target.offsetTop - PI.target.offsetHeight + 4} : 
                    {max: PI.target.offsetTop * -1 - 4} 
                });
                PI.drag.to.select({y: Menu.nav.classList.contains('bottom') ? innerHeight : 0})
                    .from([...PI.target.children].filter(child => !child.matches(':has(.current),:last-child')));
            },
            lift: PI => Q('.PI-selected') && (location.href = PI.target.Q('.PI-selected a').href)
        },
        '.stretch summary': {
            drag: PI => Math.abs(PI.$drag.dy) > 30 && PI.target.parentElement.classList[PI.$drag.dy > 0 ? 'add' : 'remove']('showing')
        }
    }));
});
window.onresize = () => Q('[headers=over]+td,[headers=assist]+td', td => td.classList.toggle('hide', outerWidth < 495));
