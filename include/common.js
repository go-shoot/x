const Storage = (key, obj) => !obj ? 
    JSON.parse(localStorage[key] ?? 'null') : 
    localStorage[key] = Array.isArray(obj) ? JSON.stringify(obj) : typeof obj == 'object' ? JSON.stringify({...Storage(key), ...obj}) : obj;

let LINES = {
    CX: {color: "#f42597", title: "Custom Line", divided: true},
    UX: {color: "#ee7800", title: "Unique Line"},
    BX: {color: "#71bce9", title: "Basic Line"}
};
typeof O != 'undefined' && (LINES = new O(LINES));

(() => {
    const unsupported = document.head.appendChild(document.createElement('style'));
    unsupported.textContent = `
html::before {
    content: '請重新整理\\A如問題持續，需更新／換瀏覽器／iOS 系統\\A\\A若你正在使用社交平台，請在右上方選項中，以 Safari / Chrome 等開啟' attr(title);
    font-size: 3em; white-space: pre-wrap;
    display: flex; justify-content: center; align-items: center;
    padding: .25em;
    position: fixed; inset: 0;
    z-index: 8;
    color: white; background: gray; 
    transition: color .5s 3s, background 3s .5s;
    @starting-style {color: black; background: black;}
}`;
    navigator.serviceWorker?.register('/x/worker.js', {scope: '/x/'})
    .then(() => document.querySelector('link[href$="common.css"]') ? 
        unsupported.remove() : Promise.reject()
    ).catch(() => (sessionStorage.reloaded ||= 0) < 2 && 
        ++sessionStorage.reloaded && setTimeout(() => location.reload(), 500)
    );
    document.title.includes('🙼') || (document.title += ' 🙼 爆旋陀螺X⬧戰鬥陀螺X⬧ベイブレードX⬧Beyblade X');
    document.title = document.title.replaceAll(/(?<! )⬧(?! )/g, ' $& ');
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
    selectable: () => Q('nav li:not(:has(.current)):not(:last-child)'),
    links: () => [
        E('a', {href: '/x/products/'}),
        E('a', {href: '/x/parts/' + (Storage('pref')?.parts ?? '?blade')}),
        E('a', {href: '/x/prizes/'})
    ],
    lines: () => LINES.filter(([_, {divided}]) => divided)
        .flatMap(([line]) => E('li>a.icon-blade', {href: `?blade=${line}`}))
});
const DropSearch = () => Q('body').append(...['tl','tr','bl','br'].map(p => E(`a#drop-${p}`, {target: '_blank'})));
Object.assign(DropSearch, {
    default: {
        tile: {
            tl: {site: 'Amazon US', locale: 'hasbro', append: 'beyblade x'},
            tr: {site: 'Mercari JP', locale: 'jap'},
            bl: {site: 'Google', locale: 'tw'},
            br: {site: 'Reddit', locale: 'eng'}
        },
        row: {
            tl: {site: 'Amazon US', locale: 'hasbro', append: 'beyblade x'},
            tr: {site: 'Mercari JP', locale: 'jap'},
            bl: {site: 'Google', locale: 'tw'},
            br: {site: 'Reddit', locale: 'eng'}
        }
    },
    zone: {
        href: {
            複製: '${}',
            'Amazon US': '//amazon.com/s?k=${}', 'Amazon JP': '//amazon.co.jp/s?k=${}',
            'Carousell HK': '//carousell.com.hk/search/${}', 'Mercari JP': '//jp.mercari.com/search?keyword=${}',
            Shopee: '//shopee.tw/search?keyword=${}', 淘寶: '//world.taobao.com/product/${}.htm',
            X: '//x.com/search?q=${}', Reddit: '//reddit.com/search/?q=${}',
            Google: '//google.com/search?q=${}', YouTube: '//youtube.com/results?search_query=${}',
            Threads: '//threads.net/search?q=${}', Facebook: '//facebook.com/search/top?q=${}'
        },
        text: {hasbro: 'Hasbro名', eng: 'TT英文名', jap: 'TT日文名', tw: '台灣名', hk: '香港名'},
        set (type) {
            let config = (Storage('drop-search') || DropSearch.default)[type];
            (DropSearch.zones ??= Q('a[id|=drop]')).forEach(a => {
                let {site, locale} = config[a.id.split('-')[1]];
                E(a).set([E('span', site), E('small', DropSearch.zone.text[locale])]);
            });
        },
    },
    open: (PI, query = []) => {
        let type = PI.target.tagName == 'X-PART' ? 'tile' : 'row';
        let config = (Storage('drop-search') || DropSearch.default)[type], pos = PI.onto.id.split('-')[1];
        let {site, locale, append} = config[pos];try {
        if (PI.target.tagName == 'X-PART') {
            query = [PI.target.Part.keyword(locale, true)];
            gtag('event', 'DROP-TILE', {SITE: site});
        } else {
            let code = [...PI.target.firstChild.childNodes].map(n => n?.textContent.trim());
            /^BX.-/.test(code[0]) && PI.target.Bey.line && (code[0] = `${PI.target.Bey.line}-00`);
            query = PI.target.Bey.parts.to.names(locale);
            query = [...locale == 'hasbro' ? [] : code, query[locale], query.rest];
            E(PI.target).get('--coat') && locale == 'jap' && query.push('メタルコート');
            gtag('event', 'DROP-ROW', {SITE: site});
        }
        query = [...query, append || ''].join(' ');
        site == '複製' ? 
            navigator.clipboard.writeText(query) :
            E(PI.onto).set({href: DropSearch.zone.href[site].replace('${}', query.trim())}).click();
        PI.onto.removeAttribute('href');}catch(er) {Q('main').prepend(er)}
    }
})
addEventListener('DOMContentLoaded', () => {
    Menu();
    DropSearch();
    Q('form button', button => button.type = 'button');
    new CSSStyleSheet().replace(LINES.flatMap(([line, {color}]) => 
        `.${line}, a[href*=${line}] {--line: ${color}; --img-line: url(/x/img/lines.svg#${line});}`
    ).join('')).then(css => document.adoptedStyleSheets.push(css));

    import('https://aeoq.github.io/pointer-interaction.mjs').then(({default: PI}) => PI.events({
        'nav menu': {
            drag: PI => {
                PI.drag.to.translate({x: false, y: Menu.nav.classList.contains('bottom') ? 
                    {min: PI.target.parentElement.offsetHeight - PI.target.offsetTop - PI.target.offsetHeight + 4} : 
                    {max: PI.target.offsetTop * -1 - 4} 
                });
                PI.drag.to.select({y: Menu.nav.classList.contains('bottom') ? innerHeight : 0}).from(Menu.selectable);
            },
            lift: PI => Q('.PI-selected') && (location.href = PI.target.Q('.PI-selected a').href)
        },
        '.stretch summary': {
            drag: PI => Math.abs(PI.$drag.dy) > 20 && PI.target.parentElement.classList[PI.$drag.dy > 0 ? 'add' : 'remove']('showing')
        }
    }));
});
window.onresize = () => Q('[headers=over]+td,[headers=assist]+td', td => td.classList.toggle('hide', outerWidth < 631));
