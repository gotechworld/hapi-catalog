"use strict";

import ProductValidation from "../validate/product";
import GeneralValidation from "../validate/general";
import EsWrapper from "es-client-wrapper/lib/wrapper";
import Boom from "@hapi/boom";
import Joi from "@hapi/joi";
import GeneralHelper from "../helpers/general";
import _ from "lodash";

module.exports = {
    create: {
        handler: async request => {
            const esClient = request.server.plugins["es-client-wrapper"].es;
            const product = request.payload;
            let response = {};
            try {
                response = await esClient.index({
                    // index not create
                    index: request.index,
                    id: product.id,
                    body: product
                });

                return { message: "created", response: response };
            } catch (err) {
                return Boom.badRequest(err);
            }
        },
        validate: {
            payload: ProductValidation.createProductPayload,
            options: {
                allowUnknown: true
            }
        },
        description: "Save product - create or replace document",
        tags: ["api"],
        auth: "im-auth",
        plugins: {
            "hapi-internal-bridge": {
                auth: {
                    role: "ROLE_CATALOG",
                    permission: "ADD"
                }
            },
            "catalog-rest": true
        }
    },
    update: {
        handler: async request => {
            const esClient = request.server.plugins["es-client-wrapper"].es;
            const product = request.payload;

            const productId = request.params.id;
            try {
                const response = await esClient.update({
                    index: request.index,
                    id: productId,
                    body: {
                        doc: product
                    }
                });

                return { message: "updated", response: response };
            } catch (err) {
                return Boom.badRequest(err);
            }
        },
        validate: {
            payload: ProductValidation.createProductPayload,
            params: {
                id: Joi.number().required()
            },
            options: {
                allowUnknown: true
            }
        },
        description: "Update product partially (patch)",
        tags: ["api"],
        auth: "im-auth",
        plugins: {
            "hapi-internal-bridge": {
                auth: {
                    role: "ROLE_CATALOG",
                    permission: "EDIT"
                }
            },
            "catalog-rest": true
        }
    },
    get: {
        handler: async request => {
            const esClient = request.server.plugins["es-client-wrapper"].es;
            const productId = request.params.id;

            try {
                return await esClient.get({
                    index: request.index,
                    id: productId
                });
            } catch (err) {
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
        description: "Get product raw document by id",
        tags: ["api"],
        auth: "im-auth",
        plugins: {
            "hapi-internal-bridge": {
                auth: {
                    role: "ROLE_CATALOG",
                    permission: "GET"
                }
            },
            "catalog-rest": true
        }
    },
    getByFilters: {
        handler: async request => {
            const esClient = request.server.plugins["es-client-wrapper"].es;
            const esWrapper = new EsWrapper(esClient);
            esWrapper.setIndex(request.index);
            let conditions = { query: { match_all: {} } };

            try {
                //process filters
                let filters = GeneralHelper.parseFilters(request.query);
                if (!_.isEmpty(filters)) {
                    if (
                        GeneralValidation.validateFilter(
                            filters,
                            Object.keys(ProductValidation.getSchema)
                        ) === false
                    ) {
                        return Boom.badRequest();
                    }

                    conditions = {
                        query: {
                            bool: {
                                must: []
                            }
                        }
                    };

                    for (let filterName in filters) {
                        const filter = {};
                        let filterValue = filters[filterName];

                        if (filterValue.length > 1) {
                            filter[filterName] = filterValue;
                            conditions.query.bool.must.push({ terms: filter });
                        } else if (filterValue.length === 1) {
                            filter[filterName] = filterValue[0];
                            conditions.query.bool.must.push({ term: filter });
                        }
                    }
                }

                // retrieve only desired source fields
                if (
                    !_.isUndefined(request.query.fields) &&
                    !_.isEmpty(request.query.fields)
                ) {
                    conditions._source = request.query.fields;
                }

                // ECOMSUPP-170 - payload response is too big
                if (_.isEmpty(filters) && _.isUndefined(conditions._source)) {
                    return Boom.badRequest(
                        "Use at least one filter or source fields when retrieving documents."
                    );
                }

                const esResponse = await esWrapper.get(conditions);

                if (
                    _.isUndefined(esResponse.body.hits.hits) ||
                    _.isEmpty(esResponse.body.hits.hits)
                ) {
                    return Boom.notFound();
                }

                return esResponse.body.hits.hits.map(obj => {
                    return obj._source;
                });
            } catch (err) {
                return Boom.badRequest(err);
            }
        },
        description: "Get products by filters",
        tags: ["api"],
        auth: "im-auth",
        plugins: {
            "hapi-internal-bridge": {
                auth: {
                    role: "ROLE_CATALOG",
                    permission: "GET"
                }
            },
            "catalog-rest": true
        }
    },
    delete: {
        handler: async request => {
            const esClient = request.server.plugins["es-client-wrapper"].es;
            const productId = request.params.id;
            try {
                const response = await esClient.delete({
                    index: request.index,
                    id: productId
                });

                return { message: "deleted", response: response };
            } catch (err) {
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
        description: "Delete product",
        tags: ["api"],
        auth: "im-auth",
        plugins: {
            "hapi-internal-bridge": {
                auth: {
                    role: "ROLE_CATALOG",
                    permission: "DELETE"
                }
            },
            "catalog-rest": true
        }
    },
    bulk: {
        handler: async request => {
            const esClient = request.server.plugins["es-client-wrapper"].es;
            const config = request.server.catalogGlobalSettings;
            const { captureEvent } = request.server.methods;

            // request data
            const operation = request.method;
            const { data } = request.payload;
            const esIndex = request.index
                ? request.index
                : config.product.index;

            if (!_.isArray(data)) {
                return Boom.badRequest(
                    "Data must be an array containing items"
                );
            }

            const esWrapper = new EsWrapper(esClient);
            esWrapper.setIndex(esIndex);

            /**
             * Get current ids of products.
             * @param {array} idsToSearch
             * @returns array
             */
            const getCurrentIds = async idsToSearch => {
                idsToSearch = idsToSearch.map(val => parseInt(val));
                const currentData = await esWrapper.getIds({
                    query: {
                        bool: {
                            must: [
                                {
                                    terms: {
                                        id: idsToSearch
                                    }
                                }
                            ]
                        }
                    }
                });
                return _.intersection(
                    idsToSearch,
                    currentData.ids.map(val => parseInt(val))
                );
            };

            const params = { body: [] };
            try {
                const notices = [];
                if (operation === "delete") {
                    // extract current ids
                    const currentIds = await getCurrentIds(
                        data.map(item => item.id)
                    );
                    // remove
                    data.forEach(item => {
                        if (!currentIds.includes(item.id)) {
                            return;
                        }
                        params.body.push({
                            delete: {
                                _index: esIndex,
                                _id: item.id
                            }
                        });
                    });
                } else if (operation === "put") {
                    // extract current ids
                    const currentIds = await getCurrentIds(
                        data.map(item => item.id)
                    );

                    // update
                    data.forEach(item => {
                        if (_.isUndefined(item.id)) {
                            notices.push(
                                "ID is missing on object: " +
                                    JSON.stringify(item)
                            );
                            return;
                        }
                        if (!currentIds.includes(parseInt(item.id))) {
                            return;
                        }
                        params.body.push({
                            update: {
                                _index: esIndex,
                                _id: item.id
                            }
                        });
                        params.body.push({ doc: item });
                    });
                } else if (operation === "post") {
                    // create
                    data.forEach(item => {
                        if (_.isUndefined(item.id)) {
                            notices.push(
                                "ID is missing on object: " +
                                    JSON.stringify(item)
                            );
                            return;
                        }
                        params.body.push({
                            index: {
                                _index: esIndex,
                                _id: item.id
                            }
                        });
                        params.body.push(item);
                    });
                } else {
                    throw "Unknown operation";
                }

                if (params.body.length === 0) {
                    return Boom.badRequest("Missing any bulk updates");
                }

                params["refresh"] = "wait_for";
                const response = await esClient.bulk(params);
                if (response.body.errors) {
                    let items = [...response.body.items];
                    items = items.filter(item => {
                        for (const op of ["update", "delete", "index"]) {
                            if (item[op] && item[op].status >= 400) {
                                return true; // return only items with errors
                            }
                        }
                        return false;
                    });
                    response.body.items = items;
                    if (captureEvent) {
                        captureEvent({
                            message: `REST - Error on bulk product action`,
                            extra: {
                                items,
                                operation: operation,
                                params
                            }
                        });
                    }
                } else {
                    delete response.body.items;
                }
                delete response.meta;

                return {
                    message: `${operation.toUpperCase()} - status: ${
                        response.statusCode
                    }`,
                    response: response,
                    notices: notices,
                    operation: operation
                };
            } catch (err) {
                if (captureEvent) {
                    captureEvent({
                        message: `REST - Error on bulk product action`,
                        extra: {
                            error: err,
                            operation: operation,
                            params
                        }
                    });
                }
                return Boom.badRequest(err);
            }
        },
        payload: {
            maxBytes: 8388608 // 8MB
        },
        validate: {
            payload: {
                data: Joi.array().required()
            },
            options: {
                allowUnknown: true
            }
        },
        description:
            "Batch product operation - update partially / index / delete",
        tags: ["api"],
        auth: "im-auth",
        plugins: {
            "hapi-internal-bridge": {
                auth: {
                    role: "ROLE_CATALOG",
                    permission: "ADD"
                }
            },
            "catalog-rest": true
        }
    },
    removeField: {
        handler: async request => {
            const esClient = request.server.plugins["es-client-wrapper"].es;
            const fieldName = request.payload.fieldName;
            const data = request.payload.data;

            try {
                if (!_.isArray(data) || data.length === 0) {
                    throw "Ids are missing";
                }
                const response = await esClient.updateByQuery({
                    conflicts: "proceed",
                    index: request.index,
                    body: {
                        query: {
                            terms: {
                                id: data
                            }
                        },
                        script: {
                            source: 'ctx._source.remove("' + fieldName + '");'
                        }
                    },
                    conflicts: "proceed"
                });

                return {
                    message: "deleted",
                    response: response,
                    field: fieldName
                };
            } catch (err) {
                return Boom.badRequest(err);
            }
        },
        validate: {
            payload: {
                fieldName: Joi.string().required(),
                data: Joi.array().required()
            },
            options: {
                allowUnknown: true
            }
        },
        description: "Delete field from products",
        tags: ["api"],
        auth: "im-auth",
        plugins: {
            "hapi-internal-bridge": {
                auth: {
                    role: "ROLE_CATALOG",
                    permission: "DELETE"
                }
            },
            "catalog-rest": true
        }
    },
    getProductIds: {
        handler: request => {
            const config = request.server.catalogGlobalSettings;
            const esClient = request.server.plugins["es-client-wrapper"].es;
            const esWrapper = new EsWrapper(esClient);
            esWrapper.setIndex(
                request.index ? request.index : config.product.index
            );
            let conditions = { query: { match_all: {} } };

            try {
                let filters = GeneralHelper.parseFilters(request.query);
                if (!_.isEmpty(filters)) {
                    if (
                        GeneralValidation.validateFilter(
                            filters,
                            Object.keys(ProductValidation.getSchema)
                        ) === false
                    ) {
                        return Boom.badRequest();
                    }

                    conditions = {
                        query: {
                            bool: {
                                must: []
                            }
                        }
                    };

                    Object.keys(filters).forEach(filterName => {
                        const filter = {};

                        filter[filterName] = filters[filterName];
                        conditions.query.bool.must.push({ terms: filter });
                    });
                }

                if (!_.isUndefined(request.query.exists)) {
                    if (_.isUndefined(conditions.query.bool)) {
                        conditions.query = {
                            bool: {
                                must: {}
                            }
                        };
                    }
                    conditions.query.bool.must.exists = {
                        field: request.query.exists
                    };
                }

                return esWrapper.getIds(conditions);
            } catch (err) {
                return Boom.badRequest(err);
            }
        },
        validate: {
            query: {
                exists: Joi.string().optional(),
                filter: Joi.optional()
            }
        },
        description: "Get product raw document by id",
        tags: ["api"],
        //auth: 'im-auth',
        plugins: {
            "hapi-internal-bridge": {
                auth: {
                    role: "ROLE_CATALOG",
                    permission: "GET"
                }
            },
            "catalog-rest": true
        }
    }
};
