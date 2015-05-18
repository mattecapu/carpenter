/*!
	DELETE requests handler
*/

import squel from 'squel';

import jsonError from './jsonError.js';
import {filterBy, addFilters, selectBy} from './queryBuilder.js';

export default function (request, body, context) {
	squel.useFlavour('mysql');

	let query;
	if (request.main.relationship === undefined) {
		if (request.main.ids.length === 0) {
			throw new jsonError({
				title: 'Deletion is too much broad',
				details: 'You\'re attempting to DELETE an entire resource collection, for safety reason this is not allowed',
				code: 500
			});
		}
		query = filterBy(
			squel.remove()
				.from(context.resources[request.main.type].sql_table),
			request.main,
			context
		);
	} else if (request.main.relationship.to === 'many') {
		request.main.superset.fields = [context.resources[request.main.superset.type].primary_key];
		query =
			squel.remove()
				.from(request.main.relationship.sql_table)
				.where(
					request.main.relationship.from_key + ' IN ?',
					selectBy({main: request.main.superset}, context)
				).where(
					request.main.relationship.to_key + ' IN ?',
					// apply the filters expressed in the request to the related resource
					addFilters(
						request.main,
						squel.select()
							.from(context.resources[request.main.type].sql_table)
							.field(context.resources[request.main.type].primary_key),
						context
					)
				);
	} else {
		throw new jsonError({
			title: 'Wrong method',
			details: 'Can\'t DELETE a to-one relationship',
			status: 405
		});
	}

	return context.callQuery(query).then(([stats]) => {
		return {
			response: {},
			status: (stats.affectedRows ? 204 : 404)
		}
	});
}
