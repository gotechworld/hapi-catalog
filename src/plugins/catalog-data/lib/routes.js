"use strict";

import ProductCtrl from "./handlers/product";
import CategoryCtrl from "./handlers/category";
import SearchCtrl from "./handlers/search";
import BrandsCtrl from "./handlers/brand";
import SellersCtrl from "./handlers/seller";

export default [
    // products
    {
        method: "GET",
        path: "/product/list",
        config: ProductCtrl.list,
    },
    {
        method: "GET",
        path: "/product/{key}/{value}",
        config: ProductCtrl.view,
    },
    {
        method: "GET",
        path: "/product/compare",
        config: ProductCtrl.compare,
    },
    {
        method: "GET",
        path: "/product/compare/status",
        config: ProductCtrl.compareStatus,
    },
    // categories
    {
        method: "GET",
        path: "/category/{key}/{value}",
        config: CategoryCtrl.view,
    },
    {
        method: "GET",
        path: "/categoryTree",
        config: CategoryCtrl.tree,
    },
    // search
    {
        method: "GET",
        path: "/search/{term}",
        config: SearchCtrl.enginey,
    },
    // brands
    {
        method: "GET",
        path: "/brands",
        config: BrandsCtrl.list,
    },
    {
        method: "GET",
        path: "/brands/{slug}",
        config: BrandsCtrl.view,
    },
    // sellers
    {
        method: "GET",
        path: "/sellers/{id}/categories",
        config: SellersCtrl.getSellerCategories,
    },
];
