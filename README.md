# Carpenter
A powerful declarative tool to automagically generate a JSON-API-compliant REST API from his description.

### How it works
*Carpenter*, given a description of the resources you want to expose in your REST API, will build a basic handler that manages the interaction with the SQL-capable database.
Queries will be built based on the URL requested, which as defined in the JSON API specification, are descriptive enough to provide all the necessary information to handle the request. This information, along with the description of the resources and eventually of the database (if the two differ), is indeed enough to manage the more _formal_ part of an API, concerning more communication logic than application logic. Usin Carpenter will result in a strong and healthy decoupling between the two components.
In the end, *you have control over what is really exposed*. The API returned, infact, is actually a function that consumes an URL and a body object and returns an object. You can plug that to any routing system you use, and you still have complete control over the request and the response, content and format included.
The aim of Carpenter thus is just to _simplify_ the static process of handling well known client-server interactions, whose logic is often redudant and not central to the application purposes.

### Usage
This code creates a REST end-point for `users`.
```js
var mach = require('mach');
var carpenter = require('carpenter');
var db = require('./my-database-handler.js');

carpenter.setConnector(db.connection());

var rest_api = carpenter.declareResource({
	name: 'users',
	type: {
		id: carpenter.types.id,
		email: carpenter.types.email,
		name: carpenter.type.string.len({max: 30}),
		best_friend: carpenter.types.id
	},
	keys: {
		primary: 'id',
		unique: ['email'],
		foreign: [{
			field: best_friend,
			resource: 'users'
		}]
	},
	methods: ['GET', 'POST', 'PUT', 'DELETE']
}).exposeAPI();

app = mach.stack();
app.use(mach.params);

app.map('/api/v1', function(req) {
	return rest_api(req.pathInfo, req.params);
});

```
Now the server is capable of handling any of these requests
* `GET /users`
* `GET /users/1`
* `GET /users/1/linked/best_friend`
* `GET /users/1?fields=name`
* `POST /users   {email: 'foo@bar.com', name: 'Foo Bar', best_friend: 1}`
* and almost every other possible request made in the limits of the [JSON API format](http://jsonapi.org/format/)

### License
Good, ol', [MIT license](http://github.com/mattecapu/carpenter/blob/master/LICENSE)