/*!
	POST requests handler
*/

import typs from 'typs';
import squel from 'squel';
import Promise from 'bluebird';

import jsonError from './jsonError.js';

export default function (request, body, context) {
	squel.useFlavour('mysql');

	// utility method
	const arrayfy = (x) => [].concat(x);
	// short-hand
	const new_res_info = context.resources[request.main.type];

	// can't POST a resource to a to-one relationship
	if (request.main.relationship && request.main.relationship.to === 'one') {
		throw new jsonError({
			title: 'Wrong method',
			details: 'Can\'t POST a to-one relationship, use PUT instead',
			status: 405
		});
	// can't POST a resource to a single resource end-point
	} else if (request.main.ids[0] !== 'any') {
		throw new jsonError({
			title: 'Wrong method',
			details: 'POST adds resources to a collection, to replace a resource use PUT',
			status: 405
		});
	}

	// you can send a single object or multiple object as an array
	// so let's normalize single objects to a single-element array
	body[request.main.type] = arrayfy(body[request.main.type]);

	const type_error = (attribute) => new jsonError({
		title: 'Type error',
		details: 'The value of the attribute \'' + attribute + '\' does not typecheck',
		status: 422
	});

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

	let main_rows = [];
	let relationships_rows = [];

	body[request.main.type].forEach((new_resource, index) => {
		let fields = {};
		let this_relationships_rows = [];

		Object.keys(new_resource).forEach((attribute) => {
			// 'attribute' is an attribute of 'new_resource'
			if (new_res_info.attributes[attribute] !== undefined) {
				if (typs(new_resource[attribute]).is(new_res_info.attributes[attribute].domain)) {
					fields[new_res_info.columns[attribute]] = new_resource[attribute];
				} else {
					throw type_error(attribute);
				}
			// 'attribute' is an internal relationship of 'new_resource'
			} else if (new_res_info.columns[attribute] !== undefined) {
				// support both <rel_name>:<value>
				fields[new_res_info.columns[attribute]] = rel_typecheck(attribute, new_resource);
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
					this_relationships_rows.push({
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
		main_rows.push(fields);
		relationships_rows = relationships_rows.concat(this_relationships_rows);
	});

	const main_query = squel.insert().into(new_res_info.sql_table).setFieldsRows(main_rows);

	let first_inserted_id = 0;
	let inserted_resources = 0;

	const insertion_error = new jsonError({
		title: 'Insertion failed',
		details: 'Can\'t insert ' + (main_rows.length - inserted_resources) + ' resources in the database',
		status: 500
	});

	// executes the main query
	return context.callQuery('START TRANSACTION')
		.then(() => context.callQuery(main_query))
		.then(([stats]) => {
			first_inserted_id = stats.insertId;
			inserted_resources = stats.affectedRows;

			if (inserted_resources < main_rows.length) {
				throw insertion_error;
			}

			if (relationships_rows.length === 0) return;

			// the queries we are going to make
			const queries =
				relationships_rows
					.map(({info, value, res_index}) => {
						return squel.insert().into(info.sql_table).setFields({
							[info.from_key]: first_inserted_id + res_index,
							[info.to_key]: value
						});
					})
					.map(x => {console.log(x.toString()); return x})
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
			const url_ids = [];
			for (let i = inserted_resources; i--;) url_ids.push(i + first_inserted_id);
			return {
				location: request.main.type + '/' + url_ids.join(','),
				status: 200
			};
		})
		.catch((error) => {
			context.callQuery('ROLLBACK').thenThrow(error);
		});
}
