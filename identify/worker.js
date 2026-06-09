console.log(1);
importScripts('https://unpkg.com/imagehash-web/dist/imagehash-web.min.js');
let ASSETS;
let E = {};
E.canvas = url => fetch(url).then(resp => resp.blob()).then(blob => createImageBitmap(blob))
.then(bitmap => {
    const cvs = new OffscreenCanvas(bitmap.width, bitmap.height);
    cvs.getContext('2d').drawImage(bitmap, 0, 0);
    return cvs;
});
self.onmessage = ({data}) => {
    if (data.assets) {console.log(0);
        Promise.all(
            data.assets.map(url => E.canvas(url).then(cvs => cvs && phash(cvs, 16)).then(hash => hash && ({hash})))
        ).then(hashes => console.log(ASSETS = hashes));
    }
}
