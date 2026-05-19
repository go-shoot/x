import DB from '../include/DB.js'

let PARTS;
const Garage = () => DB.get.parts()
    .then(parts => {
        PARTS = parts;
    })
Object.assign(Garage, {
    put (mode, code, content) {
        Garage[mode][code] = content;
        DB.put('user', {[mode]: Garage[mode]});
    },
    get: mode => DB.get('user', mode).then(beys => Garage[mode] = beys || {}),
    transform: beys => {
        Garage.parts = {CX: {}};
        new O(beys).each(([code, {blade, ratchet, bit, ...rest}]) => {
            blade && ((Garage.parts.blade ??= {})[blade] ??= []).push(code);
            ratchet && ((Garage.parts.ratchet ??= {})[ratchet] ??= []).push(code);
            bit && ((Garage.parts.bit ??= {})[bit] ??= []).push(code);
            new O(rest).each(([subcomp, abbr]) => ((Garage.parts.CX[subcomp] ??= {})[abbr] ??= []).push(code));
        });
    }
});
export default Garage;