/*!
	Main file!
*/

var resources = [];

var carpenter = {
	declareResource: function(resource) {
		resources.push(resource);
		return carpenter;
	},
	exposeAPI: function(stringify) {
		return require('./exposeAPI.js').apply(stringify, resources);
	},
	types: require('./types.js'),
};

module.exports = carpenter;

