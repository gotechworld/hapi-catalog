"use strict";

import Boom from "@hapi/boom";
import Validation from "../validate/category";
import _ from "lodash";
import GeneralHelper from "../helpers/general";

export default {
    /**
     * View category handler.
     */
    view: {
        handler: async (request, h) => {
            const esDataLoader = request.server.plugins.catalog.esData;
            const transformer = request.server.plugins.catalog.dataTransformer;
            try {
                let category = await esDataLoader.getCategory(
                    request.params.key,
                    request.params.value,
                    request.query
                );

                if (!category) {
                    return Boom.notFound();
                } else {
                    category = transformer.transformCategorySimpleSchema(
                        category
                    );
                    if (!_.isUndefined(category.subcategories)) {
                        for (
                            let i = 0;
                            i < category.subcategories.length;
                            ++i
                        ) {
                            category.subcategories[
                                i
                            ] = transformer.transformCategorySimpleSchema(
                                category.subcategories[i]
                            );
                        }
                    }

                    if (!_.isUndefined(category.products)) {
                        for (let i = 0; i < category.products.length; ++i) {
                            category.products[
                                i
                            ] = transformer.transformProductSimpleSchema(
                                category.products[i]
                            );
                        }
                    }

                    if (!_.isUndefined(category.layeredNavigation)) {
                        category.layeredNavigation = GeneralHelper.appendSpecialFilters(
                            category.layeredNavigation,
                            request.server.catalogGlobalSettings.specialFilters
                        );

                        //sort filters by order
                        category.layeredNavigation.sort((a, b) => {
                            return a.order - b.order;
                        });
                    }

                    return category;
                }
            } catch (err) {
                return Boom.internal(err.toString() || "Internal error");
            }
        },
        description: "GET category",
        notes: "Returns a category and it's children products / categories",
        tags: ["api"],
        validate: Validation.viewActionValidation,
        response: {
            schema: Validation.getValidationSchema("simple"),
            options: {
                allowUnknown: true
            }
        }
    },
    /**
     * Tree category handler.
     */
    tree: {
        handler: async (request, h) => {
            const esDataLoader = request.server.plugins.catalog.esData;
            const categories = esDataLoader.getCategoryData();
            const transformer = request.server.plugins.catalog.dataTransformer;

            try {
                const defaultCategoryId =
                    request.server.catalogGlobalSettings.data.category
                        .default_category_id;
                const maxPromotedChildren =
                    request.server.catalogGlobalSettings.data.category
                        .max_promoted_children;

                const tree = GeneralHelper.constructCategoriesTree(
                    categories,
                    transformer,
                    defaultCategoryId,
                    defaultCategoryId,
                    maxPromotedChildren
                );

                return GeneralHelper.clearTreeForNavigation(tree);
            } catch (err) {
                return Boom.internal(err.toString() || "Internal error");
            }
        },
        description: "GET category tree",
        notes: "Returns a category and it's children category tree",
        tags: ["api"]
    }
};
