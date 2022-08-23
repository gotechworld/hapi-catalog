"use strict";

import _ from "lodash";
import Request from "request";
import { getValidationSchema } from "../validate/product";

const applySortBySkuList = (params, skus) => {
    params.sort = [
        {
            _script: {
                type: "number",
                script: {
                    inline: "params.skus.indexOf(doc['sku'].value)",
                    params: {
                        skus
                    }
                },
                order: "asc"
            }
        }
    ];
};

const filterCategories = (esData, layeredNavigation) => {
    const allowedCategories = Object.keys(
        esData.getCategoryData()["tree"]
    ).map(cat => parseInt(cat));
    layeredNavigation.map(filter => {
        if (filter.attribute_code === "category_ids") {
            const categoryIds = filter.filters.map(cat => parseInt(cat.value));
            const diff = _.difference(categoryIds, allowedCategories);
            filter.filters = filter.filters.filter(
                f => diff.indexOf(parseInt(f.value)) !== -1
            );
        }
        return filter;
    });
};

export const getSearchResults = (searchTerm, sessionId, settings) => {
    return new Promise((resolve, reject) => {
        Request.post(
            {
                url: settings.url,
                body: {
                    websiteId: settings.websiteId,
                    term: searchTerm,
                    type: "ids"
                },
                json: true,
                headers: {
                    "X-Enginey-Session-Id": sessionId || "catalog-api"
                }
            },
            async (error, response, body) => {
                if (error || response.statusCode !== 200) {
                    reject({ error, code: response.statusCode });
                    return;
                }
                resolve({
                    skus: body.search.ids.map(item => item.id),
                    suggestedPages: body.search.suggestedPages,
                    count: body.search.count,
                    accuracy: body.search.accuracy,
                    requestId: body.search.requestId,
                    maxScore: body.search.maxScore
                });
            }
        );
    });
};

export const getHydratedResponse = async (
    apiResponse,
    searchTerm,
    queryParams,
    esData,
    settings
) => {
    const result = {
        term: searchTerm,
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
        suggestedPages: []
    };

    if (!_.isEmpty(apiResponse.suggestedPages)) {
        let foundSuggestedPage = false;
        _.forEach(apiResponse.suggestedPages, function(suggestedPage) {
            if (suggestedPage.autoRedirect && !foundSuggestedPage) {
                result.suggestedPages.push(suggestedPage);
                foundSuggestedPage = true;
            }
        });

        if (!_.isEmpty(result.suggestedPages) && !queryParams.force_include_products) {
            return result;
        }
    }

    const collectionParams = JSON.parse(JSON.stringify(queryParams));
    const defaultSort = collectionParams.sort === settings.defaultSort;
    const productSkus = _.compact(apiResponse.skus);

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

    // push various filters for current product selection
    collectionParams.filter.push(
        "visibility:" + settings.defaultFilters.visibility.join("_")
    );
    collectionParams.filter.push("status:" + settings.defaultFilters.status);
    collectionParams.filter.push("sku:" + productSkus.join("_"));

    // sort function by sku / sort by
    if (collectionParams.sort === "relevance") {
        collectionParams.sort = {};
    }

    const filterableAttributes = {};
    const activeFilters = esData.parseFilters(collectionParams);
    let attrsBySet = [];
    if (!_.isUndefined(activeFilters.cat)) {
        const setIdsQuery = {
            query: {
                bool: {
                    must: [
                        {
                            terms: {
                                sku: productSkus
                            }
                        }
                    ]
                }
            }
        };

        const setIdsList = await esData.getProductCollectionSetIds(setIdsQuery);
        attrsBySet = await esData.getFilterableAttributes(setIdsList);
    } else {
        attrsBySet = await esData.getFilterableAttributes([
            esData.dataSettings.product.defaultSetId
        ]);
    }

    for (const itemsList of attrsBySet) {
        _.extend(filterableAttributes, itemsList);
    }

    const params = esData.getProductCollectionConstraints(
        collectionParams,
        filterableAttributes
    );

    // keep sort based on EngineY relevance score
    if (defaultSort) {
        applySortBySkuList(params, productSkus);
    }

    params.bool.must.push({
        terms: { sku: productSkus }
    });

    const collection = await esData.getProductCollection(
        params,
        Object.keys(getValidationSchema("simple"))
    );
    result.products = collection.products;
    const sellerIds = esData.getProductCollectionSellerIds(result);

    //layered navigation
    if (result.products.length > 0) {
        result.layeredNavigation = await esData.getLayeredNavigation(
            params,
            filterableAttributes,
            undefined,
            sellerIds
        );

        filterCategories(esData, result.layeredNavigation);
    }

    //pagination and meta
    result.meta = esData.getCollectionMeta(
        queryParams,
        collection.total,
        apiResponse.requestId
    );

    return result;
};
