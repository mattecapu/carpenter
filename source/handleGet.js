/*!
	GET requests handler
*/

import squel from 'squel';

import {selectBy} from './queryBuilder.js';
import structureResults from './handleGet.structureResults.js';
import normalizeResponse from './handleGet.normalizeResponse.js';
import unserializeKey from './queryBuilder.unserializeKey.js';

export default function (request, body, context) {
	squel.useFlavour('mysql');

	const query = selectBy(request, context);

	return context.callQuery(query).then(([results]) => {
		let response = {};
		const status = results.length > 0 ? 200 : 404;
		const root_key = request.main.relationship ? request.main.relationship.name : request.main.type;

		let unserializedResults = [];
		results.forEach((res, i) => {
			unserializedResults.push({});
			Object.keys(res).forEach((key) => {
				unserializeKey(res, unserializedResults[unserializedResults.length - 1], key);
			})
		});

		// merges duplicates and structures the response (removes JOINs artefacts)
		response[root_key] = structureResults(unserializedResults, request, context);
		// if a single object was requested, return it as an object and not as a collection
		response = normalizeResponse(request.main, response);

		return {response, status};
	});
}
