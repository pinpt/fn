const YAML = require('yamljs');
const util = require('./util');

const re = /^\${(.*)}$/;
const ucFirst = s => s.charAt(0).toUpperCase() + s.substring(1);

const parseResources = (resource) => {
    const toks = resource.split(':');
    let joins = [];
    let needsJoin, lastJoin;
    toks.forEach(tok => {
        if (re.test(tok)) {
            const m = re.exec(tok);
            if (!needsJoin) {
                joins = [joins.join(':')];
            }
            needsJoin = true;
            joins.push({Ref: `AWS::${ucFirst(m[1])}`});
            lastJoin = joins.length - 1;
        } else {
            joins.push(tok);
        }
    });
    if (needsJoin && lastJoin < joins.length) {
        const s = [];
        for (let i = lastJoin + 1; i < joins.length; i++) {
            s.push(joins[i]);
        }
        joins = joins.slice(0, lastJoin + 1).concat(s.join(':'));
    }
    if (needsJoin) {
        return {
            'Fn::Join': [
                ':',
                joins,
            ]
        };
    }
    // if no joins, just add as single string
    return joins.join(':');
};

module.exports = (serverless) => {
    const resources = {
        Resources: {}
    };
    const provider = serverless.service.provider;
    const stage = provider.stage;
    const project = serverless.service.service;
    util.load((value, o, basepath, f, apidir, name) => {
        if (value.iam) {
            const roleName = util.makeRoleName(basepath + name);
            let statements = value.iam;
            if (typeof(statements) === 'object' && Array.isArray(statements)) {
                // replace the short iam with the cloudformation valid YAML
                statements = statements.map(entry => {
                    return {
                        Effect: entry.allow ? 'Allow' : 'Deny',
                        Action: [entry.allow || entry.deny],
                        Resource: entry.resource.map(parseResources)
                    };
                });
                delete value.iam; // delete the short-hand so it doesn't try to get evaluated
            }
            // when you create a custom IAM policy for a function, you need to include the minimum
            // policies for Lambda itself like creating logs, etc. so we go ahead and do that
            statements = statements.concat([
                {
                    Effect: 'Allow',
                    Action: [ 'logs:CreateLogStream' ],
                    Resource: [
                        {
                            'Fn::Join': [
                                ':',
                                [
                                    'arn:aws:logs',
                                    { Ref: 'AWS::Region' },
                                    { Ref: 'AWS::AccountId' },
                                    `log-group:/aws/lambda/${project}-${stage}-${name}:*`
                                ]
                            ]
                        }
                    ]
                },
                {
                    Effect: 'Allow',
                    Action: ['logs:PutLogEvents'],
                    Resource: [
                        {
                            'Fn::Join': [
                                ':',
                                [
                                    'arn:aws:logs',
                                    { Ref: 'AWS::Region' },
                                    { Ref: 'AWS::AccountId' },
                                    `log-group:/aws/lambda/${project}-${stage}-${name}:*:*`
                                ]
                            ]
                        }
                    ]
                },
                {
                    Effect: 'Allow',
                    Action: [
                        'ec2:CreateNetworkInterface',
                        'ec2:DescribeNetworkInterfaces',
                        'ec2:DetachNetworkInterface',
                        'ec2:DeleteNetworkInterface',
                    ],
                    Resource: '*' //TODO: restrict based on project
                }

            ]);
            resources.Resources[roleName] = {
                Type: 'AWS::IAM::Role',
                Properties: {
                    Path: '/lambda/fn' + basepath + name + '/',
                    RoleName: roleName,
                    AssumeRolePolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [
                            {
                                Effect: 'Allow',
                                Principal: {
                                    Service: [
                                        'lambda.amazonaws.com'
                                    ]
                                },
                                Action: 'sts:AssumeRole'
                            }
                        ]
                    },
                    Policies: [
                        {
                            PolicyName: roleName + 'Policy',
                            PolicyDocument: {
                                Version: '2012-10-17',
                                Statement: statements
                            }
                        }
                    ]
                }
            }
        }
    });
    return resources;
}
