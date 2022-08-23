"use strict";

import _ from "lodash";

const categoryTreeItemFields = [
    "name",
    "url_key",
    "include_in_menu",
    "id",
    "subcategories",
    "promoted_children",
    "thumbnail",
];

module.exports = {
    /**
     * constructCategoriesTree
     *
     * @param categories
     * @param transformer
     * @param searchForKey
     * @param defaultCategory
     * @param maxPromotedChildren
     *
     * @returns {Array}
     */
    constructCategoriesTree(
        categories,
        transformer,
        searchForKey,
        defaultCategory,
        maxPromotedChildren
    ) {
        let toReturn = [];

        for (const currentKey in categories.tree) {
            if (
                parseInt(currentKey) === searchForKey &&
                !_.isUndefined(categories.tree[currentKey]) &&
                !_.isEmpty(categories.tree[currentKey])
            ) {
                for (const id of categories.tree[currentKey]) {
                    if (!_.isUndefined(categories["catId" + id])) {
                        const category = _.clone(categories["catId" + id]);

                        if (
                            !_.isUndefined(categories["catId" + id].is_promoted)
                        ) {
                            category.is_promoted =
                                categories["catId" + id].is_promoted;
                        } else {
                            category.is_promoted = 0;
                        }
                        const subcategories = this.constructCategoriesTree(
                            categories,
                            transformer,
                            id,
                            defaultCategory,
                            maxPromotedChildren
                        );
                        if (subcategories.length) {
                            category.subcategories = subcategories;
                        }

                        // ECOMDEV-2214 - reactivate SEO description for categories
                        // delete category.description;
                        // delete category.description_editor_object;
                        toReturn.push(category);
                    }
                }
            }
        }

        toReturn = this.count(
            toReturn,
            defaultCategory,
            maxPromotedChildren,
            []
        );

        return customSort(toReturn);
    },
    /**
     * count
     *
     * @param categories
     * @param defaultCategory
     * @param maxPromotedChildren
     * @param promoted_children
     *
     * @returns {*}
     */
    count(categories, defaultCategory, maxPromotedChildren, promoted_children) {
        for (const category of categories) {
            if (defaultCategory === null) {
                //defaultCategory === null (keeps first level of categories to be promoted child)

                const toAdd = _.clone(category);
                delete toAdd.subcategories;

                promoted_children.push(toAdd);
            }
            if (!_.isUndefined(category.subcategories)) {
                this.count(
                    category.subcategories,
                    null,
                    maxPromotedChildren,
                    promoted_children
                );
            }

            if (
                defaultCategory !== null &&
                parseInt(category.parent_id) === defaultCategory
            ) {
                promoted_children = promoted_children.sort((a, b) => {
                    //sort by level

                    return a.level - b.level;
                });

                promoted_children = promoted_children.sort((a, b) => {
                    //sort by promoted categories

                    if (a.is_promoted === 0 && b.is_promoted === 0) {
                        //both categories are not promoted so we keep level sorting
                        return;
                    }
                    return b.is_promoted - a.is_promoted;
                });
                category.promoted_children = promoted_children.slice(
                    0,
                    maxPromotedChildren
                );
                promoted_children = [];
            }
        }

        return categories;
    },
    /**
     * appendSpecialFilters
     *
     * @param layeredNavigation
     * @param specialFilters
     *
     * @returns {*}
     */
    appendSpecialFilters(layeredNavigation, specialFilters) {
        const toReturn = [];
        const generalFilters = {
            label: "General",
            attribute_code: "general",
            order: -1,
            slug: "general",
            hasAttributeSlug: true,
            filters: [],
        };

        for (const i in layeredNavigation) {
            if (specialFilters.includes(layeredNavigation[i].attribute_code)) {
                for (const definedFilter of layeredNavigation[i].filters) {
                    if (definedFilter.value === 0) {
                        continue;
                    }
                    definedFilter.label = layeredNavigation[i].label;
                    definedFilter.attributeSlug = layeredNavigation[i].slug;
                    definedFilter.order = layeredNavigation[i].order;

                    generalFilters.filters.push(definedFilter);
                }
            } else {
                toReturn.push(layeredNavigation[i]);
            }
        }
        if (generalFilters.filters.length > 0) {
            generalFilters.filters.sort((a, b) => {
                return a.order - b.order;
            });
            toReturn.push(generalFilters);
        }

        return toReturn;
    },
    /**
     * We need to clear the category tree from several keys which are not used anywhere.
     *
     * @param {object} tree
     */
    clearTreeForNavigation(tree) {
        for (const mainCategory of tree) {
            clearCategory(mainCategory, false);
        }
        return tree;
    },
};

/**
 * sort
 *
 * @param entries
 *
 * @returns {Array}
 */
const customSort = function (entries) {
    entries.sort((a, b) => {
        return a.position - b.position;
    });
    return entries;
};

const clearCategory = (category, aggressive = true) => {
    // keep only allowed fields
    Object.keys(category).forEach((key) => {
        if (!categoryTreeItemFields.includes(key)) {
            delete category[key];
        }
    });
    // lol very aggresive
    if (aggressive === true) {
        delete category.thumbnail;
    }
    if (category.subcategories && category.subcategories.length) {
        for (const subcategory of category.subcategories) {
            clearCategory(subcategory);
        }
    }
    if (category.promoted_children && category.promoted_children.length) {
        for (const promotedCategory of category.promoted_children) {
            clearCategory(promotedCategory, false);
        }
    }
};
