const Maps = {
    images: new O([
        ['BX-46', {detail: '${no}(_01|_02)'}],
        [['CX-11','UX-15'], {detail: '${no}(|_2|_3)'}],
        ['CX-04', {detail: '${no}_(d|p)'}],
        ['UX-07', {detail: '${no}_(r|g|b)', more: '${no}_(r|g|b)'}],
        ['BX-21', {detail: '${no}_(p|y|o)', more: '${no}_(p|y|o)'}],
        ['BX-20', {detail: '${no}(B|G|P)', more: '${no}_(b|g|p)'}],
        [['BX-17','UX-04'], {detail: '${no}(A|B)'}],
        ['BXG-50', {alias: 'BX00_bit_silver_white'}],
        ['BXG-25', {alias: 'BXA-02', detail: 'bxa_02_d(b2|d|s)'}],
        ['BXG-17', {alias: 'BXG_bit01'}],
        ['BXG-14', {alias: 'BXG-09'}],
        ['BXG-12', {alias: 'BXG-00'}],
        ['BXG-09', {alias: 'BXG-14'}],
        ['BXG-07', {_: true, detail: '${no}_(1|2)'}],
        ['BX-08', {detail: '${no}_(r|g|y)', more: '${no}_(r|g|y)'}],
    ]),
    lowercase: {
        BXG: n => new Set([1,4,7,14,31,32,11,18,19]).has(parseInt(n)),
        BX: n => parseInt(n) <= 39,
        UX: n => parseInt(n) <= 13
    }
}
export default Maps