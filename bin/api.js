const fs = require('fs'),
    path = require('path'),
    rimraf = require('rimraf');

function init(name, {dir, templates, force, description}, {info, error, tmpldir}) {
    if (fs.existsSync(dir)) {
        if (force) {
            rimraf.sync(dir);
        } else {
            error('directory %s already exists. use --force to remove', dir);
        }
    }
    fs.mkdirSync(dir);

    info('+ copying templates ...');
    const config = {
        name,
        description
    };
    tmpldir(templates, config, dir, /(api|serverless)/);
    const srcdir = path.join(dir, '..', '..', 'src', name);
    tmpldir(templates, config, srcdir, /src\.ts$/);
    fs.renameSync(path.join(dir, 'api.ts'), path.join(dir, `${name}.ts`));
    fs.renameSync(path.join(srcdir, 'src.ts'), path.join(srcdir, 'index.ts'));
}

module.exports = init;