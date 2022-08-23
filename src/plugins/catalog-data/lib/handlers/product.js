"use strict";

import Boom from "@hapi/boom";
import Validation from "../validate/product";
import Joi from "@hapi/joi";
import _ from "lodash";

export default {
    /**
     * List products handler.
     */
    list: {
        handler: async (request, h) => {
            const esDataLoader = request.server.plugins.catalog.esData;
            const transformer = request.server.plugins.catalog.dataTransformer;
            try {
                /**
                 * Query params should be converted to ES bool clauses.
                 * Grouped by each key.
                 * @param queryParams
                 * @returns {{bool: {must: Array}}}
                 */
                const prepareEsConditions = queryParams => {
                    const filters = { bool: { must: [] } };
                    const parsed = esDataLoader.parseFilters(queryParams);

                    Object.keys(parsed).forEach(key => {
                        let filter = {};
                        filter[key] = parsed[key];
                        filters.bool.must.push({ terms: filter });
                    });
                    if (filters.bool.must.length && !parsed.hasOwnProperty("status")) {
                        // force only enabled products when status filter is not applied
                        filters.bool.must.push({
                            term: {
                                status: esDataLoader.productStatuses.enabled
                            }
                        });
                    }
                    filters.forcedSize = 250;

                    return filters;
                };

                /**
                 * Build meta objects.
                 * @param info
                 * @returns {{size: (*|number)}}
                 */
                const buildMeta = info => {
                    return {
                        size: info.total || 0
                    };
                };

                const collection = await esDataLoader.getProductCollection(
                    prepareEsConditions(request.query),
                    Object.keys(Validation.getValidationSchema("simple"))
                );
                let result = {};
                result.products = [];

                result.meta = buildMeta(collection);
                collection.products.forEach(product => {
                    result.products.push(
                        transformer.transformProductSimpleSchema(product)
                    );
                });

                return result;
            } catch (err) {
                return Boom.internal(err || "Internal error");
            }
        },
        description: "GET product list",
        notes:
            "Returns a list of products filtered by attributes send through get params",
        tags: ["api"],
        validate: Validation.listActionValidation,
        response: {
            schema: Validation.getValidationSchema("list"),
            options: {
                allowUnknown: true
            }
        }
    },
    /**
     * View product handler.
     */
    view: {
        handler: async (request, h) => {
            const esDataLoader = request.server.plugins.catalog.esData;
            const transformer = request.server.plugins.catalog.dataTransformer;
            const settings = request.server.catalogGlobalSettings;
            try {
                let product = await esDataLoader.getProduct(
                    request.params.key,
                    request.params.value
                );

                if (!product) {
                    return Boom.notFound("Produsul nu a fost gasit");
                } else {
                    const attributeSet = await esDataLoader.getAttributeSetById(
                        parseInt(product.attribute_set_id)
                    );
                    product = transformer.transformProductFullSchema(
                        product,
                        attributeSet,
                        settings.data.product.view.unsetKeys
                    );
                    return product;
                }
            } catch (err) {
                return Boom.internal(err.toString() || "Internal error");
            }
        },
        description: "GET single product",
        notes: "Returns full details for a product",
        tags: ["api"],
        validate: Validation.viewActionValidation,
        response: {
            schema: Validation.getValidationSchema(
                "full",
                [
                    "price",
                    "regular_price",
                    "stock_status",
                    "filter_resealed",
                    "seller_ids"
                ] // avoid passing settings from server
            ),
            options: {
                allowUnknown: true
            }
        }
    },
    /**
     * Compare products handler.
     */
    compare: {
        handler: async (request, h) => {
            const config = request.server.catalogGlobalSettings;
            const esDataLoader = request.server.plugins.catalog.esData;
            const transformer = request.server.plugins.catalog.dataTransformer;
            let comparableAttributes = Object.keys(
                require("../validate/product").getValidationSchema("simple")
            );

            try {
                //process skus
                let skus = request.query.sku;

                if (!_.isArray(skus)) {
                    skus = [skus];
                }

                //skus validation
                if (
                    skus.length < 2 ||
                    skus.length + 1 > config.data.product.compare.max_items
                ) {
                    return Boom.badRequest("Numar de produse invalid");
                }

                //get first product in order to obtain attribute_set_id
                const firstProduct = await esDataLoader.getProduct(
                    "sku",
                    skus[0]
                );

                if (_.isEmpty(firstProduct)) {
                    return Boom.notFound("Produsul nu a fost gasit");
                }

                //get attributes sets
                const attributeSetData = await esDataLoader.getComparableAttributes(
                    firstProduct.attribute_set_id
                );
                const attributeSet = attributeSetData.attributeSet;
                comparableAttributes = _.union(
                    comparableAttributes,
                    attributeSetData.comparableAttributes
                );
                //get all products based on given skus
                const products = await esDataLoader.getProductCollection(
                    {
                        bool: {
                            must: [
                                {
                                    terms: {
                                        sku: skus
                                    }
                                },
                                {
                                    terms: {
                                        visibility:
                                            config.data.product
                                                .defaultCategoryFilters
                                                .visibility
                                    }
                                },
                                {
                                    term: {
                                        attribute_set_id: {
                                            value: firstProduct.attribute_set_id
                                        }
                                    }
                                },
                                {
                                    term: {
                                        status: {
                                            value:
                                                config.data.product
                                                    .defaultCategoryFilters
                                                    .status
                                        }
                                    }
                                }
                            ]
                        },
                        size: skus.length
                    },
                    _.difference(
                        comparableAttributes,
                        config.data.product.compare.protected_attributes
                    )
                );

                if (
                    _.isUndefined(products.products) ||
                    products.products.length < 2
                ) {
                    return Boom.notFound("Produsul nu a fost gasit");
                }

                //attach comparable attributes to products
                for (const i in products.products) {
                    products.products[
                        i
                    ] = transformer.transformProductFullSchema(
                        products.products[i],
                        attributeSet,
                        config.data.product.compare.exclude_fields_from_immutable_attributes
                    );
                }

                return products;
            } catch (err) {
                return Boom.badRequest(err);
            }
        },
        description: "Compare products in list",
        tags: ["api"],
        validate: {
            query: {
                sku: Joi.alternatives()
                    .try([Joi.array().unique(), Joi.string()])
                    .required()
                    .label("Products to be compared")
            }
        },
        response: {
            schema: {
                products: Joi.array().items(
                    Validation.getValidationSchema("simple")
                )
            },
            options: {
                allowUnknown: true
            }
        }
    },
    /**
     * Compare products status handler.
     */
    compareStatus: {
        handler: async (request, h) => {
            const config = request.server.catalogGlobalSettings;
            const esDataLoader = request.server.plugins.catalog.esData;
            const transformer = request.server.plugins.catalog.dataTransformer;
            let allSkus = [];
            let toReturn = {};

            try {
                let currentSkus = request.query.current;
                if (!_.isUndefined(currentSkus) && !_.isArray(currentSkus)) {
                    currentSkus = [currentSkus];
                }
                let newSku = request.query.product;
                if (
                    !_.isUndefined(currentSkus) &&
                    currentSkus.length + 1 >
                        config.data.product.compare.max_items
                ) {
                    return Boom.badRequest("Too many products.");
                }
                if (!_.isUndefined(currentSkus) && currentSkus.length > 0) {
                    allSkus = _.union(allSkus, currentSkus);
                }
                allSkus.push(newSku);

                //get all products based on given skus
                const products = await esDataLoader.getProductCollection(
                    {
                        bool: {
                            must: [
                                {
                                    terms: {
                                        sku: allSkus
                                    }
                                },
                                {
                                    terms: {
                                        visibility:
                                            config.data.product
                                                .defaultCategoryFilters
                                                .visibility
                                    }
                                },
                                {
                                    term: {
                                        status: {
                                            value:
                                                config.data.product
                                                    .defaultCategoryFilters
                                                    .status
                                        }
                                    }
                                }
                            ]
                        },
                        size: allSkus.length
                    },
                    Object.keys(
                        require("../validate/product").getValidationSchema(
                            "simple"
                        )
                    )
                );

                if (products.products.length !== allSkus.length) {
                    //check if we got all products
                    return Boom.notFound("Some products do not exist");
                }

                let attributeSetId = null;
                for (const product of products.products) {
                    if (_.isNull(attributeSetId)) {
                        attributeSetId = parseInt(product.attribute_set_id);
                    } else if (
                        attributeSetId !== parseInt(product.attribute_set_id)
                    ) {
                        return Boom.badRequest(
                            "Produsele nu sunt din aceasi categorie"
                        );
                    }
                    if (product.sku === newSku) {
                        toReturn = transformer.transformProductSimpleSchema(
                            product
                        );
                    }
                }

                return toReturn;
            } catch (err) {
                return Boom.badRequest(err);
            }
        },
        description: "Compare status - Check a new product",
        tags: ["api"],
        validate: {
            query: {
                current: Joi.alternatives()
                    .try([Joi.array().unique(), Joi.string()])
                    .optional()
                    .label("Current products list"),
                product: Joi.string()
                    .label("New product to be added to list")
                    .required()
                    .disallow(Joi.ref("current"))
            }
        },
        response: {
            schema: Validation.getValidationSchema("simple"),
            options: {
                allowUnknown: true
            }
        }
    }
};
