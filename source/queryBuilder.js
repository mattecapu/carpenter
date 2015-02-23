/*!
	Adds a SQL filter to a query based on
	the resource_request object information
*/


var squel = require('squel');

// adds WHERE clause to a query
var filterBy = function (query, resource_request, context) {
	resource_request.filters.forEach(({field, values}, i) => {
		query = query.where(context.resources[resource_request.type].columns[field] + ' IN ?', values);
	});

	if(resource_request.superset) {
		// set fields to select as the relationship field
		resource_request.superset.request.fields = [resource_request.superset.relationship.name];

		query = query.where(
			'id IN ?',
			filterBy(selectBy(resource_request.superset.request, context), resource_request.superset.request, context)
		);
	}

	resource_request.sorters.forEach(({field, asc}, i) => {
		query = query.order(context.resources[resource_request.type].columns[field], asc);
	});

	return query;
};

var selectBy = function (resource_request, context) {
	var query = filterBy(squel.select().from(context.resources[resource_request.type].sql_table, resource_request.type), resource_request, context);

	// alias columns to exposed field names
	resource_request.fields.forEach((field) => {
		query = query.field(context.resources[resource_request.type].columns[field], field);
	});

	return query;
};

module.exports = {filterBy, selectBy};
