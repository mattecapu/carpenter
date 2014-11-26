/*!
	Adds a SQL filter to main_query based on
	the resource_request object information
*/

var squel = require('squel');

var filterBy = function(main_query, resource_request, context) {
	main_query = main_query.from(context.resources[resource_request.resource].sql_table, resource_request.resource);

	main_query = resource_request.fields.reduce((query, field) => {
		return query.field(context.resources[resource_request.resource].structure[field].sql_column, field);
	}, main_query);
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
