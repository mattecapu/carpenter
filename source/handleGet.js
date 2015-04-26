/*!
	GET requests handler
*/

import squel from 'squel';
import Promise from 'bluebird';
import typs from 'typs';

import {filterBy, selectBy} from './queryBuilder.js';
import mergeResults from './handleGet.mergeResults.js';
import normalizeResponse from './handleGet.normalizeResponse.js';
import unserializeKey from './queryBuilder.unserializeKey.js';

export default function (request, body, context) {
	squel.useFlavour('mysql');

	let query = selectBy(request, context);

	return context.callQuery(query).then(([results]) => {

		let response = {};
		const status = results.length > 0 ? 200 : 404;

		let structured_results = [];
		results.forEach((res, i) => {
			structured_results.push({});
			Object.keys(res).forEach((key) => {
				unserializeKey(res, structured_results[structured_results.length - 1], key);
			})
		});

		// merges duplicated (JOINs artefact)
		response[request.main.type] = mergeResults(structured_results, request, context);
		// if a single object was requested, return it as an object and not as a collection
		response = normalizeResponse(request.main, response);

		return {response, status};
	});
};
