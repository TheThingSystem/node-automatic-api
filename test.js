var AutomaticAPI = require('./automatic-api')
  , http         = require('http')
  , moira         = require('moira')
  , url          = require('url')
  ;

var clientID     = '...'
  , clientSecret = '...'
  , portno       = { external: 8894, local: 8894 }
  ;

// this code assumes that your external IP address + portno.external is mapped to your your local IP's portno.local


var clients      = {};

moira.getIP(function(ipaddr, service) {/* jshint unused: false */
  http.createServer(function(request, response) {
    request.on('data', function(chunk) {/* jshint unused: false */
    }).on('close', function() {
      console.log('http error: premature close');
    }).on('clientError', function(err, socket) {/* jshint unused: false */
      console.log('http error: ' + err.message);
    }).on('end', function() {
      var cloud, parts, requestURL;

      parts = url.parse(request.url, true);
      if (!!parts.query.code) {
        if (!!parts.query.state) return cloud.emit('error', new Error('invalid response from server'));

        cloud = clients[parts.query.state];
        if (!cloud) return cloud.emit('error', new Error('cross-site request forgery suspected'));

        cloud.authorize(parts.query.code, parts.query.state, function(err, user, scopes) {
          if (!!err) return console.log('login error: ' + err.message);

          // otherwise, good to go!
          console.log('user: '); console.log(user);
          console.log('scopes: '); console.log(scopes);
        });

        return response.end();
      }

      cloud = new AutomaticAPI.AutomaticAPI({ clientID: clientID , clientSecret: clientSecret }).on('error', function(err) {
        console.log('background error: ' + err.message);
      });

      requestURL = cloud.authenticateURL(null, 'http://' + ipaddr + ':' + portno.external + '/');
      parts = url.parse(requestURL);
      clients[parts.state] = clientID;
console.log('redirect to ' + requestURL);

      response.writeHead(307, { location: requestURL, 'content-length' : 0 });
      response.end();
    });
  }).listen(portno.local, function() {
    console.log('listening on port ' + portno.local + ' for incoming connections to http://' + ipaddr + ':' + portno.external);
  });
});




