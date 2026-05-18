import DB from '../include/DB.js'

const Garage = {
    put (mode, index, content) {
        Garage[mode][index] = content;
        DB.put('user', {[mode]: Garage[mode]});
    },
    get: mode => DB.get('user', mode).then(beys => Garage[mode] = beys || {})
}

export default Garage;