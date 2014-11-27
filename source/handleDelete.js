/*!
	DELETE requests handler
*/

var squel = require('squel');
var Promise = require('bluebird');

var filterBy = require('./filterBy.js');


module.exports = function (request, body, context) {
	squel.useFlavour('mysql');

	return context.callQuery(
		filterBy(squel.remove(), request.primary, context)
	).spread((stats) => {
		console.log(stats, stats.affectedRows ? 204 : 404);
		return {
			response: {},
			status: (stats.affectedRows ? 204 : 404)
		}
	});
};
