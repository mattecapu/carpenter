# Carpenter
A powerful declarative tool to automagically generate a MySQL-based REST API from his description.

### How it works
*Carpenter*, given a description of the resources you want to expose in your REST API, will build a basic handler that manages the interaction with the MySQL-capable database.

Queries will be built based on the URL requested, which are descriptive enough to provide all the necessary information to handle the request. This information, along with the description of the resources and eventually of the database (if the two differ), is indeed enough to manage the more _formal_ part of an API, concerning more communication logic than application logic.
Using Carpenter will result in a strong and healthy decoupling between the two components.

In the end, **you have control over what is really exposed**. The API returned, infact, is actually a function that consumes an URL, an HTTP method and a body object and returns an object. You can plug that to any routing system you use, and you still have complete control over the request and the response, content and format included.

The aim of Carpenter thus is just to _simplify_ the static process of handling well known client-server interactions, whose logic is often redudant and not central to the application purposes.

### Format
The format is inspired by the JSON API specification, but while initially it started as a fully compliant implementation, eventually **Carpenter now sticks to its own, simplified format**. JSON API needs to work in a wide range of cases, whereas Carpenter is more narrow-focused and aimed to fast development.
Moreover, I needed to have a REST API _asap_, thus I decided to not support all the subtleties of the official specification and I just implemented what I needed: an essential, intuitive format, handy for the server and comfortable for the client.
In the future I'll write a thorough documentation, of both library and API format. _Stay tuned, folks_.

### Inference
One of the main goals of Carpenter is to be quick to configure and integrate in an existing application. By default, Carpenter needs to know only the essential information about your API/database schema, and it will try to infer the most from it.
This doesn't mean you will be stuck within the assumptions Carpenter will made: you are still able to override all the default stuff (as of now, mostly naming) with the specific configuration your application has.

### Usage
This code creates a REST end-point for `pictures` (actually it would need other resources to be declared, but for shortness they're omitted in this example).
```js
var mach = require('mach');
var carpenter = require('carpenter');
var db = require('./my-database-wrapper.js');

carpenter.setConnection(db.connection());

var rest_api = carpenter.declareResource({
	type: 'pictures',
	attributes: {
		title: carpenter.domains.string.len({max: 30}),
		timestamp: carpenter.domains.nullable(carpenter.domains.timestamp)
	},
	relationships: {
		author: {
			type: 'users',
			to: 'one',
		},
		album: {
			type: 'albums',
			to: 'one',
		},
		likes: {
			type: 'likes',
			to: 'many'
		}
	},
	methods: ['GET', 'POST', 'PUT', 'DELETE']
}).exposeAPI();

app = mach.stack();
app.use(mach.params);

app.map('/api/v1', function(req) {
	// this actually returns a promise
	// that's one of the reasons mach is a good router choice
	return rest_api(req.pathInfo, req.method, req.params);
});
```
Now the server is capable of handling any of these requests
* `GET  /pictures`
* `GET  /pictures/1`
* `GET  /pictures/1/author`
* `GET  /pictures/1?fields=title,album`
* `GET  /pictures/1?include=album&fields[albums]=id,name`
* `POST /pictures    {pictures: {title: 'nice photo', author: 23, album: 42}}`
* `PUT  /pictures/1   {pictures: {title: 'new awesome title'}}`
* `DELETE /pictures/1`
* and almost every other possible request made in the limits of the [JSON API format](http://jsonapi.org/format/)

### License
Good, ol', [MIT license](http://github.com/mattecapu/carpenter/blob/master/LICENSE)