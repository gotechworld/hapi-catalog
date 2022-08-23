"use strict";

import Hoek from "@hapi/hoek";
import Routes from "./routes";
import EsData from "./data/esData";
import TransformerData from "./data/transformer";

const internals = {
    defaults: {
        config: {
            product: {
                index: "catalog_products",
            },
            category: {
                index: "catalog_categories",
            },
            attributes: {
                index: "catalog_attributes",
            },
            attributes_sets: {
                index: "catalog_attributes_sets",
            },
            attributes_groups: {
                index: "catalog_attributes_groups",
            },
            sellers: {
                index: "sellers",
            },
            specialFilters: [
                "filter_promotion",
                "filtru_noutati",
                "filtru_precomanda",
                "filtru_stoc",
                "on_demand",
                "is_package",
                "filter_resealed",
            ],
            enginey: {
                url: "http://10.8.2.9/catalog/v1/search",
                defaultSort: "relevance",
                defaultSortDirection: "desc",
                defaultPageSize: 48,
                store: "altex",
                websiteId: "1",
                version: "1.0.0",
                defaultFilters: {
                    visibility: [2, 4],
                    status: 1,
                },
            },
            transformer: {
                media: {
                    category: "media/catalog/category/",
                    product: "media/catalog/product",
                    label: "media/image",
                },
                booleanOptions: {
                    yes: "Da",
                    no: "Nu",
                },
            },
            data: {
                cache: {
                    ttl: 86400000,
                },
                category: {
                    maxCategories: 5000,
                    maxChildren: 100,
                    cmsBlockSubcategoryListId: 4,
                    default_category_id: 2,
                    max_promoted_children: 9,
                },
                product: {
                    maxPageSize: 96,
                    defaultSetId: 4,
                    defaultCategoryFilters: {
                        visibility: [2, 4],
                        status: 1,
                    },
                    view: {
                        unsetKeys: [
                            "price",
                            "regular_price",
                            "stock_status",
                            "filter_resealed",
                            "seller_ids",
                        ],
                    },
                    defaultSort: {
                        attributeCode: "best_buy",
                        direction: "desc",
                    },
                    enforcedSort: {
                        attributeCode: "price",
                        direction: "desc",
                    },
                    priceAttributeData: {
                        label: "Pret",
                        attribute_code: "price",
                        order: 0,
                        slug: "price",
                    },
                    categoryAttributeData: {
                        label: "Categorie",
                        attribute_code: "category_ids",
                        order: 11,
                        slug: "cat",
                    },
                    sellerAttributeData: {
                        label: "Vendor",
                        attribute_code : "seller_ids",
                        order: 12,
                        slug: "seller-ids",
                    },
                    brands: {
                        disallowedAttributeSetIds: [9, 158, 176],
                    },
                    layeredNavigation: {
                        sort_by_bucket_size: ["brand", "price", "cat", "seller_ids"],
                    },
                    priceRanges: [
                        {
                            from: 0,
                            to: 50,
                        },
                        {
                            from: 50,
                            to: 100,
                        },
                        {
                            from: 100,
                            to: 200,
                        },
                        {
                            from: 200,
                            to: 500,
                        },
                        {
                            from: 500,
                            to: 1000,
                        },
                        {
                            from: 1000,
                            to: 1500,
                        },
                        {
                            from: 1500,
                            to: 2000,
                        },
                        {
                            from: 2000,
                            to: 3000,
                        },
                        {
                            from: 3000,
                            to: 4000,
                        },
                        {
                            from: 4000,
                            to: 5000,
                        },
                        {
                            from: 5000,
                            to: 999999,
                        },
                    ],
                    compare: {
                        max_items: 5,
                        protected_attributes: ["product_links"],
                        exclude_fields_from_immutable_attributes: ["brand"]
                    },
                },
                maxAggregationBucketSize: 300,
            },
        },
    },
};

exports.plugin = {
    register: async (server, options) => {
        const settings = Hoek.applyToDefaults(
            internals.defaults.config,
            options
        );
        server.decorate("server", "catalogGlobalSettings", settings);

        // expose different 'sub-plugins' - with no dependencies
        server.expose(
            "dataTransformer",
            new TransformerData(settings.transformer)
        );

        // special plugins with other dependencies - server gets exposed
        server.expose(
            "esData",
            new EsData(
                server,
                {
                    product: settings.product,
                    category: settings.category,
                    set: settings.attributes_sets,
                    group: settings.attributes_groups,
                    attribute: settings.attributes,
                    seller: settings.sellers,
                },
                settings.cache,
                settings.data
            )
        );

        // init reusable data
        server.plugins.catalog.esData.initDataCache();

        // load routes
        server.route(Routes);
    },
    pkg: require("../package.json"),
};
