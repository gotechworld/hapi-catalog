import { get } from "lodash";

const categoryIncludeInNavigationMenu = 1;
const productDefaultStatus = [1];
const productDefaultVisibility = [2, 3, 4];

/**
 * Category tree with products count
 * 
 * @param {*} esData 
 * @param {number} sellerId 
 * @param {array} status
 * @param {array} visibility 
 * @param {number} minLevel 
 * @param {number} maxLevel
 * @returns {array} category tree with products count
 */
const loadSellerCategories = async (
    esData,
    sellerId,
    status = productDefaultStatus,
    visibility = productDefaultVisibility,
    minLevel = 2,
    maxLevel = 4
) => {
    const categories = [];

    try {
        esData.configureWrapper("product");
        const res = await esData.getDocuments({
            query: {
                bool: {
                    must: [
                        { terms: { status } },
                        { terms: { visibility } },
                        {
                            term: {
                                seller_ids: sellerId,
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
        const categoryProductsCount = {};
        if (get(res, "body.aggregations.categories")) {
            const catsAgg = { ...res.body.aggregations.categories };
            catsAgg.buckets.forEach((bucket) => {
                categoryIds.push(bucket.key);
                categoryProductsCount[bucket.key] = bucket.doc_count;
            });
        }

        if (categoryIds.length) {
            // Load categories from ES
            const categoriesData = esData.getCategoryData();

            for (const catId of categoryIds) {
                const category = categoriesData[`catId${catId}`];
                if (
                    category &&
                    category.level >= minLevel &&
                    category.level <= maxLevel &&
                    category.include_in_menu === categoryIncludeInNavigationMenu // only include categories with include_in_menu = YES
                ) {
                    categories.push({
                        id: category.id,
                        parent_id: category.level === minLevel ? null : category.parent_id, // top level categories have no parent
                        name: category.name,
                        url_key: category.url_key,
                        level: category.level,
                        product_count: categoryProductsCount[catId], // add products count
                    });
                }
            }
        }
    } catch (err) {
        console.error(err);
    }

    return buildCategoryTree(categories);
};

/**
 * Returns top level categories
 * 
 * @param {array} categories 
 * @returns {array}
 */
const topLevelCategories = (categories) => {
    return categories.filter(node => !node.parent_id);
}

/**
 * Returns subcategories of a category
 * 
 * @param {array} categories 
 * @param {number} parentId 
 * @returns 
 */
const traverseCategories = (categories, parentId) => {
    const children = categories.filter(category => category.parent_id === parentId);
    children.forEach(category => {
        category.subcategories = traverseCategories(categories, category.id);
    });

    return children;
}

/**
 * Returns category tree
 * 
 * @param {array} categories 
 * @returns 
 */
const buildCategoryTree = (categories) => {
    return topLevelCategories(categories).map(category => {
        category.subcategories = traverseCategories(categories, category.id);

        return category;
    });
}

export default {
    loadSellerCategories,
};
