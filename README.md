node-automatic-api
==================

A node.js module to interface with the [Automatic](https://www.automatic.com/)
[cloud API](https://www.automatic.com/developer/).


Before Starting
---------------
You will need an Automatic account with developer access:

- If you do not already have an Automatic account:
    - Launch [iOS](https://itunes.apple.com/us/app/automatic/id596594365?mt=8) app on your smart phone/tablet.
(Android folks, fret not, an Android app is [on the way](http://blog.automatic.com/android-app-beta-program-update/)!)

    - Follow the directions to create an account.

- To activate developer access:
    - Go to the Automatic cloud API [website](https//www.automatic.com/developer)
and [login](https://www.automatic.com/accounts/login/?next=/developer/dashboard/).

    - Click on 'Sign up for API Access' and follow the directions.

    - You will receive an email when developer access is enabled.

    - At that point, you can go to your Automatic [developer dashboard](https://www.automatic.com/developer/dashboard/),
which will tell you the clientID and clientSecret for your application.


Install
-------

    npm install automatic-api

API
---

### Load

    var AutomaticAPI = require('automatic-api');

### Login to cloud

The Automatic cloud API requires that a user explicitly authorize your application.
This is done by having the application redirect the user's browser to an authorization URL.
On success, the browser is sent back to the 'redirect URL' that was registered when you signed up for API access.
When authorized,
your application will want to store some 'clientState' for the user.
The next time the user starts your application,
it checks to see if the clientState is available.
If so, it can skip the explicit authorization step.

Once your application has clientState, 
it may perform REST operations (pull), and it may receive webhook calls from the Automatic cloud (push).
In order to support push operations,
as with the explicity authoriation process,
your application will need to run a webserver.
Fortuituously, node makes this easy!

However,
one of the difficulties is that your application may be running behind a firewall,
and that firewall may be NAT'd,
and the upstream provider may periodically change your IP address.
At the present time,
the Automatic cloud API current requires that the redirect URL and webhook URL be defined when you activate developer access.
As such,
the code fragment below assumes that 'ipaddr' and 'portno.external' will map to your local IP's 'porto.local'.


### Authorize (if necessary) and Listen for webhooks

    // these are assigned by Automatic when developer access is activated
    var clientID     = '...'
      , clientSecret = '...'
      ;

    // these are assigned by your ISP, PAAS, etc.
    var ipaddr       = '...'
      , portno       = { external: 8894, local: 8894 }
      ;

    // if your application has already been authorized, then this should be set accordingly (see below)
    var clientState
      ;

    var client;

    // create a webserver
    http.createServer(function(request, response) {
      // GET is used only during authorization, POST is used only by webhooks
      if (request.method !== 'GET') return webhook(request, response);

      request.on('data', function(chunk) {
        // it's a GET, so we can ignore the data..
      }).on('close', function() {
        console.log('http error: premature close');
      }).on('clientError', function(err, socket) {
        console.log('http error: ' + err.message);
      }).on('end', function() {
        var parts, requestURL;

        // look at the URL's query parameters to see if this is from the user or Automatic
        parts = url.parse(request.url, true);

        // it's the user kicking off the authorization process
        if (!parts.query.code) {
          client = new AutomaticAPI.AutomaticAPI({ clientID: clientID, clientSecret: clientSecret }).on('error', function(err) {
            console.log('background error: ' + err.message);
          });

          requestURL = client.authenticateURL(null, 'http://' + ipaddr + ':' + portno.external + '/');
          response.writeHead(307, { location: requestURL, 'content-length' : 0 });
          response.end();
        }

        // it's Automatic confirming the authorization process
        client.authorize(parts.query.code, parts.query.state, function(err, user, state, scopes) {
          if (!!err) return console.log('authorization error: ' + err.message);

          // remember state as clientState for the next time the application runs
          console.log(util.inspect(state, { depth: null }));

          // REST API now available
        });

        // in practice, should give the user a nice "thank you!" screen...
        response.writeHead(200, { 'content-length' : 0 });
        return response.end();
      });
    }).listen(portno.local, function() {
      // we're now listening, see if we need to authorize
      if (!clientState) return console.log('please connect to http://localhost:' + portno.local + ' to authorize application');

      // already authorized, so we're listening for webhooks, create a client, set the state, and that's it!
      console.log('listening on port ' + portno.local + ' for incoming connections to http://' + ipaddr + ':'
                  + portno.external);
      client = new AutomaticAPI.AutomaticAPI({ clientID: clientID , clientSecret: clientSecret }).on('error', function(err) {
        console.log('background error: ' + err.message);
      }).setState(clientState);

      // REST API now available
    });

### Handling Webhooks

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
        var data;
    
        var loser = function (message) {
          response.writeHead(200, { 'content-type': 'text/plain; charset=utf8', 'content-length' : message.length });
          response.end(message);
        };
    
        try { data = JSON.parse(body); } catch(ex) { return loser(ex.message); }
        if (!data.type) return loser('webhook missing type parameter');
        if ((!data.user) || (!data.user.id)) return loser('webhook missing user.id');
        client = users[data.user.id];
        if (!client) return loser('internal error (somewhere!)');
        response.writeHead(200, { 'content-length' : 0 });
        response.end();
    
        // now process data.activity
        console.log(util.inspect(data, { depth: null }));
      });
    };

### REST API

    client.roundtrip('GET', '/trips', null, function(err, results) {
      if (!!err) return console.log('/trips: ' + err.message);

      console.log('trips');
      console.log(util.inspect(results, { depth: null }));
    });

Finally
-------

Enjoy!
