const fs = require('fs');
const path = require('path');
const YAML = require('yamljs');

const findDirs = (rootdir, files = []) => {
    fs.readdirSync(rootdir).forEach(name => {
        const fn = path.join(rootdir, name);
        if (fs.statSync(fn).isDirectory()) {
            findDirs(fn, files);
        } else if (/\.ya?ml$/.test(fn) && files.indexOf(fn) < 0) {
            files.push(fn);
        }
    });
    return files;
};

const makePath = (basepath, p) => {
    const newp = path.join(basepath, p);
    if (/\/$/.test(newp)) {
        return newp.substring(0, newp.length-1);
    }
    return newp;
}

const load = (iterator) => {
    const merged = {};
    const apidir = path.join(__dirname, '..', 'apis');
    findDirs(apidir)
        .forEach(f => {
            const basepath = `/${path.relative(apidir, path.dirname(f))}/`;
            const o = YAML.parse(fs.readFileSync(f, 'utf8'));
            Object.keys(o).forEach(key => {
                const value = o[key];
                iterator(value, o, basepath, f, apidir, key);
                o[key] = value;
            });
            Object.assign(merged, o);
        });
    return merged;
};

const makeRoleName = (name) => 'LambdaFnRole' + name.replace(/[-_\/]/g, '');

module.exports.load = load;
module.exports.makePath = makePath;
module.exports.makeRoleName = makeRoleName;