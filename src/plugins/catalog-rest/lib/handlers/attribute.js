'use strict';

import AttributeValidation from '../validate/attribute';
import Joi from '@hapi/joi';
import Boom from '@hapi/boom';
import GeneralHelper from '../helpers/general';
import GeneralValidation from '../validate/general';
import EsWrapper from 'es-client-wrapper/lib/wrapper';
import _ from 'lodash';

module.exports = {
    create: {
        handler: async (request, h) => {

            const esClient = request.server.plugins['es-client-wrapper'].es;
            const config = request.server.catalogGlobalSettings;
            const attribute = request.payload;
            let response = {};

            try {
                response = await esClient.index({
                    index: config.attributes.index,
                    id: attribute.id,
                    body: attribute
                });

                return { message: 'created', response: response };
            }
            catch (err) {

                return Boom.badRequest(err);
            }
        },
        validate: {
            payload: Joi.object().label('Attribute').keys(AttributeValidation.getValidationSchema())
        },
        description: 'Save Attribute - create or replace document',
        tags: ['api'],
        auth: 'im-auth',
        plugins: {
            'hapi-internal-bridge': {
                auth: {
                    role: 'ROLE_CATALOG',
                    permission: 'ADD'
                }
            },
            'catalog-rest': true
        }
    },
    update: {
        handler: async (request, h) => {

            const esClient = request.server.plugins['es-client-wrapper'].es;
            const attribute = request.payload;

            const attributeId = request.params.id;
            try {
                const response = await esClient.update({
                    index: request.index,
                    id: attributeId,
                    body: {
                        doc: attribute
                    }
                });

                return {message: 'updated', response: response};
            }
            catch (err) {

                return Boom.badRequest(err);
            }
        },
        validate: {
            payload: AttributeValidation.getValidationSchema(),
            params: {
                id: Joi.number().required()
            },
            options: {
                allowUnknown: true
            }
        },
        description: 'Update attribute partially (patch)',
        tags: ['api'],
        auth: 'im-auth',
        plugins: {
            'hapi-internal-bridge': {
                auth: {
                    role: 'ROLE_CATALOG',
                    permission: 'EDIT'
                }
            },
            'catalog-rest': true
        }
    },
    get: {
        handler: async (request, h) => {

            const esClient = request.server.plugins['es-client-wrapper'].es;
            const attributeId = request.params.id;

            try {
                return await esClient.get({
                    index: request.index,
                    id: attributeId
                });
            }
            catch (err) {

                return Boom.badRequest(err);
            }
        },
        validate: {
            params: {
                id: Joi.number().required()
            },
            options: {
                allowUnknown: true
            }
        },
        description: 'Get attribute raw document by id',
        tags: ['api'],
        auth: 'im-auth',
        plugins: {
            'hapi-internal-bridge': {
                auth: {
                    role: 'ROLE_CATALOG',
                    permission: 'GET'
                }
            },
            'catalog-rest': true
        }
    },
    getByFilters: {
        handler: async (request, h) => {

            const config = request.server.catalogGlobalSettings;
            const esClient = request.server.plugins['es-client-wrapper'].es;
            const esWrapper = new EsWrapper(esClient);
            esWrapper.setIndex(request.index);
            let conditions = { query: { match_all: {} }, size: 9999 };

            try {
                //process filters
                let filters = GeneralHelper.parseFilters(request.query, 'filter', false);
                if (!_.isEmpty(filters)) {

                    const validation = GeneralValidation.validateFilter(
                        filters,
                        Object.keys(AttributeValidation.getValidationSchema())
                    );
                    if (validation === false) {
                        return Boom.badRequest();
                    }

                    conditions = {
                        query: {
                            bool: {
                                must:[]
                            }
                        },
                        size: 9999
                    };

                    Object.keys(filters).forEach(filterName => {
                        const filter = {};
                        let filterValue = filters[filterName];

                        if (filterValue.length > 1) {
                            filter[filterName] = filterValue;
                            conditions.query.bool.must.push({terms: filter});
                        }
                        else if (filterValue.length === 1) {
                            filter[filterName] = filterValue[0];
                            conditions.query.bool.must.push({term: filter});
                        }
                    });
                }

                // retrieve only desired source fields
                if (!_.isUndefined(request.query.fields) && !_.isEmpty(request.query.fields)) {
                    conditions._source = request.query.fields;
                }

                const esResponse = await esWrapper.get(conditions);

                if (!_.get(esResponse, 'body.hits.hits', false)) {

                    return Boom.notFound();
                }

                return esResponse.body.hits.hits.map((obj) => {

                    return obj._source;
                });
            }
            catch (err) {

                return Boom.badRequest(err);
            }
        },
        description: 'Get attributes by filters',
        tags: ['api'],
        auth: 'im-auth',
        plugins: {
            'hapi-internal-bridge': {
                auth: {
                    role: 'ROLE_CATALOG',
                    permission: 'GET'
                }
            },
            'catalog-rest': true
        }
    },
    delete: {
        handler: async (request, h) => {

            const esClient = request.server.plugins['es-client-wrapper'].es;
            const attributeId = request.params.id;
            try {
                const response = await esClient.delete({
                    index: request.index,
                    id: attributeId
                });

                return {message: 'deleted', response: response};
            }
            catch (err) {

                return Boom.badRequest(err);
            }
        },
        validate: {
            params: {
                id: Joi.number().required()
            },
            options: {
                allowUnknown: true
            }
        },
        description: 'Delete attribute',
        tags: ['api'],
        auth: 'im-auth',
        plugins: {
            'hapi-internal-bridge': {
                auth: {
                    role: 'ROLE_CATALOG',
                    permission: 'DELETE'
                }
            },
            'catalog-rest': true
        }
    },
    bulk: {
        handler: async (request, h) => {

            const esClient = request.server.plugins['es-client-wrapper'].es;
            const operation = request.method;
            const data = request.payload.data;

            try {
                const params = {body: []};
                const notices = [];
                if (operation === 'delete') { // remove documents
                    if (!_.isArray(data) || data.length === 0) {
                        throw 'Ids are missing';
                    }
                    data.forEach((item) => {

                        params.body.push({ delete: { _index: request.index, _id: item.id } });
                    });
                }
                else if (operation === 'put') { // update
                    if (!_.isArray(data)) {
                        throw 'Data must be an array containing updates';
                    }
                    data.forEach((item) => {

                        if (_.isUndefined(item.id)) {
                            notices.push('ID is missing on object: ' + JSON.stringify(item));
                            return;
                        }
                        params.body.push({ update: { _index: request.index, _id: item.id } });
                        params.body.push({ doc: item });
                    });
                }
                else if (operation === 'post') { // create
                    if (!_.isArray(data)) {
                        throw 'Data must be an array containing updates';
                    }
                    data.forEach((item) => {

                        if (_.isUndefined(item.id)) {
                            notices.push('ID is missing on object: ' + JSON.stringify(item));
                            return;
                        }
                        params.body.push({ index: { _index: request.index, _id: item.id } });
                        params.body.push(item);
                    });
                }
                else {
                    throw 'Unknown operation';
                }

                if (params.body.length === 0) {
                    throw 'Missing any bulk updates';
                }

                const response = await esClient.bulk(params);
                delete response.items; // decrease payload

                return {message: operation, response: response, notices: notices, operation: operation};
            }
            catch (err) {

                return Boom.badRequest(err);
            }
        },
        validate: {
            payload: {
                data: Joi.array().required()
            },
            options: {
                allowUnknown: true
            }
        },
        description: 'Batch attribute operation - update partially / index / delete',
        tags: ['api'],
        auth: 'im-auth',
        plugins: {
            'hapi-internal-bridge': {
                auth: {
                    role: 'ROLE_CATALOG',
                    permission: 'ADD'
                }
            },
            'catalog-rest': true
        }
    }
};
