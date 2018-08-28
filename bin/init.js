const fs = require('fs'),
    rimraf = require('rimraf'),
    path = require('path'),
    execSync = require('child_process').execSync;

const libs = [
    'serverless',
    'serverless-webpack',
    'serverless-content-encoding',
    'serverless-offline',
    'fork-ts-checker-webpack-plugin',
    'ts-loader',
    'cache-loader',
    'thread-loader',
    'webpack',
    'webpack-node-externals',
    'tslint',
    'typescript',
    'yamljs',
    'html-minifier',
    'path-to-regexp',
    'api2html'
];

const gitignore = `
node_modules
apis/apidoc/index.ts
.apidoc
.serverless
.webpack
`;

function init(name, {dir, templates, force, description, certs}, {info, error, copydir, tmpldir}, pkg) {
    if (fs.existsSync(dir)) {
        if (force) {
            rimraf.sync(dir);
        } else {
            error('directory %s already exists. use --force to remove', dir);
        }
    }
    fs.mkdirSync(dir);

    if (certs) {
        info('+ copying tls certs ...');
        copydir(certs, path.join(dir, 'dev-certs'));
    }

    fs.writeFileSync(path.join(dir, '.gitignore'), gitignore);

    info('+ copying templates ...');
    const config = {
        name,
        description,
        version: pkg.version,
        aws: {
            profile: process.env.AWS_PROFILE || 'pinpt',
        },
        certs
    };
    tmpldir(templates, config, dir);

    const cmd = ['npm', 'install', '--loglevel=error'].join(' ');
    info('+ installing npm modules ...');
    execSync(cmd, {
        cwd: dir,
    });

    const cmd2 = ['npm', 'install', '-D', '--loglevel=error'].concat(libs).join(' ');
    execSync(cmd2, {
        cwd: dir,
    });

}

module.exports = init;
