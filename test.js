var AutomaticAPI = require('./automatic-api')
  , http         = require('http')
  , moira        = require('moira')
  , url          = require('url')
  , util         = require('util')
  ;

var clientID     = '...'
  , clientSecret = '...'
  , portno       = { external: 8894, local: 8894 }
  , clientState
  ;


var clients      = {};
var users        = {};


// this code assumes that your external IP address + portno.external is mapped to your your local IP's portno.local

moira.getIP(function(zeroP, ipaddr, service) {/* jshint unused: false */
  if (!!zeroP) return console.log('no IP addresses found');

  http.createServer(function(request, response) {
    if (request.method !== 'GET') return webhook(request, response);

    request.on('data', function(chunk) {/* jshint unused: false */
    }).on('close', function() {
      console.log('http error: premature close');
    }).on('clientError', function(err, socket) {/* jshint unused: false */
      console.log('http error: ' + err.message);
    }).on('end', function() {
      var client, parts, requestURL;

      parts = url.parse(request.url, true);
      if (!!parts.query.code) {
        if (!parts.query.state) return console.log('invalid response from server');

        client = clients[parts.query.state];
        if (!client) return console.log('cross-site request forgery suspected');

        client.authorize(parts.query.code, parts.query.state, function(err, user, state, scopes) {
          if (!!err) return console.log('authorization error: ' + err.message);

          // remember state as clientState
         console.log(util.inspect(state, { depth: null }));

          users[user.id] = client;
          getToWork(client);
        });

        response.writeHead(200, {'content-length' : 0 });
        return response.end();
      }

      client = new AutomaticAPI.AutomaticAPI({ clientID: clientID , clientSecret: clientSecret }).on('error', function(err) {
        console.log('background error: ' + err.message);
      });

      requestURL = client.authenticateURL(null, 'http://' + ipaddr + ':' + portno.external + '/');
      parts = url.parse(requestURL, true);
      clients[parts.query.state] = client;

      response.writeHead(307, { location: requestURL, 'content-length' : 0 });
      response.end();
    });
  }).listen(portno.local, function() {
    var client;

    if (!clientState) return console.log('please connect to http://localhost:' + portno.local + ' to authorize application');

    console.log('listening on port ' + portno.local + ' for incoming connections to http://' + ipaddr + ':' + portno.external);
    client = new AutomaticAPI.AutomaticAPI({ clientID: clientID , clientSecret: clientSecret }).on('error', function(err) {
      console.log('background error: ' + err.message);
    }).setState(clientState);

    users[clientState.id] = client;
    getToWork(client);
  });
});

var webhook = function (request, response) {
  var body = '';

  request.setEncoding('utf8');
  request.on('data', function(chunk) {
    body += chunk.toString();
  }).on('close', function() {
    console.log('http error: premature close');
  }).on('clientError', function(err, socket) {/* jshint unused: false */
    console.log('http error: ' + err.message);
  }).on('end', function() {
    var client, data;

    var loser = function (message) {
      response.writeHead(200, { 'content-type': 'text/plain; charset=utf8', 'content-length' : message.length });
      response.end(message);
    };

    try { data = JSON.parse(body); } catch(ex) { return loser(ex.message); }
    if (!data.type) return loser('webhook missing type parameter');
    if ((!data.user) || (!data.user.id)) return loser('webhook missing user.id');
    client = users[data.user.id];
    if (!client) return loser('internal error (somewhere!)');
    response.writeHead(200, {'content-length' : 0 });
    response.end();

    // now process data.type
    console.log(util.inspect(data, { depth: null }));
  });
};

var getToWork = function(client) {
  client.roundtrip('GET', '/trips', null, function(err, results) {
    if (!!err) return console.log('/trips: ' + err.message);

    console.log('trips');
    console.log(util.inspect(results, { depth: null }));
  });
};
