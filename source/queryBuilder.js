/*!
	Adds a SQL filter to a query based on
	the resource_request object information
*/


var squel = require('squel');


var filterBy = function (query, resource_request, context) {
	resource_request.filters.forEach(({field, values}, i) => {
		query = query.where(context.resources[resource_request.resource].structure[field].sql_column + ' IN ?', values);
	});

	if(resource_request.superset) {
		resource_request.superset.request.fields = [resource_request.superset.foreign.field];

		query = query.where(
			context.resources[resource_request.resource].keys.primary + ' IN ?',
			filterBy(selectBy(resource_request.superset.request, context), resource_request.superset.request, context)
		);
	}

	resource_request.sorters.forEach(({field, asc}, i) => {
		query = query.order(context.resources[resource_request.resource].structure[field].sql_column, asc);
	});

	return query;
};

var selectBy = function (resource_request, context) {
	var query = filterBy(squel.select().from(context.resources[resource_request.resource].sql_table, resource_request.resource), resource_request, context);

	resource_request.fields.forEach((field) => {
		query = query.field(context.resources[resource_request.resource].structure[field].sql_column, field);
	});

	return query;
};

module.exports = {filterBy, selectBy};
