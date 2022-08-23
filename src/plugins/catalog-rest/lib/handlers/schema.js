'use strict';

import Validation from '../validate/schema';
import Boom from '@hapi/boom';
import _ from 'lodash';

module.exports = {
    createIndex: {
        handler: async (request, h) => {
            const esClient = request.server.plugins['es-client-wrapper'].es;
            try {
                const indexExists = await esClient.indices.exists({index: request.payload.index});
                let response = {
                    create: false,
                    mapping: false
                };

                if (_.get(indexExists, 'statusCode', 404) === 404) {
                    const createObject = {
                        index: request.payload.index,
                        body: {}
                    };
                    if (request.payload.settings) {
                        createObject['body']['settings'] = request.payload.settings;
                    }
                    response['create'] = await esClient.indices.create(createObject);
                }

                if (request.payload.mapping) {
                    response['mapping'] = await esClient.indices.putMapping({
                        index: request.payload.index,
                        body: {
                            properties: request.payload.mapping
                        }
                    });
                }

                return response;
            }
            catch (err) {
                return Boom.badRequest(err);
            }
        },
        description: 'POST index',
        notes: 'Create a new index by attaching it\'s schema',
        tags: ['api'],
        validate: {
            payload: Validation.createIndexPayload
        },
        response: {
            schema: Validation.createIndexResponse
        },
        auth: 'im-auth',
        plugins: {
            'hapi-internal-bridge': {
                auth: {
                    role: 'ROLE_CATALOG_MANAGER',
                    permission: 'ADD'
                }
            }
        }
    },
    listIndices: {
        handler: async (request, h) => {
            const esClient = request.server.plugins['es-client-wrapper'].es;

            try {
                return await esClient.cat.indices({format: 'json'});
            }
            catch (err) {
                return Boom.badRequest(err);
            }
        },
        description: 'GET indices',
        notes: 'Returns a list of all indices',
        tags: ['api'],
        auth: 'im-auth',
        plugins: {
            'hapi-internal-bridge': {
                auth: {
                    role: 'ROLE_CATALOG_MANAGER',
                    permission: 'GET'
                }
            }
        }
    },
    createAlias: {
        handler: async (request, h) => {
            const esClient = request.server.plugins['es-client-wrapper'].es;
            const response = {created: false};
            try {
                if (!request.payload.clean_alias) {
                    await esClient.indices.putAlias({
                        index: request.payload.index,
                        name: request.payload.alias
                    });
                }
                else {
                    const body = { actions: [] };

                    const aliases = await esClient.cat.aliases({format: 'json'});
                    for (let i = 0; i < aliases.body.length; i++) {
                        const alias = aliases.body[i];
                        if (
                            alias.alias === request.payload.alias &&
                            alias.index !== request.payload.index
                        ) {
                            body.actions.push({
                                remove: {
                                    index: alias.index,
                                    alias: alias.alias
                                }
                            });
                        }
                    }

                    body.actions.push({
                        add: {
                            index: request.payload.index,
                            alias: request.payload.alias
                        }
                    });

                    await esClient.indices.updateAliases({ body: body });
                }

                response.created = true;
            }
            catch (err) {
                console.log(err);
            }
            return response;
        },
        description: 'POST alias',
        notes: 'Create a new alias for an index - it will replace the old alias target if any',
        tags: ['api'],
        validate: {
            payload: Validation.createAliasPayload
        },
        response: {
            schema: Validation.createAliasResponse
        },
        auth: 'im-auth',
        plugins: {
            'hapi-internal-bridge': {
                auth: {
                    role: 'ROLE_CATALOG_MANAGER',
                    permission: 'ADD'
                }
            }
        }
    },
    listAliases: {
        handler: async (request, h) => {
            const esClient = request.server.plugins['es-client-wrapper'].es;

            try {
                return await esClient.cat.aliases({format: 'json'});
            }
            catch (err) {
                return Boom.badRequest(err);
            }
        },
        description: 'GET indices',
        notes: 'Returns a list of all indices',
        tags: ['api'],
        auth: 'im-auth',
        plugins: {
            'hapi-internal-bridge': {
                auth: {
                    role: 'ROLE_CATALOG_MANAGER',
                    permission: 'GET'
                }
            }
        }
    }
};
