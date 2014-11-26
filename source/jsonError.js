/*!
	JSON API Error object
*/

module.exports = function({title, detail, status, code, href, links, path, id}) {
	this.object = {
		title: title || 'Error',
		detail: detail || 'A unspecified error was fired by the application',
		status: status || 400,
		code: code,
		href: href,
		links: links,
		path: path,
		id: id
	}
};
