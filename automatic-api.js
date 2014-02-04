// a node.js module to interface with the Automatic cloud API
//   cf., https://www.automatic.com/developer/

var events      = require('events')
  , oauth       = require('oauth')
  , util        = require('util')
  , uuid        = require('node-uuid')
  ;


var DEFAULT_LOGGER = { error   : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     , warning : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     , notice  : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     , info    : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     , debug   : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     };


var AutomaticAPI = function(options) {
  var k;

  var self = this;

  if (!(self instanceof AutomaticAPI)) return new AutomaticAPI(options);

  self.options = options;
  if ((!self.options.clientID) || (!self.options.clientSecret)) throw new Error('clientID and clientSecret required');

  self.logger = self.options.logger  || {};
  for (k in DEFAULT_LOGGER) {
    if ((DEFAULT_LOGGER.hasOwnProperty(k)) && (typeof self.logger[k] === 'undefined'))  self.logger[k] = DEFAULT_LOGGER[k];
  }

  self.oauth2 = new oauth.OAuth2(self.options.clientID, self.options.clientSecret, 'https://www.automatic.com',
                                 '/oauth/authorize', '/oauth/access_token');
  self.oauth2.setAuthMethod('token');    // not 'Bearer'
};
util.inherits(AutomaticAPI, events.EventEmitter);


AutomaticAPI.prototype.setState = function(state) {
  var self = this;

  self.state = state;

  return self;
};

AutomaticAPI.prototype.authenticateURL = function(scopes, redirectURL) {
  var params;

  var self = this;

  if (!scopes) scopes = AutomaticAPI.allScopes;
  self.cookie = uuid.v4();
  params = { scope         : scopes.join(' ')
           , response_type : 'code'
           , redirect_url  : redirectURL
           , state         : self.cookie
           };
  if (!!redirectURL) params.redirect_url = redirectURL;

  return self.oauth2.getAuthorizeUrl(params);
};


AutomaticAPI.prototype.authorize = function(code, state, callback) {
  var self = this;

  if (typeof callback !== 'function') throw new Error('callback is mandatory for login');

  if (self.cookie !== state) callback(new Error('cross-site request forgery suspected'));

  self.oauth2.getOAuthAccessToken(code, { grant_type: 'authorization_code'},
                                  function (err, accessToken, refreshToken, results) {
    var json;

    if (!!err) {
      if ((!err.message) && (!!err.data)) {
        try { json = JSON.parse(err.data); err = new Error(err.statusCode + ': ' + json.error_description); } catch(ex) {}
      }
      return callback(err);
    }

    if (!!results.expires_in) self.expiresAt = new Date().getTime() + (results.expires_in * 1000);

    self.state = { id           : results.user.id
                 , scopes       : (!!results.scope) ? results.scope.split(' ') : null
                 , cookie       : self.cookie
                 , accessToken  : accessToken
                 , refreshToken : refreshToken
                 , expiresAt    : self.expiresAt
                 };

    callback(null, results.user, self.state, self.state.scopes);
  });

  return self;
};


AutomaticAPI.prototype.roundtrip = function(method, path, json, callback) {
  var self = this;

  if ((!callback) && (typeof json === 'function')) {
    callback = json;
    json = null;
  }

  return self.invoke(method, path, json, function(err, code, results) {
    callback(err, results);
  });
};

AutomaticAPI.prototype.invoke = function(method, path, json, callback) {
  var headers;

  var self = this;

  if ((!callback) && (typeof json === 'function')) {
    callback = json;
    json = null;
  }
  if (!callback) {
    callback = function(err, results) {
      if (!!err) self.logger.error('invoke', { exception: err }); else self.logger.info(path, { results: results });
    };
  }

  headers = { Authorization: self.oauth2.buildAuthHeader(self.state.accessToken) };
  if (!!json) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = json.length;
  }
  self.oauth2._request(method, 'https://api.automatic.com/v1' + path, headers, json, null, function(oops, body, response) {
      var expected = { GET    : [ 200 ]
                     , PUT    : [ 200 ]
                     , POST   : [ 200, 201, 202 ]
                     , DELETE : [ 200 ]
                     }[method];

      var results = {};

      if (!!oops) return callback(new Error(oops.data), oops.statusCode);

      try { results = JSON.parse(body); } catch(ex) {
        self.logger.error(path, { event: 'json', diagnostic: ex.message, body: body });
        return callback(ex, response.statusCode);
      }

      if (expected.indexOf(response.statusCode) === -1) {
         self.logger.error(path, { event: 'https', code: response.statusCode, body: body });
         return callback(new Error('HTTP response ' + response.statusCode), response.statusCode, results);
      }

      callback(null, response.statusCode, results);

  });

  return self;
};


AutomaticAPI.allScopes =
[ 'scope:location'
, 'scope:vehicle'
, 'scope:trip:summary'
, 'scope:ignition:on'
, 'scope:ignition:off'
, 'scope:notification:speeding'
, 'scope:notification:hard_brake'
, 'scope:notification:hard_accel'
, 'scope:region:changed'
, 'scope:parking:changed'
, 'scope:mil:on'
, 'scope:mil:off'
];

exports.AutomaticAPI = AutomaticAPI;
