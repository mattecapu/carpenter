/*!
	Adds a SQL filter to a query based on
	the resource_request object information
*/

import typs from 'typs';
import squel from 'squel';

// adds WHERE clause to a query
export function filterBy(query, request, context) {

	const resource = context.resources[request.type];

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
}

export function selectBy (request, context) {
	// alias columns to exposed field names
	const addFields = (query, req, prefix) => {
		return req.fields.reduce((q, field) => q.field(prefix + '.' + context.resources[req.type].columns[field], prefix + '$' + field), query);
	};

	const base_alias = request.main.type;
	// base query
	let query = squel.select();

	query = query.from(context.resources[request.main.type].sql_table, base_alias);

	// related resources
	if (typs(request.related).def().check()) {

		// prefix the names with their relationship path
		const makeAlias = (r) => {
			// get all the nesting tree
			const ancestors = (rel) => {
				if (typs(rel).equals(request.main).check()) {
					return base_alias;
				} else if (typs(rel.superset).def().check()) {
					// chain the name of the relationships
					return ancestors(rel.superset).concat(rel.superset.relationship.name);
				}
				return [request.main.type];
			};
			return ancestors(r).concat(r.relationship.name).join('$');
		};

		// keep track of the joined tables
		let joined = [];

		// dig down the tree of relationships
		// and extract the correct joins to do
		// moreover, rearrange them to respect order of conditions
		const buildJoin = (rel, query) => {
			// if the relationship is deep, we have to build it to the top
			if (typs(rel.superset).def().check()) {
				query = buildJoin(rel.superset, query);
			}

			const rel_alias = makeAlias(rel);
			const rel_info_alias = rel_alias + '$info';
			const rel_superset = rel.superset || request.main;
			const rel_superset_alias = typs(rel.superset).def().check() ? makeAlias(rel.superset) : base_alias;

			if (typs(rel_alias).oneOf(joined).doesntCheck()) {
				// table where is stored the related resource
				query = query.join(
					context.resources[rel.relationship.type].sql_table,
					rel_alias
				);
				joined.push(rel_alias);
			}
			if (typs(rel_info_alias).oneOf(joined).doesntCheck()) {
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
				joined.push(rel_info_alias);
			}

			return query;
		};

		const add_joins_fields = (rels) => {
			rels.forEach((rel) => {
				// set the fields to fetch
				query = addFields(
					// build then add the joins
					buildJoin(rel, query),
					rel,
					makeAlias(rel)
				);
			});
		};

		// add IDs for "implicit", related resources
		// inbetween directly related resources and deep related resources
		// (that's because when building a GET response, we need
		// intermediate resources ids to correctly parse joined relationships)
		let implicits = [];
		// if rel is a directly related resource, skip it,
		// otherwise we add it to the implicits collection
		const add_rel = (rel) => {
			if (rel === undefined) return;
			if (!rel.directly_requested) {
				rel.fields = [context.resources[rel.type].primary_key];
				implicits.push(rel);
			}
			add_rel(rel.superset);
		};
		request.related.forEach(add_rel);

		// add all the joins and the fields to the query
		add_joins_fields(request.related);
		add_joins_fields(implicits);
	}

	// add main resource fields
	query = addFields(filterBy(query, request.main, context), request.main, base_alias);

	return query;
}
