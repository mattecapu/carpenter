/*!
	Main file!
*/

var typs = require('typs');

var resources = [];
var db_connection = null;

var carpenter = {
	setConnection: function(connection) {
		if (!typs(connection).instanceOf(require('mysql/lib/Connection')).check()) {
			throw new Error('setConnection() expects a mysql Connection object as its first parameter');
		}
		db_connection = connection;
	},
	declareResource: function(resource) {
		resources.push(resource);
		return carpenter;
	},
	exposeAPI: function(stringify) {
		if (!typs(stringify).bool().check()) {
			throw new Error('exposeAPI() expects a boolean as its first argument');
		}
		
		return require('./exposeAPI.js').apply(stringify, resources, db_connection);
	},
	types: require('./types.js'),
};

module.exports = carpenter;

