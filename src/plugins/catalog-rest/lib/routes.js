'use strict';

import SchemaCtrl from './handlers/schema';
import CategoryCtrl from './handlers/category';
import AttributeCtrl from './handlers/attribute';
import AttributeSetsCtrl from './handlers/attributeSets';
import AttributeGroupsCtrl from './handlers/attributeGroups';
import ProductCtrl from './handlers/product';

module.exports = [
    {
        method: 'POST',
        path: '/schema/indices',
        config: SchemaCtrl.createIndex
    },
    {
        method: 'GET',
        path: '/schema/indices',
        config: SchemaCtrl.listIndices
    },
    {
        method: 'POST',
        path: '/schema/aliases',
        config: SchemaCtrl.createAlias
    },
    {
        method: 'GET',
        path: '/schema/aliases',
        config: SchemaCtrl.listAliases
    },
    {
        method: 'GET',
        path: '/categories/{id}/{index?}',
        config: CategoryCtrl.get
    },
    {
        method: 'GET',
        path: '/categories/getBulk/{index?}',
        config: CategoryCtrl.getByFilters
    },
    {
        method: 'POST',
        path: '/categories',
        config: CategoryCtrl.create
    },
    {
        method: 'PUT',
        path: '/categories/{id}',
        config: CategoryCtrl.update
    },
    {
        method: 'DELETE',
        path: '/categories/{id}/{index?}',
        config: CategoryCtrl.delete
    },
    {
        method: ['POST', 'PUT', 'DELETE'],
        path: '/categories/bulk/{index?}',
        config: CategoryCtrl.bulk
    },
    {
        method: 'GET',
        path: '/categories/ids/{index?}',
        config: CategoryCtrl.getIds
    },
    {
        method: 'GET',
        path: '/attributes/{id}/{index?}',
        config: AttributeCtrl.get
    },
    {
        method: 'POST',
        path: '/attributes',
        config: AttributeCtrl.create
    },
    {
        method: 'PUT',
        path: '/attributes/{id}',
        config: AttributeCtrl.update
    },
    {
        method: 'DELETE',
        path: '/attributes/{id}/{index?}',
        config: AttributeCtrl.delete
    },
    {
        method: ['POST', 'PUT', 'DELETE'],
        path: '/attributes/bulk/{index?}',
        config: AttributeCtrl.bulk
    },
    {
        method: 'GET',
        path: '/attributesSets/{id}/{index?}',
        config: AttributeSetsCtrl.get
    },
    {
        method: 'POST',
        path: '/attributesSets',
        config: AttributeSetsCtrl.create
    },
    {
        method: 'PUT',
        path: '/attributesSets/{id}',
        config: AttributeSetsCtrl.update
    },
    {
        method: 'DELETE',
        path: '/attributesSets/{id}/{index?}',
        config: AttributeSetsCtrl.delete
    },
    {
        method: ['POST', 'PUT', 'DELETE'],
        path: '/attributesSets/bulk/{index?}',
        config: AttributeSetsCtrl.bulk
    },
    {
        method: 'GET',
        path: '/attributesGroups/{id}/{index?}',
        config: AttributeGroupsCtrl.get
    },
    {
        method: 'POST',
        path: '/attributesGroups',
        config: AttributeGroupsCtrl.create
    },
    {
        method: 'PUT',
        path: '/attributesGroups/{id}',
        config: AttributeGroupsCtrl.update
    },
    {
        method: 'DELETE',
        path: '/attributesGroups/{id}/{index?}',
        config: AttributeGroupsCtrl.delete
    },
    {
        method: ['POST', 'PUT', 'DELETE'],
        path: '/attributesGroups/bulk/{index?}',
        config: AttributeGroupsCtrl.bulk
    },
    {
        method: 'GET',
        path: '/products/{id}/{index?}',
        config: ProductCtrl.get
    },
    {
        method: 'GET',
        path: '/products/getBulk/{index?}',
        config: ProductCtrl.getByFilters
    },
    {
        method: 'GET',
        path: '/products/ids/{index?}',
        config: ProductCtrl.getProductIds
    },
    {
        method: 'POST',
        path: '/products',
        config: ProductCtrl.create
    },
    {
        method: 'PUT',
        path: '/products/{id}',
        config: ProductCtrl.update
    },
    {
        method: 'DELETE',
        path: '/products/{id}/{index?}',
        config: ProductCtrl.delete
    },
    {
        method: ['POST', 'PUT', 'DELETE'],
        path: '/products/bulk', // non-rest - google inspired on naming
        config: ProductCtrl.bulk
    },
    {
        method: 'DELETE',
        path: '/products/fields', // non-rest - google inspired on naming
        config: ProductCtrl.removeField
    }
];
