/*!
	DELETE requests handler
*/

import squel from 'squel';
import Promise from 'bluebird';

import {filterBy} from './queryBuilder.js';

export default function (request, body, context) {
	squel.useFlavour('mysql');

	return context.callQuery(
		filterBy(
			squel.remove().from(context.resources[request.main.type].sql_table),
			request.main,
			context
		)
	).spread((stats) => {
		return {
			response: {},
			status: (stats.affectedRows ? 204 : 404)
		}
	});
}
