/*!
	DELETE requests handler
*/


var squel = require('squel');
var Promise = require('bluebird');

var {filterBy} = require('./queryBuilder.js');


var handleDelete = function (request, body, context) {
	squel.useFlavour('mysql');

	return context.callQuery(
		filterBy(squel.remove().from(context.resources[resource_request.resource].sql_table), request.primary, context)
	).spread((stats) => {
		return {
			response: {},
			status: (stats.affectedRows ? 204 : 404)
		}
	});
};

module.exports = handleDelete;
