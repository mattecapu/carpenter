/*!
	POST requests handler
*/

import typs from 'typs';
import squel from 'squel';
import Promise from 'bluebird';

import jsonError from './jsonError.js';
import {selectBy} from './queryBuilder.js';

export default function (request, body, context) {
	squel.useFlavour('mysql');

	// utility method
	const arrayfy = (x) => [].concat(x);
	const root_key = request.main.relationship ? request.main.relationship.name : request.main.type;
	// query
	let insertion_query;
	let rows_to_insert = 0;

	let related_rows = [];

	// you can send a single object or multiple object as an array
	// so let's normalize single objects to a single-element array
	body[root_key] = arrayfy(body[root_key]);

	const type_error = (attribute) => new jsonError({
		title: 'Type error',
		details: 'The value of the attribute \'' + attribute + '\' does not typecheck',
		status: 422
	});

	if (request.main.relationship === undefined) {
		// check cardinality
		if (request.main.ids.length > 0) {
			throw new jsonError({
				title: 'Wrong method',
				details: 'POST adds resources to a collection, to replace a resource use PUT',
				status: 405
			});
		}

		// short-hand
		const new_res_info = context.resources[request.main.type];

		const rel_typecheck = (attribute, res, array = false) => {
			const rel_info = context.resources[new_res_info.relationships[attribute].type];
			const rel_pk = rel_info.primary_key;
			const typecheck = (val) => typs(val).is(rel_info.attributes[rel_pk].domain);
			// support both <rel_name>:<value>
			let value =
				arrayfy(res[attribute]).map((val) => {
					if (!typecheck(val)) {
						// or <rel_name>:{<pk>:<value>}
						val = val[rel_pk];
						// but maybe is just the wrong type
						if (!typecheck(val)) {
							throw type_error(attribute);
						}
					}
					return val;
				});
			if (!array) value = value[0];
			return value;
		};

		let res_rows = [];

		body[root_key].forEach((new_resource, index) => {
			let row_values = {};
			let this_related_rows = [];

			Object.keys(new_resource).forEach((attribute) => {
				// 'attribute' is an attribute of 'new_resource'
				if (new_res_info.attributes[attribute] !== undefined) {
					if (typs(new_resource[attribute]).is(new_res_info.attributes[attribute].domain)) {
						row_values[new_res_info.columns[attribute]] = new_resource[attribute];
					} else {
						throw type_error(attribute);
					}
				// 'attribute' is an internal relationship of 'new_resource'
				} else if (new_res_info.columns[attribute] !== undefined) {
					// support both <rel_name>:<value>
					row_values[new_res_info.columns[attribute]] = rel_typecheck(attribute, new_resource);
				// 'attribute' is an external relationship of 'new_resource'
				} else if (new_res_info.relationships[attribute] !== undefined) {
					// we must craft a separate query for this
					// constraint: related resources MUST be already inserted

					const rel_info = new_res_info.relationships[attribute];

					// setting a to-one relationship to multiple values? gross!
					if (Array.isArray(new_resource[attribute]) && rel_info.to === 'one') {
						throw new jsonError({
							title: 'Unmet cardinality constraint',
							details: 'Trying to assign multiple values to the to-one relationship \'' + attribute + '\'',
							status: 422
						});
					}

					// typecheck & "parse" the values (and add support for <pk>:<value> arrays)
					rel_typecheck(attribute, new_resource, true).forEach((value) => {
						this_related_rows.push({
							info: rel_info,
							value,
							res_index: index
						})
					});
				} else {
					// trying to POST gibberish: not polite, man
					throw new jsonError({
						title: 'Unknown attribute',
						details: '\'' + attribute + '\' is not an attribute of a \'' + request.main.type + '\' resource',
						status: 422
					});
				}
			});
			res_rows.push(row_values);
			related_rows = related_rows.concat(this_related_rows);
		});

		insertion_query = squel.insert().into(new_res_info.sql_table).setFieldsRows(res_rows);
		rows_to_insert = res_rows.length;

	} else if (request.main.relationship.to === 'many') {

		//short hand
		const new_rel_info = request.main.relationship;
		const to_key = context.resources[new_rel_info.type].primary_key;
		let rel_rows = [];

		body[root_key].forEach((new_relationship) => {

			let row_values = {};

			if ((row_values[to_key] = new_relationship[to_key]) === undefined) {
				throw new jsonError({
					title: 'Primary key needed',
					details: 'The primary key of the related resources is required',
					status: 422
				});
			}
			Object.keys(new_relationship).forEach((attribute) => {
				if (new_rel_info.attributes[attribute] !== undefined) {
					row_values[new_rel_info.attributes[attribute].sql_column] = new_relationship[attribute];
				} else if (attribute !== to_key) {
					throw new jsonError({
						title: 'Unknown attribute',
						details: '\'' + attribute + '\' is not an attribute of the \'' + new_rel_info.name + '\' relationship',
						status: 422
					});
				}
			});
			rel_rows.push(row_values);
		});

		if (!rel_rows.every(x => Object.keys(x).length === Object.keys(rel_rows[0]).length)) {
			throw new jsonError({
				title: 'Malformed request',
				details: 'All the objects to insert must have the same fields',
				status: 422
			});
		}

		// columns to add
		const new_rels_attributes =
			Object.keys(rel_rows[0])
				.filter(x => x !== to_key)
				.map(x => new_rel_info.attributes[x].sql_column);

		// rel attributes + from_key + to_key
		const fields = new_rels_attributes.concat([new_rel_info.from_key, new_rel_info.to_key]);

		new_rels_attributes.push(to_key);

		// get the IDs of the 'from' resource
		request.main.superset.fields = [context.resources[request.main.superset.type].primary_key];
		let from_key_subquery = selectBy({main: request.main.superset}, context);
		const mock_table_alias = 'mock$' + new_rel_info.name;

		// while the 'from' IDs are fetched froma query, the only way (I found)
		// to put in the other values is by making a long UNION of SELECT <val>
		// and making it a new table on the SELECT query which fetches the IDs
		let all_values = [];
		rel_rows.forEach((row) => {
			let row_values = [];
			new_rels_attributes.forEach((column) => {
				row_values.push(row[column] + ' AS mock$' + column);
			});
			all_values.push('SELECT ' + row_values.join(', '));
		});

		new_rels_attributes.forEach((column) => {
			from_key_subquery =	from_key_subquery.field(mock_table_alias + '.mock$' + column);
		});
		from_key_subquery =
			from_key_subquery.from(
				'(' + all_values.join(' UNION ') + ')',
				mock_table_alias
			);

		// this is an INSERT INTO ... SELECT query
		insertion_query = squel.insert().into(new_rel_info.sql_table).fromQuery(fields, from_key_subquery);
		rows_to_insert = rel_rows.length;

	} else {
		throw new jsonError({
			title: 'Wrong method',
			details: 'Can\'t POST a to-one relationship, use PUT instead',
			status: 405
		});
	}

	let first_inserted_id = 0;
	let inserted_resources = 0;

	const insertion_error = new jsonError({
		title: 'Insertion failed',
		details: 'Can\'t insert ' + (rows_to_insert - inserted_resources) + ' resources in the database',
		status: 500
	});

	// executes the main query
	return context.callQuery('START TRANSACTION')
		.then(() => context.callQuery(insertion_query))
		.then(([stats]) => {
			first_inserted_id = stats.insertId;
			inserted_resources = stats.affectedRows;

			if (inserted_resources < rows_to_insert) {
				throw insertion_error;
			}

			if (related_rows.length === 0) return;

			// the queries we are going to make
			const queries =
				related_rows
					.map(({info, value, res_index}) => {
						return squel.insert().into(info.sql_table).setFields({
							[info.from_key]: first_inserted_id + res_index,
							[info.to_key]: value
						});
					})
					// execute the queries
					.map(x => context.callQuery(x));

			return Promise.all(queries)
				.then((statses) => {
					if (statses.reduce((sum, x) => x.affectedRows + sum, 0) < queries.length) {
						throw insertion_error;
					}
				});
		})
		.then(() => context.callQuery('COMMIT'))
		.then(() => {
			if (request.main.relationship === undefined) {
				const url_ids = [];
				for (let i = inserted_resources; i--;) url_ids.push(i + first_inserted_id);
				return {
					location: request.main.type + '/' + url_ids.join(','),
					status: 200
				};
			} else {
				return {
					location: '',
					status: 200
				}
			}
		})
		.catch((error) => {
			context.callQuery('ROLLBACK').thenThrow(error);
		});
}
