"use strict";

import BrandsHelper from "../helpers/brands";
import Boom from "@hapi/boom";

export default {
    list: {
        handler: async (request) => {
            const esDataLoader = request.server.plugins.catalog.esData;
            return esDataLoader.getBrandsData();
        },
        description: "GET brands list",
        notes: "Returns a list of aggregated brands",
        tags: ["api"],
    },
    view: {
        handler: async (request) => {
            const esDataLoader = request.server.plugins.catalog.esData;
            const brand = await BrandsHelper.loadBrandDetails(
                esDataLoader,
                request.params.slug
            );
            if (brand) {
                return brand;
            } else {
                return Boom.notFound();
            }
        },
        description: "GET brand details by slug",
        notes: "Returns brand details and associated categories",
        tags: ["api"],
    },
};
