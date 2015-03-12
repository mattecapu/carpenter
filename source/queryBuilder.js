/*!
	Adds a SQL filter to a query based on
	the resource_request object information
*/


var typs = require('typs');
var squel = require('squel');

// adds WHERE clause to a query
var filterBy = function (query, request, context) {
	
	let resource = context.resources[request.type];
	
	if (typs(request.superset).def().check()) {
		// set fields to select as the relationship field
		request.superset.fields = [request.relationship.name];

		query = query.where(
			resource.primary_key + 'IN ?',
			selectBy({main: request.superset}, context)
		);
	}
	
	if (typs(request.ids).def().check() && request.ids[0] !== 'any') {
		query = query.where(resource.sql_table + '.' + resource.primary_key + ' IN ?', request.ids);
	}
	
	request.filters.forEach(({field, values}) => {
		query = query.where(resource.sql_table + '.' + resource.columns[field] + ' IN ?', values);
	});

	request.sorters.forEach(({field, asc}) => {
		query = query.order(resource.sql_table + '.' + resource.columns[field], asc);
	});

	return query;
};

var selectBy = function (request, context) {
	
	// alias columns to exposed field names
	let addFields = (query, req, prefix) => {
		return req.fields.reduce((q, field) => q.field(prefix + '.' + context.resources[req.type].columns[field], prefix + '_' + field), query);
	};
	
	// base query
	let query = squel.select().from(context.resources[request.main.type].sql_table, request.main.type);
	
	// related resources
	if (typs(request.related).def().check()) {
		
		// craft the prefix for deep relationships
		let ancestors = (rel) => {
			if (typs(rel.superset).def().check() && typs(rel.superset.relationship).def().check()) {
				return ancestors(rel.superset).concat(rel.superset.relationship.name);
			} else {
				return [rel.relationship.sql_table];
			}
		};
		
		// let's dig down the tree of relationships
		// and extract the correct joins to do
		// moreover, we rearrange them to respect order of conditions
		let joins = [];
		let stack = [].concat(request.related);
		
		while(stack.length) {
			let rel = stack.pop();
			let ancs = ancestors(rel);
			
			joins.unshift([
				// table
				context.resources[rel.relationship.type].sql_table,
				// alias
				ancs.concat(rel.relationship.name).join('_'),
				// join condition
				ancs.join('_') + '.' + rel.relationship.from_key +
				'=' +
				ancs.concat(rel.relationship.name).join('_') + '.' + rel.relationship.to_key
			]);

			if (typs(rel.superset).def().check() && typs(rel.superset.relationship).def().check()) {
				stack.push(rel.superset);
			}
		}
		
		// add joins
		query = joins.reduce((q, j) => q.join.apply(q, j), query);
		
		// add fields
		query = request.related.reduce((q, rel) => {
			return addFields(query, rel, ancestors(rel).concat(rel.relationship.name).join('_'));
		}, query);
	}

	// add main resource fields
	query = addFields(filterBy(query, request.main, context), request.main, context.resources[request.main.type].sql_table);

	require('eyes').inspect(query.toString());
	
	return query.limit(3);
};

module.exports = {filterBy, selectBy};
