import { get } from "lodash";

const defaultVisibility = [2, 3, 4];

const loadBrandAttribute = async (esData) => {
    esData.configureWrapper("attribute");
    const res = await esData.getDocument("attribute_code", "brand");
    return esData.getSingleResult(res);
};

const getOptionFromList = (options, brandName) =>
    options.filter((item) => item.label === brandName).pop();

const loadBrands = async (
    esData,
    protectedAttributeSets = [1],
    visibility = defaultVisibility
) => {
    const items = [];
    try {
        const brandAttribute = await loadBrandAttribute(esData);
        esData.configureWrapper("product");
        const res = await esData.getDocuments({
            query: {
                bool: {
                    must: [{ term: { status: 1 } }, { terms: { visibility } }],
                    must_not: [
                        { terms: { attribute_set_id: protectedAttributeSets } },
                    ],
                },
            },
            aggs: {
                brands: { terms: { field: "brand_name.keyword", size: 4096 } },
            },
            size: 0,
        });

        if (get(res, "body.aggregations.brands")) {
            const brandsAgg = { ...res.body.aggregations.brands };
            brandsAgg.buckets.forEach((bucket) => {
                const option = getOptionFromList(
                    brandAttribute.options,
                    bucket.key
                );
                if (!option) {
                    return;
                }
                items.push({
                    id: option.value,
                    name: option.label,
                    count: bucket.doc_count,
                    slug: option.slug,
                });
            });
        }
    } catch (err) {
        // sentry?
        console.error(err);
    }

    return items;
};

const loadBrandDetails = async (
    esData,
    slug,
    visibility = defaultVisibility,
    minLevel = 3
) => {
    const brands = esData.getBrandsData().filter((item) => item.slug === slug);

    if (brands.length) {
        const brand = { ...brands.pop() };
        brand.categories = [];

        try {
            esData.configureWrapper("product");
            const res = await esData.getDocuments({
                query: {
                    bool: {
                        must: [
                            { term: { status: 1 } },
                            { terms: { visibility } },
                            {
                                term: {
                                    "brand_name.keyword": brand.name.toUpperCase(),
                                },
                            },
                        ],
                    },
                },
                aggs: {
                    categories: {
                        terms: { field: "category_ids", size: 256 },
                    },
                },
                size: 0,
            });
            const categoryIds = [];
            if (get(res, "body.aggregations.categories")) {
                const catsAgg = { ...res.body.aggregations.categories };
                catsAgg.buckets.forEach((bucket) => {
                    categoryIds.push(bucket.key);
                });
            }
            if (categoryIds.length) {
                for (const catId of categoryIds) {
                    const category = esData.getCategoryData()[`catId${catId}`];
                    if (
                        category &&
                        category.level >= minLevel &&
                        category.display_mode !== "PAGE" &&
                        category.include_in_menu === 1 // skip "brand" categories
                    ) {
                        brand.categories.push({
                            name: category.name,
                            url_key: category.url_key,
                            count: await countProducts(
                                esData,
                                category.id,
                                brand.name.toUpperCase()
                            ),
                            level: category.level,
                            id: category.id,
                        });
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }

        return brand;
    } else {
        return false;
    }
};

const countProducts = async (
    esData,
    categoryId,
    brandName,
    visibility = defaultVisibility
) => {
    esData.configureWrapper("product");
    const res = await esData.getDocuments({
        query: {
            bool: {
                must: [
                    { term: { status: 1 } },
                    { terms: { visibility } },
                    {
                        term: {
                            "brand_name.keyword": brandName.toUpperCase(),
                        },
                    },
                    {
                        term: {
                            category_ids: categoryId,
                        },
                    },
                ],
            },
        },
        size: 0,
    });
    return get(res, "body.hits.total.value", 0);
};

export default {
    loadBrands,
    loadBrandDetails,
};
