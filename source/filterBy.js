/*!
	Adds a SQL filter to a query based on
	the resource_request object information
*/


var squel = require('squel');


var filterBy = function (query, resource_request, context) {
	// there's a problem with squel handling table aliases
	// in DELETE statements, so until they fix it we'll do like this
	if (query instanceof squel.cls.Select) {
		query = query.from(context.resources[resource_request.resource].sql_table, resource_request.resource);
	} else {
		query = query.from(context.resources[resource_request.resource].sql_table);
	}

	resource_request.filters.forEach(({field, values}, i) => {
		query = query.where(context.resources[resource_request.resource].structure[field].sql_column + ' IN ?', values);
	});

	if(resource_request.superset) {
		resource_request.superset.request.fields = [resource_request.superset.foreign.field];

		var where_query = squel.select();

		resource_request.superset.request.fields.forEach((field) => {
			where_query = where_query.field(context.resources[resource_request.superset.request.resource].structure[field].sql_column, field);
		});

		query = query.where(
			context.resources[resource_request.resource].keys.primary + ' IN ?',
			filterBy(where_query, resource_request.superset.request, context)
		);
	}

	resource_request.sorters.forEach(({field, asc}, i) => {
		query = query.order(context.resources[resource_request.resource].structure[field].sql_column, asc);
	});

	return query;
};

module.exports = filterBy;
