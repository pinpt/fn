const YAML = require('yamljs');
const path = require('path');
const fs = require('fs');
const childprocess = require('child_process');
const routes = require('path-to-regexp');
const minify = require('html-minifier').minify;
const util = require('./util');

const normalize = s => s.replace(/[_-\s/]+/g, '');
const proper = s => normalize(s).charAt(0).toUpperCase() + normalize(s).substring(1);

const makeOperationId = (method, basepath, name) => {
    const bp = proper(basepath);
    const n = proper(name);
    const prefix = bp === n ? n : bp + n;
    switch (method.toLowerCase()) {
        case 'get': {
            return 'find' + prefix;
        }
        case 'put': {
            return 'update' + prefix;
        }
        case 'delete': {
            return 'delete' + prefix;
        }
        case 'post': {
            return 'create' + prefix;
        }
        default: {
            return prefix;
        }
    }
};

const allowCommands = ['offline', 'package', 'deploy'];

module.exports = (sls) => {
    const found = sls.processedInput.commands.find(cmd => allowCommands.indexOf(cmd) >= 0);
    if (!found) {
        return {};
    }
    // build the openapi output
    const pkg = require('../package.json');
    const apidoc = {
        openapi: '3.0.0',
        info: {
            version: pkg.version,
            title: pkg.apidoc ? pkg.apidoc.name : pkg.name,
            description: pkg.apidoc ? pkg.apidoc.description : pkg.description,
            termsOfService: pkg.apidoc && pkg.apidoc.tos,
            contact: {
                name: pkg.apidoc && pkg.apidoc.contact ? pkg.apidoc.contact.name : 'Pinpoint',
                email: pkg.apidoc && pkg.apidoc.contact ? pkg.apidoc.contact.email : 'hello@pinpt.com',
                url: pkg.apidoc && pkg.apidoc.contact ? pkg.apidoc.contact.url : 'https://pinpt.com',
            },
            license: {
            }
        },
        servers: [
            {
                url: '',
            }
        ],
        paths: {
        },
        components: {
            schemas: {
                Error: {
                    required: [
                        'success',
                        'message'
                    ],
                    properties: {
                        success: {
                            type: 'boolean'
                        },
                        message: {
                            type: 'string'
                        }
                    }
                }
            },
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                },
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-api-key'
                }
            }
        }
    }

    const results = util.load((value, o, basepath, f, apidir, name) => {
        value.handler = value.handler || (name + '.handler');
        value.handler = 'apis' + basepath + value.handler;
        // see if we have a short hand syntax and if so, make it look like the long hand
        if (!value.events && value.apidoc) {
            const keys = ['authorizer', 'apidoc', 'cors', 'path', 'private', 'method'];
            const http = {};
            keys.forEach(k => {
                if (value[k] !== undefined) {
                    http[k] = value[k];
                    delete value[k];
                }
            });
            value.events = [{http}];
        }
        if (value.events) {
            const adds = [];
            value.events.forEach(event => {
                if (event.http) {
                    event.http.path = event.http.path || '/';
                    event.http.method = event.http.method || 'get';
                    event.http.path = util.makePath(basepath, event.http.path);
                    const paths = routes.parse(event.http.path);
                    const parameters = [];
                    const responses = {};
                    let prefix = [];
                    const doc = event.http.apidoc;
                    if (!doc) {
                        throw new Error(`api named '${name}' in ${f} doesn't have an apidoc`);
                    }
                    // add support for using express style routes to generate multiple http endpoints
                    for (let c = 0; c < paths.length; c++) {
                        let segment = paths[c];
                        if (typeof(segment) === 'string') {
                            if (c) {
                                segment = segment.substring(1); // trim off slash in subsequent segments
                            }
                            prefix.push(segment);
                        } else {
                            if (!doc.parameters || !doc.parameters[segment.name]) {
                                throw new Error(`api named '${name}' in ${f} doesn't have value for apidoc.parameters.${segment.name}`);
                            }
                            parameters.push({
                                name: segment.name,
                                required: !segment.optional,
                                description: doc.parameters[segment.name]
                            });
                            if (!segment.optional) {
                                prefix.push(`{${segment.name}}`);
                            } else {
                                adds.push(Object.assign({}, event.http, {
                                    path: `${prefix.join('/')}/{${segment.name}}`
                                }));
                            }
                        }
                    }
                    responses['200'] = {
                        description: 'Success'
                    };
                    responses['500'] = {
                        description: 'An unexpected error',
                        content: {
                            'application/json': {
                                schema: {
                                    '$ref': '#/components/schemas/Error'
                                }
                            }
                        }
                    };
                    const security = [];
                    if (event.http.authorizer || event.http.private) {
                        responses['401'] = {
                            description: 'Unauthorized access',
                            content: {
                                'application/json': {
                                    schema: {
                                        '$ref': '#/components/schemas/Error'
                                    }
                                }
                            }
                        }
                        if (event.http.private) {
                            security.push({ApiKeyAuth:[]});
                        } else {
                            security.push({BearerAuth:[]});
                        }
                    }
                    if (doc.response) {
                        Object.keys(doc.response).forEach(code => {
                            const entry = doc.response[code];
                            responses[code] = {
                                description: entry.description,
                                content: {
                                    [entry.mimetype || 'application/json']: {
                                        schema: {
                                            type: entry.type,
                                            properties: entry.properties
                                        }
                                    }
                                }
                            };
                        });
                    }
                    event.http.path = prefix.join('/');
                    if (!doc.hidden) {
                        const resource = {};
                        apidoc.paths[event.http.path] = resource;
                        resource[event.http.method.toLowerCase()] = {
                            operationId: doc.name || makeOperationId(event.http.method, basepath, name),
                            description: doc.description,
                            parameters,
                            responses,
                            security
                        };
                    }
                }
            });
            if (adds.length) {
                adds.forEach(e => value.events.push({
                    http: e
                }));
            }
        }
        if (value.iam) {
            value.role = util.makeRoleName(basepath + name);
            delete value.iam;
        }
    });

    // check to see if we should be generating the apidoc
    const apidir = path.join(__dirname, '..', 'apis', 'apidoc');
    if (fs.existsSync(apidir)) {
        const apits = path.join(apidir, 'index.ts');
        const tempdir = path.join(__dirname, '..', '.apidoc');
        if (!fs.existsSync(tempdir)) {
            fs.mkdirSync(tempdir);
        }

        const htmlfn = path.join(tempdir, 'index.html');
        const yamlfn = path.join(tempdir, 'openapi.yml');

        fs.writeFileSync(yamlfn, YAML.stringify(apidoc, 10, 2));
        // console.log(YAML.stringify(apidoc, 10, 2));

        const api2html = path.join(__dirname, '..', 'node_modules', '.bin', 'api2html');
        childprocess.execFileSync(api2html, [
            '-o', htmlfn,
            '-l', 'shell,http',
            '-m',
            yamlfn
        ], {
            cwd: tempdir,
            windowsHide: true,
        });

        const htmlbuf = minify(fs.readFileSync(htmlfn).toString(), {
            removeAttributeQuotes: true,
            removeComments: true,
            collapseWhitespace: true,
            minifyCSS: true,
            minifyJS: true
        });

        fs.writeFileSync(apits, "export const html = Buffer.from('" + Buffer.from(htmlbuf).toString('base64') + "', 'base64').toString('utf-8');");    
    }

    return results;
}