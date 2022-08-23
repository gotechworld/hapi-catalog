"use strict";

import SellersHelper from "../helpers/sellers";
import Boom from "@hapi/boom";
import Joi from '@hapi/joi';
import _ from "lodash";

export default {
    getSellerCategories: {
        handler: async (request) => {
            const esDataLoader = request.server.plugins.catalog.esData;
            const { id } = request.params;
            let { product_status, product_visibility } = request.query;
            const { category_min_level,category_max_level } = request.query;
            
            if(!_.isUndefined(product_status) && !_.isArray(product_status)){
                product_status = [product_status];
            }
            if(!_.isUndefined(product_visibility) && !_.isArray(product_visibility)){
                product_visibility = [product_visibility];
            }

            const sellerCategories = await SellersHelper.loadSellerCategories(
                esDataLoader,
                request.params.id,
                product_status,
                product_visibility,
                category_min_level,
                category_max_level
            );

            if (_.isEmpty(sellerCategories)) {
                return Boom.notFound();
            }
            
            return sellerCategories;
        },
        description: "GET seller categories with products count by seller id",
        notes: "Returns seller associated categories with products count",
        tags: ["api"],
        validate: {
            params: {
                id: Joi.number().required().label("Seller ID")
            },
            query: {
                product_status: Joi.alternatives([Joi.string(), Joi.array()]).optional().label("Product status"),
                product_visibility: Joi.alternatives([Joi.string(), Joi.array()]).optional().label("Product visibility"),
                category_min_level: Joi.number().optional().label("Min category level"),
                category_max_level: Joi.number().optional().label("Max category level")
            }
        },
    },
};
