"use strict";

import Joi from "@hapi/joi";
import CategoryValidation from "./category";
import VariousValidation from "./various";

module.exports = {
    /**
     * Validation of view product action used by product handler.
     */
    searchActionActionValidation: {
        params: {
            term: Joi.string()
                .required()
                .description("Search term")
        },
        query: {
            filter: Joi.alternatives([Joi.string(), Joi.array()])
                .optional()
                .description(
                    "Collection of applied filters: attribute:val1_val2"
                ),
            min_price: Joi.number()
                .min(0)
                .optional()
                .description("Min price value"),
            max_price: Joi.number()
                .positive()
                .optional()
                .description("Max price value"),
            size: Joi.number()
                .positive()
                .optional()
                .description("Items per page"),
            page: Joi.number()
                .positive()
                .optional()
                .default(1)
                .description("Current page"),
            user_id: Joi.alternatives([
                Joi.string(),
                Joi.number().positive()
            ]).description("User id - gravity context"),
            cookie_id: Joi.string()
                .optional()
                .description("Customer session id - EngineY context"),
            sort: Joi.string()
                .optional()
                .default("relevance")
                .valid(["relevance", "price", "name", "best_deal", "best_buy"])
                .description("Sort attribute"),
            dir: Joi.string()
                .optional()
                .default("asc")
                .valid(["asc", "desc"])
                .description("Sort direction"),
            force_include_products: Joi.bool()
                .optional()
                .default(false)
                .description("Force include products"),
        }
    },
    responseSearchActionValidation: Joi.object()
        .label("Search")
        .keys({
            term: Joi.string()
                .required()
                .min(3),
            meta: VariousValidation.meta,
            products: CategoryValidation.productListValidation,
            layeredNavigation: CategoryValidation.layeredNavigationValidation
        })
};
