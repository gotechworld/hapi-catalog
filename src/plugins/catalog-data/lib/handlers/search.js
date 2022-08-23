"use strict";

import Boom from "@hapi/boom";
import _ from "lodash";
import Validation from "../validate/search";
import GeneralHelper from "../helpers/general";
import { getSearchResults, getHydratedResponse } from "../data/enginey";

export default {
    enginey: {
        handler: async request => {
            const transformer = request.server.plugins.catalog.dataTransformer;
            const esData = request.server.plugins.catalog.esData;
            const settings = request.server.catalogGlobalSettings;

            try {
                const apiResponse = await getSearchResults(
                    request.params.term,
                    request.query.cookie_id || "catalog-api",
                    settings.enginey
                );
                if (apiResponse.count > 0 || apiResponse.suggestedPages.length > 0) {
                    const hydratedResponse = await getHydratedResponse(
                        apiResponse,
                        request.params.term,
                        request.query,
                        esData,
                        settings.enginey
                    );
                    if (!_.isUndefined(hydratedResponse.products)) {
                        hydratedResponse.products = hydratedResponse.products.map(
                            item =>
                                transformer.transformProductSimpleSchema(item)
                        );
                    }
                    if (!_.isUndefined(hydratedResponse.layeredNavigation)) {
                        hydratedResponse.layeredNavigation = GeneralHelper.appendSpecialFilters(
                            hydratedResponse.layeredNavigation,
                            request.server.catalogGlobalSettings.specialFilters
                        );
                    }

                    return hydratedResponse;
                } else {
                    return {
                        term: request.params.term,
                        meta: {
                            items: 0,
                            size: 48,
                            page: 1,
                            offset: 0,
                            sort_direction: "asc",
                            sort_attribute: "relevance",
                            requestId: apiResponse.requestId
                        },
                        products: [],
                        layeredNavigation: [],
                        suggestedPages: [],
                    };
                }
            } catch (err) {
                // @todo inject logger and log error message
                return Boom.badRequest("Cautarea nu a putut fi executata");
            }
        },
        description: "GET search results",
        notes: "Returns a list of matching products by a search term",
        tags: ["api"],
        validate: Validation.searchActionActionValidation,
        response: {
            schema: Validation.responseSearchActionValidation,
            options: {
                allowUnknown: true
            }
        }
    }
};
