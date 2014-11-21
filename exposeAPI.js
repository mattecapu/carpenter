/*!
	exposeAPI()
	return a function that consumes an URL and a body and returns a response
*/

module.exports = function(stringify, resources) {
	return function(url, body) {
		
		var path = url.split('/');
		if (path[path.length - 1] === '') path = path.slice(0, -1)
		
		if (stringify) response = JSON.stringify(response);
		return response;
	};
};
