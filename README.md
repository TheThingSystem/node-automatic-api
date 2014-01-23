node-automatic-api
==================

**NB: this module is not completed yet. soon, very soon!**

A node.js module to interface with the [Automatic](https://www.automatic.com/)
[cloud API](https://www.automatic.com/developer/).


Install
-------

    npm install node-automatic-api

API
---

### Load

    var AutomaticAPI = require('node-automatic-api');

### Login to cloud

    var clientID     = '...'
      , clientSecret = '...'
      , cloud
      , requestURL
      ;

    cloud = new AutomaticAPI.AutomaticAPI({ clientID: clientID , clientSecret: clientSecret });
    requestURL = cloud.authenticateURL([ scopes ], redirectURL);

    // redirect the user to requestURL
    // on success, the user is redirected to redirectURL with a code, and state parameter

    cloud..authorize(code, state, function(err, user, scopes)) {
      if (!!err) return console.log('login error: ' + err.message);

      // otherwise, good to go!
      console.log('user: '); console.log(user);
      console.log('scopes: '); console.log(scopes);
    }).on('error', function(err) {
      console.log('background error: ' + err.message);
    });
