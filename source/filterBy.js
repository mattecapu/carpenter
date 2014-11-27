/*!
	Adds a SQL filter to main_query based on
	the resource_request object information
*/

var squel = require('squel');

var filterBy = function(main_query, resource_request, context) {
	// there's a problem with squel handling table aliases
	// in DELETE statements, so until they fix it we'll do like this
	if (main_query instanceof squel.cls.Select) {
		main_query = main_query.from(context.resources[resource_request.resource].sql_table, resource_request.resource);
	} else {
		main_query = main_query.from(context.resources[resource_request.resource].sql_table);
	}

	main_query = resource_request.filters.reduce((query, {field, values}) => {
		return query.where(context.resources[resource_request.resource].structure[field].sql_column + ' IN ?', values);
	}, main_query);

	if(resource_request.superset) {
		resource_request.superset.request.fields = [resource_request.superset.foreign.field];
		main_query = main_query.where(
			context.resources[resource_request.resource].keys.primary + ' IN ?',
			filterBy(squel.select(), resource_request.superset.request, context)
		);
	}

	main_query = resource_request.sorters.reduce((query, {field, asc}) => {
		return query.order(context.resources[resource_request.resource].structure[field].sql_column, asc);
	}, main_query);

	return main_query;
};

module.exports = filterBy;
