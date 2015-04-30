/*!
	Check the existence of a resource, and throw if it doesn't exist
*/

import jsonError from './jsonError.js';

export default function (resource, context) {
	if (context.resources[resource] === undefined) {
		throw new jsonError({
			title: 'Resource not found',
			details: '\'' + resource + '\' doesn\'t exist',
			status: 404
		});
	}
}
