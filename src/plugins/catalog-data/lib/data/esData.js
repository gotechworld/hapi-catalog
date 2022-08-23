"use strict";

import _ from "lodash";
import BrandsHelper from "../helpers/brands";

/**
 * Constructor function
 * @param server Instance of server
 * @param indexSettings Settings for each entity type ({index: indexName, type: typeName})
 * @param cacheSettings Cache settings for cache instance
 * @param dataSettings Various settings pushed for filtering data and so on
 */
function esDataLoader(server, indexSettings, cacheSettings, dataSettings) {
    const self = this;

    // define some constants for display type
    const displayTypes = {
        subcategories: ["PAGE", "PRODUCTS_AND_PAGE"],
        products: ["PRODUCTS", "PRODUCTS_AND_PAGE"],
    };

    const functionalRelationshipTypes = [
        "extra_warranty",
        "mobile_protect",
        "buyback",
        "install",
    ];

    const defaultFields = {
        productEntity: Object.keys(
            require("../validate/product").getValidationSchema("simple")
        ),
        requiredProductSchema: () => {
            const requiredFields = [];
            const schema = require("../validate/product").getValidationSchema(
                "simple"
            );
            for (let field in schema) {
                if (_.get(schema, `${field}._flags.default`, -100) !== -100) {
                    continue;
                }
                if (
                    _.get(schema, `${field}._flags.presence`, "optional") ===
                    "required"
                ) {
                    requiredFields.push(field);
                }
            }
            return requiredFields;
        },
        filterEntity: ["attribute_code", "filters", "label", "slug", "order"],
        productServices: ["service_price_apply_type", "service_price"],
    };

    const productStatuses = {
        unknown: 0,
        enabled: 1,
        disabled: 2,
    };

    const stockStatuses = {
        out_of_stock: 0,
        in_stock: 1,
        in_supplier_stock: 2,
        preorder: 3,
        eol: 4,
    };

    const sortDirections = ["desc", "asc"];

    const defaultCategoryFilters = ["status", "visibility", "category_ids"];

    const priceAttributeCode = "price";

    const categoryIdsAttributeCode = "category_ids";

    const sellerIdsAttributeCode = "seller_ids";

    const allDataOnRelationshipsProductTypes = ["bundle"];

    const categoryData = {};

    const sellerData = {};

    let brandsData = [];

    // Properties to be used beyond
    this.server = server;
    this.indexSettings = indexSettings;
    this.cacheSettings = cacheSettings;
    this.dataSettings = dataSettings;
    this.esWrapper = null;
    this.cacheClient = null;
    this.dataTransformer = null;

    /**
     * Get cache id.
     * @param entityType
     * @param value
     * @returns {string}
     */
    const getCacheId = (entityType, value) => {
        return (entityType + "_" + value).toLowerCase().replace(" ", "_");
    };

    /**
     * Save cache object.
     * @param id
     * @param value
     */
    const saveCache = async (id, value) => {
        const ttl = self.dataSettings.cache.ttl;

        if (self.getCacheClient() !== null) {
            try {
                await self.getCacheClient().set(id, value, ttl);
            } catch (e) {
                console.log(e);
            }
        }
    };

    /**
     * Load from cache by cacheId.
     * @param cacheId
     * @returns {Promise}
     */
    const loadFromCache = (cacheId) => {
        return new Promise((resolveCache, rejectCache) => {
            if (self.getCacheClient() === null) {
                rejectCache();
                return;
            }
            try {
                (async () => {
                    const value = await self.getCacheClient().get(cacheId);
                    if (value !== null) {
                        resolveCache(value);
                    } else {
                        rejectCache();
                    }
                })();
            } catch (e) {
                rejectCache(e);
            }
        });
    };

    esDataLoader.prototype.initDataCache = () => {
        const intervalTime =
            self.server.catalogGlobalSettings.categoryIntervalTime || 1800000;

        self.initData();
        setInterval(() => {
            self.initData();
        }, intervalTime);
    };

    esDataLoader.prototype.productStatuses = productStatuses;

    /**
     * Init data.
     * @todo reuse category data tree for rendering the menu
     */
    esDataLoader.prototype.initData = async () => {
        // load all categories - used for layered navigation
        categoryData["tree"] = {};
        self.configureWrapper("category");
        self.getDocuments({
            query: {
                bool: {
                    must: [{ term: { status: 1 } }],
                },
            },
            size: self.dataSettings.category.maxCategories,
        }).then((results) => {
            if (_.has(results, "body.hits.hits", false)) {
                results.body.hits.hits.forEach((child) => {
                    child = self.parseSource(child);
                    categoryData["catId" + child.id] = child;
                    categoryData[
                        "slug" + child.id + "-" + child.url_key
                    ] = child;

                    if (_.isUndefined(categoryData["tree"][child.parent_id])) {
                        categoryData["tree"][child.parent_id] = [];
                    }
                    categoryData["tree"][child.parent_id].push(child.id);
                });
            }
        }, console.error);

        // load all sellers
        self.configureWrapper("seller");
        self.getDocuments({
            query : { match_all : {} }
        }).then(
            (results) => {
                results.body.hits.hits.forEach((seller) => {
                    seller = self.parseSource(seller);
                    sellerData[seller.id] = seller;
                });
            }, console.error);

        // load all brands
        brandsData = await BrandsHelper.loadBrands(
            self,
            dataSettings.product.brands.disallowedAttributeSetIds
        );
    };

    /**
     * Expose category data.
     * @returns {{}}
     */
    esDataLoader.prototype.getCategoryData = () => {
        return categoryData;
    };

    esDataLoader.prototype.getBrandsData = () => brandsData;

    /**
     * Get index configuration by entity type.
     * @param entityType
     * @returns {*}
     */
    esDataLoader.prototype.getIndexSettings = (entityType) => {
        return self.indexSettings[entityType];
    };

    /**
     * Configure wrapper to use some entity settings.
     * @param entityType
     * @returns {esDataLoader}
     */
    esDataLoader.prototype.configureWrapper = (entityType) => {
        const options = self.getIndexSettings(entityType);
        self.getEsWrapper().setIndex(options.index);

        return self;
    };

    /**
     *
     * @param cacheClientInstance
     * @returns {esDataLoader}
     */
    esDataLoader.prototype.setCacheClient = (cacheClientInstance) => {
        self.cacheClient = cacheClientInstance;

        return self;
    };

    /**
     *
     * @returns {*}
     */
    esDataLoader.prototype.getCacheClient = () => {
        if (self.cacheClient === null) {
            self.setCacheClient(self.server.cache(self.cacheSettings));
        }

        return self.cacheClient;
        // return _.isUndefined(self.cacheClient._cache) ? null : self.cacheClient._cache.connection.client;
    };

    /**
     * Set wrapper with index& type configured.
     * @param esWrapperInstance
     * @returns {esDataLoader}
     */
    esDataLoader.prototype.setEsWrapper = (esWrapperInstance) => {
        self.esWrapper = esWrapperInstance;

        return self;
    };

    /**
     * Get data transformer.
     * @returns {*}
     */
    const getTransformer = () => {
        if (self.dataTransformer === null) {
            self.dataTransformer = self.server.plugins.catalog.dataTransformer;
        }

        return self.dataTransformer;
    };

    /**
     * Get es wrapper.
     * @returns {null|*}
     */
    esDataLoader.prototype.getEsWrapper = () => {
        if (self.esWrapper === null) {
            self.setEsWrapper(
                self.server.plugins["es-client-wrapper"].esWrapper
            );
        }

        return self.esWrapper;
    };

    /**
     * Get document by key and value.
     * @param key
     * @param value
     * @returns {V|Promise|*}
     */
    esDataLoader.prototype.getDocument = (key, value) => {
        const query = { query: { match: {} } };
        query.query.match[key] = value;
        query.size = 1; // force size, avoid scan

        return this.getDocuments(query);
    };

    /**
     * Get documents by query.
     * @param query
     * @returns {V|Promise|*}
     */
    esDataLoader.prototype.getDocuments = (query) => {
        return this.getEsWrapper().get(query);
    };

    /**
     * Get single result.
     * @param results
     * @param field
     * @returns {*}
     */
    esDataLoader.prototype.getSingleResult = (results, field) => {
        const hits = results.body.hits;
        field = field || "_source";
        const total = hits.total.value || 0;

        if (total === 0) {
            return false;
        }

        return hits.hits[0][field];
    };

    /**
     * Get product.
     * @param key
     * @param value
     * @returns {Promise}
     */
    esDataLoader.prototype.getProduct = async (key, value) => {
        const results = await this.configureWrapper("product").getDocument(
            key,
            value
        );
        const productData = this.getSingleResult(results);

        if (!productData || isDisabled(productData)) {
            return false;
        }

        if (
            !_.isUndefined(productData.category_ids) &&
            productData.category_ids.length > 0
        ) {
            try {
                const breadcrumbs = await this.getBreadcrumbs(
                    productData.category_ids,
                    productData
                );
                productData.breadcrumbs = breadcrumbs;
            } catch (err) {
                productData.breadcrumbs = {};
            }
        }

        try {
            await this.getProductsByRelationships(productData);
        } catch (err) {
            delete productData.product_links;
        }

        return productData;
    };

    /**
     * Iterate over product_links, reuse ids and aggregate results for each relationship type.
     * @param productData
     * @param loadAllAttributes @deprecated
     * @returns {Promise}
     */
    esDataLoader.prototype.getProductsByRelationships = async (
        productData,
        loadAllAttributes = false
    ) => {
        if (
            _.isUndefined(productData.product_links) ||
            _.isNull(productData.product_links)
        ) {
            return productData;
        }

        let relatedProductIds = [];
        Object.keys(productData.product_links).forEach((relationshipType) => {
            // ECOMDEV-744 - x-sell / up-sell are coming up from enginey
            if (!functionalRelationshipTypes.includes(relationshipType)) {
                delete productData.product_links[relationshipType];
                return;
            }
            productData.product_links[relationshipType].forEach((productId) => {
                relatedProductIds.push(parseInt(productId));
            });
        });

        const relatedProducts = {};
        relatedProductIds = _.uniq(relatedProductIds);
        if (relatedProductIds.length > 0) {
            const collectionParams = {};
            /*
            @todo see if we also reuse visibility... but in this case we shouldn't enforce it
            i.e e-warranties are not visible individually nor gifts
            */
            collectionParams.filter = [];
            collectionParams.filter.push(
                "status:" +
                    self.dataSettings.product.defaultCategoryFilters.status
            );
            collectionParams.filter.push("id:" + relatedProductIds.join("_"));
            collectionParams.filter.push(
                "stock_status:" +
                    [
                        stockStatuses.in_stock,
                        stockStatuses.in_supplier_stock,
                        stockStatuses.preorder,
                    ].join("_")
            );
            collectionParams.size = relatedProductIds.length;
            collectionParams.sort = "id";

            const params = this.getProductCollectionConstraints(
                collectionParams,
                {}
            );

            let fields = [];
            if (!loadAllAttributes) {
                fields = _.union(
                    defaultFields.productEntity,
                    defaultFields.productServices
                );
            }

            const collection = await this.getProductCollection(params, fields);

            Object.keys(productData.product_links).forEach(
                (relationshipType) => {
                    productData.product_links[relationshipType].forEach(
                        (productId) => {
                            const currentProduct = findInCollection(
                                collection.products,
                                productId
                            );
                            if (currentProduct) {
                                if (
                                    _.isUndefined(
                                        relatedProducts[relationshipType]
                                    )
                                ) {
                                    relatedProducts[relationshipType] = [];
                                }
                                relatedProducts[relationshipType].push(
                                    currentProduct
                                );
                            }
                        }
                    );
                }
            );
        }
        productData.product_links = relatedProducts;
        return productData;
    };

    /**
     * Get lowest price of category.
     * @param categoryId
     * @returns {*}
     */
    esDataLoader.prototype.getLowestPriceOfCategory = async (categoryId) => {
        let price = 0;
        if (
            !_.isUndefined(categoryData["cat_" + categoryId + "_lowest_price"])
        ) {
            price = categoryData["cat_" + categoryId + "_lowest_price"];
        } else {
            self.configureWrapper("product");
            const product = await self.getDocuments({
                query: {
                    bool: {
                        must: [
                            {
                                term: {
                                    status:
                                        self.dataSettings.product
                                            .defaultCategoryFilters.status,
                                },
                            },
                            {
                                terms: {
                                    visibility:
                                        self.dataSettings.product
                                            .defaultCategoryFilters.visibility,
                                },
                            },
                            { term: { category_ids: categoryId } },
                        ],
                    },
                    aggs: {
                        min_price: { min: { field: "price" } },
                    },
                    size: 0,
                },
            });
            if (!_.isUndefined(product)) {
                categoryData[
                    "cat_" + categoryId + "_lowest_price"
                ] = parseFloat(
                    product.body.aggregations.min_price.value
                ).toFixed(2);
                price = categoryData["cat_" + categoryId + "_lowest_price"];
            }
        }

        return price;
    };

    /**
     * Get category.
     * @param key
     * @param value
     * @param collectionParams Used for filtering up collection parans
     * @param applyStockSort
     * @returns {Promise}
     */
    esDataLoader.prototype.getCategory = (
        key,
        value,
        collectionParams,
        applyStockSort = true
    ) => {
        return new Promise((resolve, reject) => {
            self.configureWrapper("category")
                .getDocument(key, value)
                .then(
                    (results) => {
                        const category = self.getSingleResult(results);

                        if (_.isUndefined(category.id)) {
                            resolve(false);
                            return "";
                        }

                        if (
                            parseInt(category.landing_page) ===
                            self.dataSettings.category.cmsBlockSubcategoryListId
                        ) {
                            delete category.landing_page;
                        }

                        const parentIds = category.path.split("/");

                        if (
                            displayTypes.subcategories.includes(
                                category.display_mode
                            )
                        ) {
                            self.getCategoryChildren(category.id).then(
                                (subcategories) => {
                                    category.meta = self.getCollectionMeta(
                                        {},
                                        subcategories.length
                                    );
                                    category.subcategories = subcategories;
                                    // aggregate breadcrumbs
                                    if (
                                        _.isArray(parentIds) &&
                                        parentIds.length > 0
                                    ) {
                                        self.getBreadcrumbs(
                                            _.difference(parentIds, [
                                                category.id,
                                            ]),
                                            category
                                        ).then((breadcrumbs) => {
                                            category.breadcrumbs = breadcrumbs;
                                        });
                                    }
                                }
                            );
                        }

                        if (
                            displayTypes.products.includes(
                                category.display_mode
                            )
                        ) {
                            if (_.isUndefined(collectionParams.filter)) {
                                collectionParams.filter = [];
                            } else if (
                                !_.isEmpty(collectionParams.filter) &&
                                !_.isArray(collectionParams.filter)
                            ) {
                                const singleOption = collectionParams.filter;
                                collectionParams.filter = [];
                                collectionParams.filter.push(singleOption);
                            }
                            if (applyStockSort) {
                                collectionParams.stock_sort = true;
                            }

                            // push various filters for current product selection
                            collectionParams.filter.push(
                                categoryIdsAttributeCode + ":" + category.id
                            );
                            collectionParams.filter.push(
                                "visibility:" +
                                    self.dataSettings.product.defaultCategoryFilters.visibility.join(
                                        "_"
                                    )
                            );
                            collectionParams.filter.push(
                                "status:" +
                                    self.dataSettings.product
                                        .defaultCategoryFilters.status
                            );

                            const setIdsQuery = {
                                query: {
                                    bool: {
                                        must: [
                                            {
                                                term: {
                                                    category_ids: category.id,
                                                },
                                            },
                                        ],
                                    },
                                },
                            };

                            self.getProductCollectionSetIds(setIdsQuery).then(
                                (setIdsList) => {
                                    self.getFilterableAttributes(
                                        setIdsList
                                    ).then((attrsBySet) => {
                                        const filterableAttributes = {};
                                        attrsBySet.forEach((itemsList) => {
                                            _.extend(
                                                filterableAttributes,
                                                itemsList
                                            );
                                        });

                                        const params = self.getProductCollectionConstraints(
                                            collectionParams,
                                            filterableAttributes
                                        );

                                        self.getProductCollection(
                                            params,
                                            defaultFields.productEntity
                                        ).then(
                                            (collection) => {
                                                category.meta = self.getCollectionMeta(
                                                    collectionParams,
                                                    collection.total
                                                );
                                                category.products =
                                                    collection.products;
                                                category.layeredNavigation = [];

                                                const decorateLayeredNavigation = () => {
                                                    if (
                                                        collection.products
                                                            .length > 0
                                                    ) {
                                                        const sellerIds = this.getProductCollectionSellerIds(collection);
                                                        self.getLayeredNavigation(
                                                            params,
                                                            filterableAttributes,
                                                            category.id,
                                                            sellerIds
                                                        )
                                                            .then(
                                                                (
                                                                    layeredNavigation
                                                                ) => {
                                                                    category.layeredNavigation = layeredNavigation;
                                                                }
                                                            )
                                                            .then(() => {
                                                                resolve(
                                                                    category
                                                                );
                                                            });
                                                    } else {
                                                        resolve(category);
                                                    }
                                                };

                                                // aggregate breadcrumbs
                                                if (
                                                    _.isArray(parentIds) &&
                                                    parentIds.length > 0
                                                ) {
                                                    self.getBreadcrumbs(
                                                        _.difference(
                                                            parentIds,
                                                            [category.id]
                                                        ),
                                                        category
                                                    ).then((breadcrumbs) => {
                                                        category.breadcrumbs = breadcrumbs;
                                                        decorateLayeredNavigation();
                                                    });
                                                } else {
                                                    decorateLayeredNavigation();
                                                }
                                            },
                                            (err) => {
                                                reject(err);
                                            }
                                        );
                                    });
                                },
                                (err) => {
                                    reject(err);
                                }
                            );
                        } else {
                            resolve(category);
                        }
                    },
                    (err) => {
                        reject(err);
                    }
                )
                .catch((err) => {
                    reject(err);
                });
        });
    };

    /**
     * Get children categories.
     * @param categoryId
     * @returns {Promise}
     */
    esDataLoader.prototype.getCategoryChildren = (categoryId) => {
        const subcategories = [];
        const items = [];

        if (!_.isUndefined(categoryData.tree[categoryId])) {
            const childrenIds = categoryData.tree[categoryId];
            childrenIds.forEach((childrenId) => {
                if (_.isUndefined(categoryData["catId" + childrenId])) {
                    return;
                }
                if (
                    _.isUndefined(categoryData["catId" + childrenId].position)
                ) {
                    categoryData["catId" + childrenId].position = 0;
                }
                const position = parseInt(
                    categoryData["catId" + childrenId].position
                );
                items[position] = categoryData["catId" + childrenId];
            });
            items.forEach((item) => {
                subcategories.push(item);
            });
        }

        return new Promise(
            (resolve) => {
                resolve(subcategories);
            },
            () => {
                resolve(subcategories);
            }
        );

        // AMS-56 - reuse categoryData - spare some logic and queries
        // const query = {
        //     query: {
        //         bool: {
        //             must: [{
        //                 match: {
        //                     parent_id: categoryId
        //                 }
        //             }, {
        //                 term: {
        //                     status: 1
        //                 }
        //             }]
        //         }
        //     },
        //     size: self.dataSettings.category.maxChildren
        // };
        //
        // return new Promise((resolve, reject) => {
        //
        //     self.configureWrapper('category');
        //     self
        //         .getDocuments(query)
        //         .then((results) => {
        //
        //             const children = [];
        //             results.hits.hits.forEach((child) => {
        //
        //                 children.push(self.parseSource(child));
        //             });
        //             resolve(children);
        //         }).catch(() => {
        //
        //         reject();
        //     });
        // });
    };

    /**
     * Get list of breadcrumbs by category ids. (itemIds)
     * @param itemIds
     * @param currentObject
     * @returns {Promise}
     */
    esDataLoader.prototype.getBreadcrumbs = (itemIds, currentObject) => {
        const breadcrumbs = [];
        let pushedCurrentObject = false;
        let parentId = 0;

        const categories = [];

        itemIds.forEach((itemId) => {
            if (_.isUndefined(categoryData["catId" + itemId])) {
                return;
            }

            categories.push(categoryData["catId" + itemId]);
        });

        categories.sort((a, b) => {
            return a.level > b.level;
        });

        for (const category of categories) {
            // follow the first matched path (level + parent id)
            if (category.level <= 1) {
                continue;
            }
            if (parentId > 0 && parseInt(category.parent_id) !== parentId) {
                continue;
            }
            parentId = parseInt(category.id);

            if (
                !_.isUndefined(currentObject) &&
                parseInt(currentObject.id) === parseInt(category.id)
            ) {
                pushedCurrentObject = true;
            }

            breadcrumbs.push({
                name: category.name.toString(),
                id: parseInt(category.id),
                url_key: category.url_key.toString(),
                level:
                    parseInt(currentObject.id) === parseInt(category.id)
                        ? 99
                        : parseInt(category.level),
            });
        }

        if (!pushedCurrentObject && !_.isUndefined(currentObject)) {
            breadcrumbs.push({
                name: currentObject.name.toString(),
                id: parseInt(currentObject.id),
                url_key: currentObject.url_key.toString(),
                level: 99,
            });
        }

        return new Promise(
            (resolve, reject) => {
                resolve(
                    breadcrumbs.sort((a, b) => {
                        return a.level > b.level;
                    })
                );
            },
            () => {
                resolve(breadcrumbs);
            }
        );

        // AMS-56 - reuse categoryData - spare some logic and queries
        // return new Promise((resolve, reject) => {
        //
        //     const query = {
        //         query: {
        //             bool: {
        //                 must: [
        //                     {
        //                         terms: {
        //                             id: itemIds
        //                         }
        //                     },
        //                     {
        //                         term: {
        //                             status: 1
        //                         }
        //                     },
        //                     {
        //                         range: {
        //                             level: {
        //                                 gt: 1
        //                             }
        //                         }
        //                     }
        //                 ]
        //             }
        //         },
        //         _source: ['name', 'id', 'request_path', 'level']
        //     };
        //     self.configureWrapper('category');
        //     self.getDocuments(query).then((results) => {
        //
        //         results.hits.hits.forEach((category) => {
        //
        //             category = self.parseSource(category);
        //             breadcrumbs.push({
        //                 name: category.name,
        //                 id: parseInt(category.id),
        //                 url_key: category.request_path,
        //                 level: parseInt(category.level)
        //             });
        //         });
        //
        //         if (!_.isUndefined(currentObject)) {
        //             breadcrumbs.push({
        //                 name: currentObject.name,
        //                 id: parseInt(currentObject.id),
        //                 url_key: currentObject.url_key,
        //                 level: 99
        //             });
        //         }
        //
        //         resolve(breadcrumbs.sort((a, b) => { return a.level > b.level}));
        //     }, () => {
        //
        //         breadcrumbs.push({
        //             name: currentObject.name,
        //             id: currentObject.id,
        //             url_key: currentObject.url_key,
        //             level: 99
        //         });
        //         resolve(breadcrumbs);
        //     });
        // });
    };

    /**
     * Get collection documents by applying filters.
     * @param params
     * @param fields
     * @returns {Promise}
     */
    esDataLoader.prototype.getProductCollection = (params, fields) => {
        return new Promise((resolve, reject) => {
            self.configureWrapper("product");
            self.getDocuments(self.getProductCollectionQuery(params, fields))
                .then(
                    (results) => {
                        const products = [];
                        results.body.hits.hits.forEach((product) => {
                            products.push(self.parseSource(product));
                        });
                        resolve({
                            products,
                            total: results.body.hits.total.value,
                        });
                    },
                    (err) => {
                        reject(err);
                    }
                )
                .catch((err) => {
                    reject(err);
                });
        });
    };

    /**
     * Get attribute set detailed info.
     * @param attributeSetId
     * @returns {Promise}
     */
    esDataLoader.prototype.getAttributeSetById = (attributeSetId) => {
        const cacheId = getCacheId("set", attributeSetId);

        return new Promise((resolve, reject) => {
            loadFromCache(cacheId)
                .then(
                    (cachedData) => {
                        if (cachedData) {
                            resolve(cachedData);
                        }
                    },
                    (err) => {
                        if (err) {
                            console.error(err);
                        }
                        throw err;
                    }
                )
                .catch(() => {
                    self.configureWrapper("set");
                    self.getDocument("id", attributeSetId)
                        .then(
                            (attributeSets) => {
                                const attributeSet = self.getSingleResult(
                                    attributeSets
                                );
                                if (!attributeSet) {
                                    reject("Unknown attribute set");
                                } else {
                                    const groupsQuery = {
                                        query: {
                                            terms: { id: attributeSet.groups },
                                        },
                                        size: attributeSet.groups.length,
                                    };
                                    self.configureWrapper("group");
                                    self.getDocuments(groupsQuery)
                                        .then((results) => {
                                            let attributeIds = [];
                                            const groups = [];

                                            results.body.hits.hits.forEach(
                                                (group) => {
                                                    if (
                                                        self.parseSource(group)
                                                            .attributes
                                                    ) {
                                                        attributeIds = attributeIds.concat(
                                                            self.parseSource(
                                                                group
                                                            ).attributes
                                                        );
                                                        groups.push(
                                                            self.parseSource(
                                                                group
                                                            )
                                                        );
                                                    }
                                                }
                                            );

                                            // decorate set with groups
                                            attributeSet.groups = groups;

                                            const attributesQuery = {
                                                query: {
                                                    bool: {
                                                        must: [
                                                            {
                                                                terms: {
                                                                    id: attributeIds,
                                                                },
                                                            },
                                                        ],
                                                        should: [
                                                            {
                                                                term: {
                                                                    is_visible: 1,
                                                                },
                                                            },
                                                            {
                                                                term: {
                                                                    is_visible_front: 1,
                                                                },
                                                            },
                                                        ],
                                                        minimum_should_match: 1,
                                                    },
                                                },
                                                size: attributeIds.length,
                                            };

                                            self.configureWrapper("attribute");
                                            self.getDocuments(attributesQuery)
                                                .then((collection) => {
                                                    const attributes = {};

                                                    collection.body.hits.hits.forEach(
                                                        (attribute) => {
                                                            if (
                                                                self.parseSource(
                                                                    attribute
                                                                )
                                                            ) {
                                                                const source = self.parseSource(
                                                                    attribute
                                                                );

                                                                // AS-758
                                                                if (
                                                                    source.frontend_input ===
                                                                    "boolean"
                                                                ) {
                                                                    source.options.forEach(
                                                                        (
                                                                            item,
                                                                            index
                                                                        ) => {
                                                                            item.label = getTransformer().getAttributeText(
                                                                                item.value,
                                                                                source
                                                                            );
                                                                            source.options[
                                                                                index
                                                                            ] = item;
                                                                        }
                                                                    );
                                                                }

                                                                attributes[
                                                                    parseInt(
                                                                        source.id
                                                                    )
                                                                ] = source;
                                                            }
                                                        }
                                                    );

                                                    // decorate set with attributes
                                                    attributeSet.attributes = attributes;

                                                    resolve(attributeSet);
                                                    saveCache(
                                                        cacheId,
                                                        attributeSet
                                                    );
                                                })
                                                .catch((err) => {
                                                    reject(err);
                                                });
                                        })
                                        .catch((err) => {
                                            reject(err);
                                        });
                                }
                            },
                            (err) => {
                                reject(err);
                            }
                        )
                        .catch((err) => {
                            reject(err);
                        });
                });
        });
    };

    /**
     * Build layered navigation attributes data.
     * @param params
     * @param filterableAttributes
     * @param currentCategoryId
     * @param sellerIds
     * @returns {Promise}
     */
    esDataLoader.prototype.getLayeredNavigation = (
        params,
        filterableAttributes,
        currentCategoryId,
        sellerIds
    ) => {
        // for aggregations we need to enforce the current category if there are no categories from layered nav
        if (
            !_.isUndefined(currentCategoryId) &&
            !_.isUndefined(params.bool.must)
        ) {
            let hasCategoryFilter = false;
            for (let i = 0; i < params.bool.must.length; ++i) {
                if (
                    !_.isUndefined(params.bool.must[i].terms) &&
                    !_.isUndefined(
                        params.bool.must[i].terms[categoryIdsAttributeCode]
                    )
                ) {
                    hasCategoryFilter = true;
                }
            }

            if (!hasCategoryFilter) {
                const catFilter = { terms: {} };
                catFilter.terms[categoryIdsAttributeCode] = [currentCategoryId];
                params.bool.must.push(catFilter);
            }
        }

        return new Promise((resolve, reject) => {
            const query = self.getProductCollectionQuery(params);
            query.aggs = {};

            Object.keys(filterableAttributes).forEach((attributeKey) => {
                const attribute = filterableAttributes[attributeKey];
                if (_.isUndefined(attribute.options)) {
                    return;
                }
                const values = [];
                attribute.options.forEach((option) => {
                    values.push(option.value);
                });
                if (values.length > 0) {
                    query.aggs[attribute.attribute_code] = {
                        terms: {
                            field: attribute.attribute_code,
                            size: self.dataSettings.maxAggregationBucketSize,
                            include: values,
                        },
                    };
                }
            });

            // Push configured price ranges if any
            if (!_.isUndefined(self.dataSettings.product.priceRanges)) {
                query.aggs.price = {
                    range: {
                        field: priceAttributeCode,
                        ranges: self.dataSettings.product.priceRanges,
                    },
                };
            }

            // Push category ids aggregation
            query.aggs.category_ids = {
                terms: {
                    field: categoryIdsAttributeCode,
                    size: self.dataSettings.maxAggregationBucketSize,
                },
            };

            if (!_.isEmpty(sellerIds)) {
                query.aggs.seller_ids = {
                    terms: {
                        field: sellerIdsAttributeCode,
                        include: sellerIds,
                    }
                }
            }

            query.size = 0; // no need for actual documents to be retrieved

            if (!_.isEmpty(query.aggs)) {
                self.getProductCollectionAggregations(query).then(
                    (aggregations) => {
                        const results = self.combineLayeredNavigationData(
                            aggregations,
                            filterableAttributes,
                            currentCategoryId
                        );
                        resolve(results);
                    },
                    (err) => {
                        reject(err);
                    }
                );
            } else {
                resolve([]);
            }
        });
    };

    /**
     * Combine data in order to compute layered navigation's attributes and options.
     * @param aggregations
     * @param filterableAttributes
     * @param currentCategoryId
     * @returns {Array}
     */
    esDataLoader.prototype.combineLayeredNavigationData = (
        aggregations,
        filterableAttributes,
        currentCategoryId
    ) => {
        const results = [];
        let attribute = {};
        let currentCategory = {};
        let filter = false;

        Object.keys(aggregations).forEach((attributeCode) => {
            attribute = { ...filterableAttributes[attributeCode] };

            // "special" attributes
            if (attributeCode === priceAttributeCode) {
                attribute = self.dataSettings.product.priceAttributeData;
            } else if (attributeCode === categoryIdsAttributeCode) {
                attribute = self.dataSettings.product.categoryAttributeData;
            } else if (attributeCode === sellerIdsAttributeCode) {
                attribute = self.dataSettings.product.sellerAttributeData;
            } else if (!_.isUndefined(attribute)) {
                attribute["order"] += 10;
            } else {
                return;
            }

            attribute.filters = [];
            aggregations[attributeCode].buckets.forEach((bucket) => {
                // ES5.5 support and older versions (gravity...)
                if (_.isUndefined(bucket.key) && !_.isUndefined(bucket.term)) {
                    bucket.key = bucket.term;
                    delete bucket.term;
                }
                if (!_.isUndefined(bucket.count)) {
                    bucket.doc_count = bucket.count;
                }

                if (_.isUndefined(bucket.key)) {
                    return;
                }

                if (bucket.doc_count < 1) {
                    return;
                }

                // price / category_ids filter or regular option
                // @todo if there are any other "special" attributes, separate parsing logic
                if (attributeCode === priceAttributeCode) {
                    filter = {
                        value: bucket.key,
                        label: bucket.key,
                        slug:
                            "" +
                            parseInt(bucket.from) +
                            "_" +
                            parseInt(bucket.to),
                        count: bucket.doc_count,
                    };
                } else if (attributeCode === categoryIdsAttributeCode) {
                    if (!_.isUndefined(categoryData["catId" + bucket.key])) {
                        currentCategory = categoryData["catId" + bucket.key];
                        if (
                            !_.isUndefined(currentCategoryId) &&
                            parseInt(currentCategory.parent_id) !==
                                parseInt(currentCategoryId)
                        ) {
                            return;
                        }
                        filter = {
                            value: bucket.key,
                            label: currentCategory.name,
                            slug:
                                currentCategory.id +
                                "-" +
                                currentCategory.url_key,
                            count: bucket.doc_count,
                        };
                    }
                } else if (attributeCode === sellerIdsAttributeCode) {
                    if (!_.isUndefined(sellerData[bucket.key])) {
                        filter = {
                            value: bucket.key,
                            label: sellerData[bucket.key].name,
                            slug: `${bucket.key}-${sellerData[bucket.key].url_key}`,
                            count: bucket.doc_count
                        };
                    }
                } else if (!_.isUndefined(attribute.options)) {
                    attribute.options.forEach((option) => {
                        if (option.value.toString() === bucket.key.toString()) {
                            filter = option;
                            filter.count = bucket.doc_count;
                        }
                    });
                }

                if (filter) {
                    attribute.filters.push(filter);
                    filter = false;
                }
            });
            if (attribute.filters.length > 0) {
                Object.keys(attribute).forEach((key) => {
                    if (!defaultFields.filterEntity.includes(key)) {
                        delete attribute[key];
                    }
                });

                if (
                    attribute.filters.length > 1 &&
                    !self.dataSettings.product.layeredNavigation.sort_by_bucket_size.includes(
                        attribute.attribute_code
                    )
                ) {
                    let sortBy = "label";
                    let sortNumericLabel = true;
                    attribute.filters.some((item) => {
                        if (item.order > 0) {
                            sortNumericLabel = false;
                            sortBy = "order";
                            return true; // break the some() call
                        }
                        if (isNaN(item.label)) {
                            sortNumericLabel = false;
                            return true; // break the some() call
                        }
                    });

                    if (sortNumericLabel) {
                        // prevent sorting numeric values alphanumerically but numerical asc
                        attribute.filters = _.sortBy(
                            attribute.filters,
                            (item) => {
                                return parseFloat(item.label);
                            }
                        );
                    } else {
                        attribute.filters = _.sortBy(attribute.filters, sortBy);
                    }
                }
                results.push(attribute);
            }
        });

        return results;
    };

    /**
     * Get filterable attributes from various set ids.
     * @param setIds
     * @returns {Promise}
     */
    esDataLoader.prototype.getFilterableAttributes = (setIds) => {
        // push default attribute set id for products if needed
        if (
            self.dataSettings.product.defaultSetId &&
            _.isArray(setIds) &&
            !setIds.includes(self.dataSettings.product.defaultSetId)
        ) {
            setIds.push(self.dataSettings.product.defaultSetId);
        }

        const promises = setIds.map((setId) => {
            return new Promise((resolve) => {
                const attributes = {};
                // by getting the whole attribute set info, we increase cache hit-rate
                self.getAttributeSetById(setId).then(
                    (attributeSetInfo) => {
                        Object.keys(attributeSetInfo.attributes).forEach(
                            (attributeId) => {
                                const attribute =
                                    attributeSetInfo.attributes[attributeId];
                                if (
                                    attribute.is_filterable === 1 &&
                                    !_.isUndefined(attribute.slug)
                                ) {
                                    attributes[
                                        attribute.attribute_code
                                    ] = attribute;
                                }
                            }
                        );
                        resolve(attributes);
                    },
                    () => {
                        resolve({}); // we MUST reply with an empty object due to Promise.all
                    }
                );
            });
        });

        return Promise.all(promises);
    };

    /**
     * Get comparable attributes.
     * @param setId
     * @returns {Promise}
     */
    esDataLoader.prototype.getComparableAttributes = (setId) => {
        const self = this;
        return new Promise((resolve, reject) => {
            self.getAttributeSetById(setId).then((attributeSet) => {
                if (_.isEmpty(attributeSet)) {
                    reject("Unknown attribute set");
                    return;
                }

                const comparableAttributes = [];
                for (const i in attributeSet.attributes) {
                    const attribute = attributeSet.attributes[i];

                    if (attribute.is_comparable === 1) {
                        //attribute is not comparable and should not be added
                        comparableAttributes.push(attribute.attribute_code);
                    } else {
                        delete attributeSet.attributes[i];
                    }
                }
                resolve({
                    attributeSet: attributeSet,
                    comparableAttributes: comparableAttributes,
                });
            });
        });
    };

    /**
     * Get unique seller list from products.
     * @param productCollection
     * @returns {*}
     */
    esDataLoader.prototype.getProductCollectionSellerIds = (productCollection ) => {
        let sellerIds = [];
        if (!_.isEmpty(productCollection)) {
            for (let i = 0; i < productCollection.products.length; i++) {
                if (productCollection.products[i].seller_ids.length > 0) {
                    sellerIds.push(...productCollection.products[i].seller_ids);
                }
            }
            sellerIds = _.uniq(sellerIds);
        }

        return sellerIds;
    }

    /**
     * Get aggs from product index.
     * @param query
     * @returns {Promise}
     */
    esDataLoader.prototype.getProductCollectionAggregations = (query) => {
        delete query._source;
        delete query.from;
        query.size = 0;

        const queries = [];
        let filteredAttributes = [];
        const parsedAggregations = {};

        if (
            !_.isUndefined(query.query.bool.must) &&
            query.query.bool.must.length > 0
        ) {
            query.query.bool.must.forEach((item) => {
                if (!_.isUndefined(item.term)) {
                    filteredAttributes.push(Object.keys(item.term)[0]);
                }
                if (!_.isUndefined(item.terms)) {
                    filteredAttributes.push(Object.keys(item.terms)[0]);
                }
                if (!_.isUndefined(item.range)) {
                    filteredAttributes.push(Object.keys(item.range)[0]);
                }
            });
            filteredAttributes = _.difference(
                filteredAttributes,
                defaultCategoryFilters
            );
        }

        // default aggs - remove filtered attrs
        if (filteredAttributes.length > 0) {
            filteredAttributes.forEach((filteredAttribute) => {
                parsedAggregations[filteredAttribute] =
                    query.aggs[filteredAttribute];
                delete query.aggs[filteredAttribute];
            });
        }
        queries.push(self.getIndexSettings("product"));
        queries.push(query);

        // iterate over filtered attributes and remove the applied filter
        filteredAttributes.forEach((filteredAttribute) => {
            const attributeAggrQuery = JSON.parse(JSON.stringify(query));
            const length = query.query.bool.must.length;
            for (let i = 0; i < length; ++i) {
                let remove = false;
                const item = query.query.bool.must[i];

                ["term", "terms", "range"].forEach((condition) => {
                    if (remove === true) {
                        return;
                    }
                    if (!_.isUndefined(item[condition])) {
                        remove =
                            filteredAttribute ===
                            Object.keys(item[condition])[0];
                    }
                });

                if (remove) {
                    attributeAggrQuery.query.bool.must[i] = false;
                    attributeAggrQuery.query.bool.must = attributeAggrQuery.query.bool.must.filter(
                        (e) => {
                            return e;
                        }
                    );
                }
            }

            Object.keys(attributeAggrQuery.aggs).forEach(
                (aggregationAttribute) => {
                    if (aggregationAttribute !== filteredAttribute) {
                        delete attributeAggrQuery.aggs[aggregationAttribute];
                    }
                }
            );

            if (!_.isUndefined(parsedAggregations[filteredAttribute])) {
                attributeAggrQuery.aggs[filteredAttribute] =
                    parsedAggregations[filteredAttribute];
                queries.push(self.getIndexSettings("product"));
                queries.push(attributeAggrQuery);
            }
        });

        // es - msearch - one call for all prepared queries
        return new Promise((resolve, reject) => {
            self.configureWrapper("product");
            self.getDocuments(queries).then(
                (results) => {
                    let aggregations = {};
                    results.body.responses.forEach((response) => {
                        aggregations = _.extend(
                            aggregations,
                            response.aggregations
                        );
                    });
                    resolve(aggregations);
                },
                (err) => {
                    reject(err);
                }
            );
        });
    };

    /**
     * Get set ids from applied filters over a collection by aggregating attribute_set_ids values.
     * @param query
     * @returns {Promise}
     */
    esDataLoader.prototype.getProductCollectionSetIds = (query) => {
        delete query._source;
        delete query.from;
        query.size = 0;
        query.aggs = {
            attribute_set: {
                terms: {
                    field: "attribute_set_id",
                    size: self.dataSettings.maxAggregationBucketSize,
                },
            },
        };

        return new Promise((resolve) => {
            self.configureWrapper("product");
            self.getDocuments(query).then(
                (results) => {
                    const setIds = [];
                    results.body.aggregations.attribute_set.buckets.forEach(
                        (bucket) => {
                            setIds.push(parseInt(bucket.key));
                        }
                    );
                    resolve(setIds);
                },
                () => {
                    resolve([]);
                }
            );
        });
    };

    /**
     * Build query from params.
     * @param params
     * @param fields
     * @returns {*}
     */
    esDataLoader.prototype.getProductCollectionQuery = (params, fields) => {
        if (params.is_built === true) {
            return params;
        }

        // validate query size - maxPageSize should NOT exceed ES's window limit
        const query = {
            query: {},
            from: params.from || 0,
            size:
                !_.isUndefined(params.size) &&
                !_.isNaN(params.size) &&
                params.size <= self.dataSettings.product.maxPageSize
                    ? params.size
                    : self.dataSettings.product.maxPageSize,
        };

        if (fields && _.isArray(fields)) {
            query._source = fields; // otherwise uses _source
        }

        query.query.bool = { must: [] };
        for (let field of defaultFields.requiredProductSchema()) {
            query.query.bool.must.push({
                exists: {
                    field: field,
                },
            });
        }

        if (params.bool) {
            Object.keys(params.bool).forEach((keyName) => {
                // keyName: must, should, must_not

                params.bool[keyName].forEach((item) => {
                    if (!query.query.bool.hasOwnProperty(keyName)) {
                        query.query.bool[keyName] = [];
                    }
                    query.query.bool[keyName].push(item);
                });
            });
        }

        if (!_.isUndefined(params.sort)) {
            query.sort = params.sort;
        }

        // fail safe parameter in order to be able to override in precise cases the maxpagesize param
        // fixes AS-842
        if (!_.isUndefined(params.forcedSize)) {
            query.size = params.forcedSize;
        }

        return query;
    };

    /**
     * Get meta object with details on the current collection based on params.
     * @param params
     * @param totalItems
     * @param requestId
     * @returns {{}}
     */
    esDataLoader.prototype.getCollectionMeta = (
        params,
        totalItems,
        requestId
    ) => {
        const metaObject = {};
        const pageSize =
            !_.isUndefined(params.size) &&
            !_.isNaN(params.size) &&
            params.size <= self.dataSettings.product.maxPageSize
                ? params.size
                : self.dataSettings.product.maxPageSize;
        let currentPage = (params.page || 1) - 1;
        if (currentPage < 0) {
            currentPage = 0;
        }
        metaObject.items = totalItems;
        metaObject.size = pageSize;
        metaObject.page = currentPage + 1;
        metaObject.offset = pageSize * currentPage;
        if (!_.isUndefined(requestId)) {
            metaObject.requestId = requestId;
        }

        const sort = self.dataSettings.product.defaultSort;
        if (!_.isEmpty(params.sort) && !_.isArray(params.sort)) {
            // prevent multiple values on sorting
            sort.attributeCode = params.sort;
        }
        if (
            !_.isEmpty(params.dir) &&
            !_.isArray(params.dir) &&
            sortDirections.includes(params.dir)
        ) {
            sort.direction = params.dir;
        }
        metaObject.sort_direction = sort.direction;
        metaObject.sort_attribute = sort.attributeCode;

        return metaObject;
    };

    /**
     * Short helper for parsing a source of a returned document from ES.
     * @param document
     * @returns {*|{}}
     */
    esDataLoader.prototype.parseSource = (document) => {
        return document._source || {};
    };

    /**
     * Parse value pairs.
     * @param queryValue
     * @returns {{}}
     */
    esDataLoader.prototype.parseValuesPairs = (queryValue) => {
        const returnValue = {};
        const parts = queryValue.split(":");
        returnValue.key = parts[0];
        returnValue.value = !_.isUndefined(parts[1]) ? parts[1] : null;
        return returnValue;
    };

    /**
     * Get product collection constraints aka query parts for ES.
     * Supported:
     * - filter - attribute_slug:option_slug format
     * - filter price: price:min_max (eg. price:3000_3500)
     * - page - (int) - current page
     * - size - (int) - items per page
     * - sort - attribute_code:direction (asc/desc) (default direction is 'desc' if missing)
     * @param params
     * @param attributeValues
     * @param filtersField
     * @returns {*}
     */
    esDataLoader.prototype.getProductCollectionConstraints = (
        params,
        attributeValues,
        filtersField = "filter"
    ) => {
        const pageSize = params.size || self.dataSettings.product.maxPageSize;
        let currentPage = (params.page || 1) - 1;
        if (currentPage < 0) {
            currentPage = 0;
        }
        const from = pageSize * currentPage;

        const productCollectionConstraints = {
            size: params.size || self.dataSettings.product.maxPageSize,
            from,
            sort: [],
        };

        /**
         * Find in set.
         * @param slug
         * @returns {{attribute_code: *}}
         */
        const findAttributeBySlug = (slug) => {
            let attributeInfo = { attribute_code: slug };
            Object.keys(attributeValues).forEach((attributeCode) => {
                // slug OR attribute code actually
                if (
                    attributeValues[attributeCode].slug === slug ||
                    attributeValues[attributeCode].attribute_code === slug
                ) {
                    attributeInfo = attributeValues[attributeCode];
                }
            });
            return attributeInfo;
        };

        /**
         * Find in set.
         * @param value
         * @param options
         * @returns {*}
         */
        const findValueBySlug = (value, options) => {
            let valueBySlug = false;
            if (!_.isUndefined(options)) {
                options.forEach((option) => {
                    if (option.slug === value) {
                        valueBySlug = option.value;
                    }
                });
            }
            return valueBySlug;
        };

        const filters = { bool: { must: [] } };
        const categoryIds = [];
        let currentCategoryId = 0;
        const parsedParams = this.parseFilters(params, filtersField);

        Object.keys(parsedParams).forEach((paramName) => {
            const filter = {};
            const attribute = findAttributeBySlug(paramName);
            let values = parsedParams[paramName];

            if (
                attribute.attribute_code !==
                self.dataSettings.product.categoryAttributeData.slug
            ) {
                for (let i = 0; i < values.length; ++i) {
                    let value = findValueBySlug(values[i], attribute.options);
                    if (value !== false) {
                        values[i] = value;
                    } else if (isNaN(values[i])) {
                        delete values[i];
                    }
                }
            }

            values = values.filter((val) => {
                return val !== null;
            });

            if (values.length > 1) {
                filter[attribute.attribute_code] = values;
            } else if (values.length === 1) {
                filter[attribute.attribute_code] = values[0];
            } else {
                return;
            }

            // Magento logic min_max value under filter=price:min_max ...
            if (attribute.attribute_code === priceAttributeCode) {
                filters.bool.must.push({
                    range: {
                        price: {
                            gte: parseInt(filter[priceAttributeCode][0]),
                            lte: parseInt(filter[priceAttributeCode][1]),
                        },
                    },
                });
                return;
            }
            // combine category filtering logic (cat + category_ids)
            else if (
                attribute.attribute_code ===
                self.dataSettings.product.categoryAttributeData.slug
            ) {
                const appendCategoryInList = (slug) => {
                    let category = categoryData["slug" + slug];
                    if (_.isUndefined(category)) {
                        return;
                    }
                    categoryIds.push(category.id);
                };

                if (_.isArray(filter[attribute.attribute_code])) {
                    filter[attribute.attribute_code].forEach((slug) => {
                        appendCategoryInList(slug);
                    });
                } else {
                    appendCategoryInList(filter[attribute.attribute_code]);
                }
                return;
            } else if (attribute.attribute_code === categoryIdsAttributeCode) {
                currentCategoryId = parseInt(filter[attribute.attribute_code]);
                return;
            }

            if (_.isArray(filter[attribute.attribute_code])) {
                filters.bool.must.push({ terms: filter });
            } else {
                filters.bool.must.push({ term: filter });
            }
        });

        // Push filtering for category ids
        if (categoryIds.length === 0 && currentCategoryId !== 0) {
            categoryIds.push(currentCategoryId);
        }
        if (categoryIds.length > 0) {
            const filter = {};
            filter[categoryIdsAttributeCode] = categoryIds;
            filters.bool.must.push({ terms: filter });
        }

        // Min / Max price
        if (
            !_.isUndefined(params.min_price) ||
            !_.isUndefined(params.max_price)
        ) {
            const priceRange = {};

            if (!_.isUndefined(params.min_price)) {
                priceRange.gte = parseInt(params.min_price);
            }

            if (!_.isUndefined(params.max_price)) {
                priceRange.lte = parseInt(params.max_price);
            }

            filters.bool.must.push({
                range: {
                    price: priceRange,
                },
            });
        }

        //Sort parameters
        const sort = self.dataSettings.product.defaultSort;
        const enforcedSort = self.dataSettings.product.enforcedSort;
        const sortPhrase = {};

        // stock order
        // 1. display products with stock 1
        // 2. display products with stock 2
        // 3. display products with stock 3
        // 4. display products with stock 0 and pickup_is_in_stock 1
        // 5. display products with stock 0 and pickup_is_in_stock 0
        if (!_.isUndefined(params.stock_sort)) {
            sortPhrase._script = {
                type: "number",
                script: {
                    lang: "painless", //stock_status 0 becomes 99 just for sorting reasons
                    source:
                        'if (doc["stock_status"].value == 0 || doc["stock_status"].value == 4) { if (doc["pickup_is_in_stock"].value == 1) { return 98; } else { return 99; } } else { return 1; }',
                },
                order: "asc",
            };
        }

        // sort by attribute_code
        if (!_.isEmpty(params.sort) && !_.isArray(params.sort)) {
            // prevent multiple values on sorting
            sort.attributeCode = params.sort;
        }
        if (
            !_.isEmpty(params.dir) &&
            !_.isArray(params.dir) &&
            sortDirections.includes(params.dir)
        ) {
            sort.direction = params.dir;
        }

        sortPhrase[sort.attributeCode] = { order: sort.direction };

        // AMS-53 - add a 'stable' sort param
        if (_.isUndefined(sortPhrase[enforcedSort.attributeCode])) {
            sortPhrase[enforcedSort.attributeCode] = {
                order: enforcedSort.direction,
            };
        }

        productCollectionConstraints.sort.push(sortPhrase);

        return _.extend(productCollectionConstraints, filters);
    };

    /**
     * Parse query params / params bag based on our internal rules.
     * We're having the following form:
     * - filter=field:value1_value2 GET
     * - filter=field:value1&filter=field:value2 GET
     * @param params
     * @param filtersField
     * @returns {{}}
     */
    esDataLoader.prototype.parseFilters = (params, filtersField = "filter") => {
        const parsed = {};
        if (!_.isArray(params[filtersField])) {
            params[filtersField] = [params[filtersField]];
        }

        params[filtersField].forEach((item) => {
            const queryValue = this.parseValuesPairs(item);
            const key = queryValue.key;
            let values = !_.isNull(queryValue.value)
                ? queryValue.value.split("_")
                : [];

            // remove empty strings
            values = values.filter(value => value !== "");

            if (!values.length) {
                return;
            }

            if (_.isUndefined(parsed[key])) {
                parsed[key] = values;
            } else {
                parsed[key] = _.union(parsed[key], values);
            }
        });

        return parsed;
    };
}

const findInCollection = (collection, id) => {
    let result = false;
    collection.forEach((item) => {
        if (parseInt(item.id) === parseInt(id)) {
            result = item;
        }
    });
    return result;
};

const isDisabled = (product, productEnabledStatus = 1) => {
    product.is_eol = 0;
    if (product.status !== productEnabledStatus) {
        if (product.eol_status === 0) {
            return true;
        } else if (product.eol_status === 1) {
            product.is_eol = 1;
        }
    }

    return false;
};

export default esDataLoader;
