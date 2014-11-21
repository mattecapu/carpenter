/*!
	declareResource()
	take in and store a resource description
*/

var resources = [];
module.exports.declareResource = function(description) {
	resources.push(description);
};
module.exports.resources = resources;
