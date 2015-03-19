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
		query =	query.where(
			// the primary key of the request resource
			request.type + '.' + context.resources[request.type].primary_key + ' IN ?',
			// is in the values returned by the relationship
			squel.select()
				.from(request.relationship.sql_table)
				.field(request.relationship.to_key)
				// filter from the superset
				.where(
					request.relationship.from_key + ' IN ?',
					filterBy(
						squel.select()
							.from(context.resources[request.superset.type].sql_table)
							.field(context.resources[request.superset.type].primary_key),
						request.superset,
						context
					)
				)
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
		return req.fields.reduce((q, field) => q.field(prefix + '.' + context.resources[req.type].columns[field], prefix + '$' + field), query);
	};

	// base query
	let query = squel.select();
	let base_alias = request.main.type;

	query = query.from(context.resources[request.main.type].sql_table, base_alias);

	// related resources
	if (typs(request.related).def().check()) {

		// craft the prefix for deep relationships
		let ancestors = (rel) => {
			if (typs(rel).equals(request.main).check()) {
				return base_alias;
			} else if (typs(rel.superset).def().check()) {
				// chain the name of the relationships
				return ancestors(rel.superset).concat(rel.superset.relationship.name);
			}
			return [request.main.type];//[rel.relationship.type];
		};

		// dig down the tree of relationships
		// and extract the correct joins to do
		// moreover, rearrange them to respect order of conditions
		let buildJoin = (rel, query) => {
			// prefix the names with their relationship path
			let makeAlias = (r) => ancestors(r).concat(r.relationship.name).join('$');

			// if the relationship is deep, we have to build it to the top
			if (typs(rel.superset).def().check()) {
				query = buildJoin(rel.superset, query);
			}

			let rel_alias = makeAlias(rel);
			let rel_info_alias = rel_alias + '$info';
			let rel_superset = rel.superset || request.main;
			let rel_superset_alias = typs(rel.superset).def().check() ? makeAlias(rel.superset) : base_alias;

			// table where is stored the related resource
			query = query.join(
				context.resources[rel.relationship.type].sql_table,
				rel_alias
			);
			// table where is stored the relationship
			query = query.join(
				rel.relationship.sql_table,
				rel_info_alias,
				rel_alias + '.' + context.resources[rel.relationship.type].primary_key +
				' = ' +
				rel_info_alias + '.' + rel.relationship.to_key +
				' AND ' +
				rel_info_alias + '.' + rel.relationship.from_key +
				' = ' +
				rel_superset_alias + '.' + context.resources[rel_superset.type].primary_key
			);

			return query;
		};

		request.related.forEach((rel) => {
			// set the fields to fetch
			query = addFields(
				// build then add the joins
				buildJoin(rel, query),
				rel,
				ancestors(rel).concat(rel.relationship.name).join('$')
			);
		});
	}

	// add main resource fields
	query = addFields(filterBy(query, request.main, context), request.main, base_alias);

	return query;
};

module.exports = {filterBy, selectBy};
